import { Agent } from '@mastra/core/agent';
import { configuredModel } from '@/lib/model-provider';
import { sourceSchema } from '@/lib/schemas';
import type { TemplateSource } from '@/types';

const instructions = `你是专业营销设计师与静态 HTML/CSS 工程师。任务是根据参考海报图重建一个精美、可复用、可填 Excel 数据的 HTML/CSS 海报模板。
输出仅一个 JSON 对象，属性为 html、css、manifest，不要 Markdown 代码块或任何解释。
manifest 形如 {"name":"模板名","width":1080,"height":1440,"fields":[{"key":"title","label":"主标题","type":"text"},{"key":"items","label":"模型列表","type":"list"}],"listFields":{"items":[{"key":"name","label":"模型名"},{"key":"price","label":"展示价格"}]}}。
HTML 只给 body 内的内容片段，不能包含 html、head、body 或 style 标签；CSS 独立放 css 属性。HTML 使用 Handlebars: {{title}}、{{subtitle}}、{{#each items}}<div>{{name}} {{price}}</div>{{/each}}，图片字段用 <img src="{{qrcode}}">。
所有需要替换的文字（含价格、折扣、产品名称）必须用真实 DOM 文本与变量，不能是参考图背景上的文字；绝对不要将整张参考图当背景。CSS 自行构造视觉装饰、光影、立体透视、卡片结构、留白与层次，保持参考图的设计语言。
只输出纯静态 HTML/CSS，不引入 JavaScript、iframe、第三方 URL、CDN 图片和脚本；不能调用外部字体。模板适用于 1 到 6 个卡片，列表循环结构统一。不要进行价格公式或数据猜测。`;

export function templateAgent() {
  const {config,provider}=configuredModel('vision');
  return new Agent({id:'template-designer',name:'海报模板设计 Agent', instructions, model:provider.chatModel(config.modelId)});
}

export function decodeSource(text:string):TemplateSource {
  const cleaned=text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
  return sourceSchema.parse(JSON.parse(cleaned)) as TemplateSource;
}

export async function askTemplateAgent(input:{prompt:string; image:Buffer; comparisonImage?:Buffer; mimeType:string; width:number; height:number; previous?:TemplateSource}):Promise<TemplateSource> {
  const prompt = `${input.previous?'请在已有模板基础上按要求重新输出完整 JSON 源码。':'根据参考图设计完整可填充数据的 HTML/CSS 模板。'}\n尺寸：${input.width}x${input.height}\n要求：${input.prompt}\n${input.previous?'已有模板：'+JSON.stringify(input.previous):''}`;
  const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[{type:'text',text:prompt},{type:'file',data:input.image.toString('base64'),mediaType:input.mimeType}];
  if(input.comparisonImage)content.push({type:'text',text:'第二张图片为当前 HTML 在浏览器中的渲染结果，请对比第一张参考图后修正。'},{type:'file',data:input.comparisonImage.toString('base64'),mediaType:'image/png'});
  const result = await templateAgent().generate([{role:'user',content}]);
  return decodeSource(result.text);
}
