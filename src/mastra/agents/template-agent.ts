import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { configuredModel } from '@/lib/model-provider';
import { sourceSchema } from '@/lib/schemas';
import { applyTemplateEdits } from '@/lib/template-edits';
import { recordModelUsage } from '@/lib/model-usage';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import type { Manifest, TemplateSource } from '@/types';

type FileName = 'template.html' | 'style.css';
type Mode = 'create' | 'patch' | 'redesign' | 'review';
type CoderInput = {
  prompt:string; mode:Mode; width:number; height:number; previous?:TemplateSource;
  image?:Buffer; assetPath?:string; screenshot?:Buffer; mimeType?:string; reference?:Buffer;
  runId?:string; onProgress?:(stage:string)=>void;
};

const designInstructions = `你是专业的商业海报设计师兼前端工程师，拥有当前海报的两个真实本地文件：template.html 和 style.css。
你必须使用工具读取、编写或编辑文件。不要将 HTML/CSS 作为聊天文字或一个巨大 JSON 返回。工具修改成功才算完成。
用有艺术指导感的构图、字阶、色彩、空间层次和有重点的视觉元素设计成品，避免平庸的网页卡片列表。可以使用复杂静态 CSS、渐变、滤镜、透视和内联 SVG。
可直接使用项目内置的静态 Lucide SVG 图标：{{{icon "sparkles"}}}、{{{icon "zap"}}}、{{{icon "cpu"}}}、{{{icon "globe"}}}、{{{icon "shield"}}}、{{{icon "layers"}}}、{{{icon "arrow"}}}。
不得加载外部 CDN、第三方脚本、运行时 JS 或外部字体；浏览器会禁用 JS。
所有需要替换的文字必须是真实 HTML 文本。模型列表必须严格使用 {{#each items}} ... {{name}} ... {{discount}} ... {{/each}}，布局必须兼容 1～6 条模型数据。主标题使用 {{title}}，副标题可使用 {{subtitle}}。不要把文字烘焙进参考图片。
图像素材必须来自用户已上传/生成的本地路径，不得编造文件路径。可以直接内联静态 SVG。只能操作指定的两个文件，其他数据文件由程序维护。
没有自动多轮美学优化：本次只完成用户要求，保留设计原有优点，完成后由用户查看并决定下一轮。`;

function standardManifest(width:number,height:number):Manifest {
  return {name:'AI 海报模板',width,height,
    fields:[{key:'title',label:'主标题',type:'text'},{key:'subtitle',label:'副标题',type:'text'},{key:'items',label:'模型列表',type:'list'}],
    listFields:{items:[{key:'name',label:'模型名称'},{key:'discount',label:'折扣'}]}};
}

