import { generateImage } from 'ai';
import { configuredModel } from '@/lib/model-provider';
import { saveReference, referenceBytes, readSource, writeSource, writeSourcePatch, snapshotTemplate } from '@/lib/storage';
import { createTemplateWorkflow } from '@/mastra/workflows/create-template';
import { editTemplateFiles } from '@/mastra/agents/template-agent';
import { recordModelUsage } from '@/lib/model-usage';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import type { TemplateSource } from '@/types';

export async function generateDesignImage(prompt:string,runId?:string,width=1080,height=1440) {
  const {config,provider}=configuredModel('image');
  const started=Date.now();
  const result=await generateImage({model:provider.imageModel(config.modelId),
    prompt:`商业海报设计需求：${prompt}\n画面比例接近 ${width}:${height}，遵循用户指定的风格、主题和具体文字。请用有主视觉焦点、清晰文字层级、成熟构图、准确光影及合理留白的广告视觉设计，不要机械排列普通网页卡片；不要自行编造未提供的模型价格。`});
  recordModelUsage({runId,kind:'image',operation:'image-generate',modelId:config.modelId,usage:(result as {usage?:unknown}).usage,imageCount:result.images.length,durationMs:Date.now()-started});
  const image=result.images[0];
  const ext=image.mediaType==='image/jpeg'?'jpg':image.mediaType==='image/webp'?'webp':'png';
  return saveReference(Buffer.from(image.uint8Array),ext);
}
async function runTemplateWorkflow(prompt:string,width:number,height:number,referencePath?:string,onProgress?:(stage:string)=>void,runId?:string) {
  const run=await createTemplateWorkflow.createRun();
  const output=run.stream({inputData:{referencePath,prompt,width,height,runId}});
  for await(const chunk of output.fullStream)
    if(chunk.type==='workflow-step-start')onProgress?.(chunk.payload.id==='generate-template'?'AI 正在编写 HTML/CSS':'正在渲染并保存模板草稿');
  const result=await output.result;
  if(result.status!=='success')throw new Error('模板生成失败：'+JSON.stringify(result));
  return result.result;
}
export async function convertDesignToTemplate(referencePath:string,prompt:string,width:number,height:number,onProgress?:(stage:string)=>void,runId?:string){
  return runTemplateWorkflow(prompt,width,height,referencePath,onProgress,runId);
}
export async function createTemplateFromText(prompt:string,width:number,height:number,onProgress?:(stage:string)=>void,runId?:string){
  return runTemplateWorkflow(prompt,width,height,undefined,onProgress,runId);
}
export async function reviseDesignTemplate(kind:'drafts'|'templates',id:string,instruction:string,onProgress?:(stage:string)=>void,mode:'patch'|'redesign'|'review'='patch',referencePath?:string,runId?:string){
  const previous=await readSource(kind,id);
  onProgress?.(mode==='redesign'?'AI 正在重构模板源码':mode==='review'?'AI 正在对照截图修改源码':'AI 正在编辑模板源码');
  const screenshot=await renderPNG(previous,previewFields(previous.manifest));
  const reference=referencePath?await referenceBytes(referencePath):undefined;
  const source=await editTemplateFiles(previous,{
    prompt:instruction,mode,runId,onProgress,screenshot,reference,
    mimeType:referencePath?.endsWith('.webp')?'image/webp':referencePath?.endsWith('.png')?'image/png':'image/jpeg',
  });
  onProgress?.('正在验证并渲染修改后的 HTML');
  const preview=await renderPNG(source,previewFields(source.manifest));
  if(kind==='templates')await snapshotTemplate(id);
  const changedFiles=mode!=='redesign'
    ?await writeSourcePatch(kind,id,previous,source,preview)
    :(await writeSource(kind,id,source,preview),['html','css','manifest']);
  onProgress?.(mode!=='redesign'
    ?`局部编辑已应用：仅修改 ${changedFiles.length?changedFiles.join('、'):'无'} 源文件；未执行整份重构`
    :'已完成整个 HTML/CSS 模板重构');
  return {preview:`/api/assets/${kind}/${id}/thumbnail.png?v=${Date.now()}`,manifest:source.manifest,mode,changedFiles};
}
