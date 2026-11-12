import { Agent } from '@mastra/core/agent';
import { configuredModel } from '@/lib/model-provider';
import { sourceSchema } from '@/lib/schemas';
import { getConfig } from '@/lib/storage';
import { recordModelUsage } from '@/lib/model-usage';
import { editInstructionsSchema } from '@/lib/template-edits';
import type { TemplateSource } from '@/types';

const instructions = `你是高级品牌视觉设计师与 HTML/CSS 工程师。为真实的 AI 模型促销活动制作精致、专业、可复用的平面海报。
返回严格 JSON：{"html":"...","css":"...","manifest":{...}}，不加 Markdown 和任何解释。
manifest 至少为 {"name":"海报标题","width":1080,"height":1440,"fields":[{"key":"title","label":"主标题","type":"text"},{"key":"items","label":"模型列表","type":"list"}],"listFields":{"items":[{"key":"name","label":"模型名称"},{"key":"discount","label":"折扣"}]}}。
HTML 只给 body 内片段，CSS 单独给 css 字段。必须用真实 DOM 文本渲染所有动态文字，模型卡片必须采用 {{#each items}} 包裹 {{name}} 和 {{discount}}，标题用 {{title}}；1~6 个模型卡片均要自然排版，不遮挡不溢出。

设计质量比堆砌代码重要。先依据主题选择一个视觉主方向，再写布局：①暗黑科技/电影感：高对比、发光色带、深景透视、空间层次；②明亮编辑设计：有力大标题、克制色彩、非对称留白；③商业促销：强烈折扣对比、明确 CTA、局部玻璃/金属质感。不要机械堆叠相同圆角面板，不要把整个画面均分为网格。优先构图、字阶、聚焦视觉、配色与信息层级。
技术上允许高级 CSS 渐变、透视、filter、clip-path、mix-blend-mode、伪元素，以及静态内联 SVG 的 shape/path/gradient/filter。可使用已安装的 Lucide SVG 帮助函数（不能引入包/CDN）：
{{{icon "sparkles"}}}、{{{icon "zap"}}}、{{{icon "cpu"}}}、{{{icon "globe"}}}、{{{icon "shield"}}}、{{{icon "layers"}}}、{{{icon "arrow"}}}。
如果提供已保存的本地视觉素材路径，可以用 <img src="/api/assets/references/已提供文件名"> 或 CSS url(该路径) 作为独立装饰视觉层；系统会在 PNG 渲染时自动内联。这必须是清晰的装饰素材，不得把含模型名称/折扣等文字的整张参考海报直接当背景，否则文本无法复用。没有本地素材时用纯 CSS/SVG 完成，不编造不存在的路径。
只能使用静态 HTML/CSS/SVG，不引入脚本、iframe、WebGL、外部图片/CDN/字体。信息结构可编辑，品牌画面应有足够质感，字体/图形尺寸要适应最终画布。Excel 仅有模型名称和折扣两列，不虚构售价或计算优惠。
`;

export function templateAgent() {
  const {config,provider}=configuredModel('vision');
  return new Agent({id:'template-designer',name:'海报模板设计 Agent',instructions,model:provider.chatModel(config.modelId)});
}
export function decodeSource(text:string):TemplateSource {
  const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return sourceSchema.parse(JSON.parse(cleaned)) as TemplateSource;
}
export async function askTemplateAgent(input:{prompt:string; image?:Buffer; comparisonImage?:Buffer; mimeType?:string; assetPath?:string; width:number; height:number; previous?:TemplateSource; runId?:string; operation?:string}):Promise<TemplateSource> {
  const prompt=`${input.previous?'根据已有模板与要求重新输出完整 JSON 源码。':'创建完整可填充数据的 HTML/CSS 模板。'}\n尺寸：${input.width}x${input.height}\n要求：${input.prompt}\n${input.previous?'已有模板：'+JSON.stringify(input.previous):''}`;
  const assetHint=input.assetPath? `\n参考图本地文件：${input.assetPath}。它可用于构图分析。仅当该图本身不含待替换的文字且适合作独立装饰素材时，才在 HTML/CSS 中引用此路径；否则请用 SVG/CSS 重建。`:'';
  const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[{type:'text',text:prompt+assetHint}];
  if(input.image)content.push({type:'file',data:input.image.toString('base64'),mediaType:input.mimeType||'image/png'});
  if(input.comparisonImage)content.push({type:'text',text:'下一张为目前 HTML 的实际浏览器截图，请在明确要求全面精修时比较并修正。'},{type:'file',data:input.comparisonImage.toString('base64'),mediaType:'image/png'});
  const started=Date.now();
  const result=await templateAgent().generate([{role:'user',content}]);
  recordModelUsage({runId:input.runId,kind:'vision',operation:input.operation||'template-create',modelId:getConfig('vision')?.modelId||'unknown',usage:result.usage,durationMs:Date.now()-started});
  return decodeSource(result.text);
}
export async function askTemplateEdits(previous:TemplateSource,instruction:string,runId?:string,images?:{screenshot:Buffer;reference?:Buffer;mimeType?:string}) {
  const {config,provider}=configuredModel('vision');
  const agent=new Agent({id:'template-editor',name:'HTML/CSS 局部编辑',model:provider.chatModel(config.modelId),
    instructions:`只做用户明确要求的局部修改，不重写整份模板。你是一个精确的源文件编辑器。
严格输出 JSON：{"edits":[{"file":"css","oldText":"旧源码中连续且唯一的一段","newText":"替换后的源码片段"}]}。
file 只能为 html 或 css。oldText 必须与下面提供的源码逐字符一致、出现恰好一次。修改通常只需要 CSS；只有确实需要变动 DOM 结构时才改 HTML。不要重复输出整份 HTML/CSS，不修改 manifest、模型名称及折扣占位符。如果不能以局部替换完成，则明确提示需要整体重构，不要硬凑大段替换。`});
  const started=Date.now();
  const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[
    {type:'text',text:`修改要求：${instruction}\n--- template.html ---\n${previous.html}\n--- style.css ---\n${previous.css}`}];
  if(images){
    content.push({type:'text',text:'下一张是当前 HTML 的真实浏览器截图，请检查文字遮挡、比例、视觉层次与排版。只输出能确定改善的最小修改。'});
    content.push({type:'file',data:images.screenshot.toString('base64'),mediaType:'image/png'});
    if(images.reference){
      content.push({type:'text',text:'下一张是原始设计参考图。不要修改动态模型名称/折扣绑定，不要整体重建。'});
      content.push({type:'file',data:images.reference.toString('base64'),mediaType:images.mimeType||'image/png'});
    }
  }
  const result=await agent.generate([{role:'user',content}]);
  recordModelUsage({runId,kind:'vision',operation:images?'template-visual-review':'template-patch',modelId:config.modelId,usage:result.usage,durationMs:Date.now()-started});
  const cleaned=result.text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return editInstructionsSchema.parse(JSON.parse(cleaned)).edits;
}