/** One isolated, two-file workspace for each user-requested creation/edit. */
async function runTemplateCoder(input:CoderInput):Promise<TemplateSource> {
  const folder=await mkdtemp(path.join(os.tmpdir(),'ai-design-'));
  const manifest=input.previous?.manifest??standardManifest(input.width,input.height);
  const {config,provider}=configuredModel('vision');
  const nameSchema=z.enum(['template.html','style.css']);
  let changed=false;
  let inspected=false;
  const readSource=async():Promise<TemplateSource>=>({
    html:await readFile(path.join(folder,'template.html'),'utf8'),
    css:await readFile(path.join(folder,'style.css'),'utf8'),
    manifest,
  });
  try {
    if(input.previous){
      await writeFile(path.join(folder,'template.html'),input.previous.html);
      await writeFile(path.join(folder,'style.css'),input.previous.css);
    }
    const readFileTool=createTool({
      id:'read-file',
      description:'读取模板工作区里的真实文件。修改已有设计前先读现有源文件。',
      inputSchema:z.object({file:nameSchema}),
      execute:async ({file}:{file:FileName})=>({file,content:await readFile(path.join(folder,file),'utf8')}),
    });
    const writeFileTool=createTool({
      id:'write-file',
      description:'创建或整体改写一个模板源码文件。生成新模板时分别编写 template.html 和 style.css；只有明确整体重构时才可以覆盖旧文件。',
      inputSchema:z.object({file:nameSchema,content:z.string()}),
      execute:async ({file,content}:{file:FileName;content:string})=>{
        await writeFile(path.join(folder,file),content);
        changed=true;
        input.onProgress?.(`已编写 ${file}`);
        return {file,ok:true,characters:content.length};
      },
    });
    const editFileTool=createTool({
      id:'edit-file',
      description:'精确修改一个现有 HTML/CSS 文件，只替换唯一匹配的旧片段，保持其他代码不动；适合调整局部版式和样式。',
      inputSchema:z.object({file:nameSchema,oldText:z.string().min(1),newText:z.string()}),
      execute:async ({file,oldText,newText}:{file:FileName;oldText:string;newText:string})=>{
        const previous=await readSource();
        const key=file==='template.html'?'html':'css';
        const next=applyTemplateEdits(previous,[{file:key,oldText,newText}]);
        await writeFile(path.join(folder,file),next[key]);
        changed=true;
        input.onProgress?.(`已局部编辑 ${file}`);
        return {file,ok:true,changedCharacters:Math.abs(newText.length-oldText.length)};
      },
    });
    const renderTool=createTool({
      id:'render-preview',
      description:'调用真实 Playwright 浏览器渲染目前源码并把截图提供给模型观察。仅在本次任务需要视觉检查时使用，不要自动反复修改。',
      inputSchema:z.object({}),
      execute:async ()=>{
        const current=sourceSchema.parse(await readSource());
        const png=await renderPNG(current,previewFields(current.manifest));
        inspected=true;
        input.onProgress?.('已使用浏览器渲染当前 HTML/CSS');
        return {content:[{type:'image' as const,data:png.toString('base64'),mimeType:'image/png'}]};
      },
    });
    const isCreate=input.mode==='create';
    const isPatch=input.mode==='patch'||input.mode==='review';
    const tools={
      readFile:readFileTool,
      ...(isPatch?{editFile:editFileTool}:{writeFile:writeFileTool,editFile:editFileTool}),
      ...(!isPatch?{renderPreview:renderTool}:{}),
    };
    const agent=new Agent({
      id:'poster-file-coder',name:'海报文件编写 Agent',
      model:provider.chatModel(config.modelId),
      instructions:designInstructions,
      tools,
    });
    const request=isCreate
      ?`创建尺寸 ${input.width}x${input.height} 的可复用营销海报。请分别调用 writeFile 写入 template.html 和 style.css。不要创建 manifest.json，系统已经管理了动态字段。设计要求：${input.prompt}${input.assetPath?`。已保存的参考图片地址：${input.assetPath}。只有作为无动态文字的装饰素材才可引用，不要直接把完整带字海报当背景。`:''}`
      :isPatch
        ?`请先调用 readFile 读取当前源码，再用 editFile 只修改指定位置，不覆盖整份文件。结合当前真实截图判断布局。要求：${input.prompt}`
        :`请先调用 readFile 了解当前设计，再按要求整体重构 template.html 与 style.css，可用 writeFile 覆盖文件。要求：${input.prompt}`;
    const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[{type:'text',text:request}];
    if(input.image)content.push(
      {type:'text',text:'下一张是用户的设计参考图；保留构图和质感，但不要把带动态文字的整图当成不可修改的背景。'},
      {type:'file',data:input.image.toString('base64'),mediaType:input.mimeType||'image/png'});
    if(input.screenshot)content.push(
      {type:'text',text:'下一张是当前 HTML 在真实浏览器里的截图，编辑时以这个实际效果为准。'},
      {type:'file',data:input.screenshot.toString('base64'),mediaType:'image/png'});
    if(input.reference)content.push(
      {type:'text',text:'下一张是最初参考图，保留其中仍符合用户要求的视觉特征。'},
      {type:'file',data:input.reference.toString('base64'),mediaType:input.mimeType||'image/png'});
    const started=Date.now();
    const result=await agent.generate([{role:'user',content}],{maxSteps:8,toolCallConcurrency:1});
    recordModelUsage({runId:input.runId,kind:'vision',
      operation:isCreate?'template-create':input.mode==='review'?'template-visual-review':isPatch?'template-patch':'template-redesign',
      modelId:config.modelId,usage:result.usage,durationMs:Date.now()-started});
    if(!changed)throw new Error('模板模型未调用文件编辑工具，源码未发生变化');
    const source=sourceSchema.parse(await readSource());
    input.onProgress?.(inspected?'浏览器预览完成，等待用户确认':'源码已编写，正在生成预览');
    return source;
  } finally {
    await rm(folder,{recursive:true,force:true});
  }
}

export async function createTemplateFiles(input:Omit<CoderInput,'mode'|'previous'>) {
  return runTemplateCoder({...input,mode:'create'});
}

export async function editTemplateFiles(previous:TemplateSource,input:Omit<CoderInput,'previous'|'width'|'height'|'image'> & {mode:'patch'|'review'|'redesign'}) {
  return runTemplateCoder({...input,previous,width:previous.manifest.width,height:previous.manifest.height});
}
