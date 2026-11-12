import { Agent } from '@mastra/core/agent';
import { configuredModel } from '@/lib/model-provider';
import { sourceSchema } from '@/lib/schemas';
import { editInstructionsSchema } from '@/lib/template-edits';
import type { TemplateSource } from '@/types';

const instructions = `你是专业营销设计师与静态 HTML/CSS 工程师。根据参考海报图或文字要求编写精美且可复用的营销 HTML/CSS。
输出仅一个 JSON 对象，属性为 html、css、manifest，不要 Markdown 代码块或解释。
manifest 形如 {"name":"模板名","width":1080,"height":1440,"fields":[{"key":"title","label":"主标题","type":"text"},{"key":"items","label":"模型列表","type":"list"}],"listFields":{"items":[{"key":"name","label":"模型名"},{"key":"discount","label":"折扣"}]}}。
HTML 只包含 body 内的片段；CSS 单独放在 css 字段。模型列表统一写作 {{#each items}}<div>{{name}} {{discount}}</div>{{/each}}；标题用 {{title}}。
所有动态文字必须用真实 DOM 文本和 Handlebars 变量，不能固化到图片背景。优先 CSS 实现视觉装饰，不能用整张参考图当背景。
只能使用静态 HTML/CSS，不引入 JS、iframe、外部资源、第三方字体。适用于 1～6 个模型卡片，必须包含 items 列表和 name、discount 两个变量。不要创造价格字段或折扣算法。没有参考图时直接依据文字构建设计，不要求先调用生图模型。`;

export function templateAgent() {
  const {config,provider}=configuredModel('vision');
  return new Agent({id:'template-designer',name:'海报模板设计 Agent',instructions,model:provider.chatModel(config.modelId)});
}
export function decodeSource(text:string):TemplateSource {
  const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return sourceSchema.parse(JSON.parse(cleaned)) as TemplateSource;
}
export async function askTemplateAgent(input:{prompt:string; image?:Buffer; comparisonImage?:Buffer; mimeType?:string; width:number; height:number; previous?:TemplateSource}):Promise<TemplateSource> {
  const prompt=`${input.previous?'根据已有模板与要求重新输出完整 JSON 源码。':'创建完整可填充数据的 HTML/CSS 模板。'}\n尺寸：${input.width}x${input.height}\n要求：${input.prompt}\n${input.previous?'已有模板：'+JSON.stringify(input.previous):''}`;
  const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[{type:'text',text:prompt}];
  if(input.image)content.push({type:'file',data:input.image.toString('base64'),mediaType:input.mimeType||'image/png'});
  if(input.comparisonImage)content.push({type:'text',text:'下一张为目前 HTML 的实际浏览器截图，请在明确要求全面精修时比较并修正。'},{type:'file',data:input.comparisonImage.toString('base64'),mediaType:'image/png'});
  const result=await templateAgent().generate([{role:'user',content}]);
  return decodeSource(result.text);
}
export async function askTemplateEdits(previous:TemplateSource,instruction:string) {
  const {config,provider}=configuredModel('vision');
  const agent=new Agent({id:'template-editor',name:'HTML/CSS 局部编辑',model:provider.chatModel(config.modelId),
    instructions:`只做用户明确要求的局部修改，不重写整份模板。你是一个精确的源文件编辑器。
严格输出 JSON：{"edits":[{"file":"css","oldText":"旧源码中连续且唯一的一段","newText":"替换后的源码片段"}]}。
file 只能为 html 或 css。oldText 必须与下面提供的源码逐字符一致、出现恰好一次。修改通常只需要 CSS；只有确实需要变动 DOM 结构时才改 HTML。不要重复输出整份 HTML/CSS，不修改 manifest、模型名称及折扣占位符。如果不能以局部替换完成，则明确提示需要整体重构，不要硬凑大段替换。`});
  const result=await agent.generate([{role:'user',content:`修改要求：${instruction}\n--- template.html ---\n${previous.html}\n--- style.css ---\n${previous.css}`}]);
  const cleaned=result.text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return editInstructionsSchema.parse(JSON.parse(cleaned)).edits;
}
