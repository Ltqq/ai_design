import { generateImage } from 'ai';
import { configuredModel } from '@/lib/model-provider';
import { saveReference, referenceBytes, readSource, writeSource, snapshotTemplate } from '@/lib/storage';
import { createTemplateWorkflow } from '@/mastra/workflows/create-template';
import { askTemplateAgent } from '@/mastra/agents/template-agent';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import type { TemplateSource } from '@/types';

export async function generateDesignImage(prompt: string) {
  const { config, provider } = configuredModel('image');
  const result = await generateImage({
    model: provider.imageModel(config.modelId),
    prompt: `专业高级商业营销海报，${prompt}。精美立体质感、视觉层次丰富。清晰构图，广告设计品质。`,
  });
  const image = result.images[0];
  const ext = image.mediaType === 'image/jpeg' ? 'jpg' : image.mediaType === 'image/webp' ? 'webp' : 'png';
  return saveReference(Buffer.from(image.uint8Array), ext);
}

export async function convertDesignToTemplate(referencePath: string, prompt: string, width: number, height: number, onProgress?: (stage:string)=>void) {
  const run = await createTemplateWorkflow.createRun();
  const output=run.stream({inputData:{referencePath,prompt,width,height}});
  for await(const chunk of output.fullStream) {
    if(chunk.type==='workflow-step-start') onProgress?.(chunk.payload.id==='generate-template'?'正在根据图片编写 HTML/CSS':'正在截图并用 AI 检查版式');
  }
  const result=await output.result;
  if (result.status !== 'success') throw new Error('模板生成失败：' + JSON.stringify(result));
  return result.result;
}

export async function reviseDesignTemplate(kind: 'drafts' | 'templates', id: string, instruction: string, onProgress?: (stage:string)=>void) {
  onProgress?.('正在读取现有模板并截图');
  const previous = await readSource(kind, id);
  const screenshot = await renderPNG(previous, previewFields(previous.manifest));
  onProgress?.('AI 正在修改 HTML/CSS 代码');
  const source: TemplateSource = await askTemplateAgent({
    prompt: instruction, image: screenshot, mimeType: 'image/png',
    width: previous.manifest.width, height: previous.manifest.height, previous,
  });
  onProgress?.('正在验证并渲染修改后的 HTML');
  const preview = await renderPNG(source, previewFields(source.manifest));
  if(kind==='templates') await snapshotTemplate(id);
  await writeSource(kind, id, source, preview);
  return { preview: `/api/assets/${kind}/${id}/thumbnail.png?v=${Date.now()}`, manifest: source.manifest };
}
