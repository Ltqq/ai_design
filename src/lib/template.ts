import Handlebars from 'handlebars';
import type { Manifest, PosterInput, TemplateSource } from '@/types';

export function bindFields(manifest: Manifest, input: PosterInput): Record<string,unknown> {
  return Object.fromEntries(manifest.fields.map(field => [field.key,
    field.type==='list'
      ? input.models.map(model=>({name:model.name,discount:model.discount}))
      : input.fixedFields[field.key] ?? ''
  ]));
}

export function renderHTML(source: TemplateSource, data: Record<string,unknown>) {
  const { width, height } = source.manifest;
  const html = Handlebars.compile(source.html, { noEscape:false })(data);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}body{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}${source.css}</style></head><body>${html}</body></html>`;
}

export function previewFields(manifest:Manifest) {
  return Object.fromEntries(manifest.fields.map(field => [field.key,
    field.type==='list' ? [
      {name:'deepseek-v4.1-flash',discount:'4折'},
      {name:'kimi-k3',discount:'5折'},
      {name:'glm-5.3',discount:'6折'},
    ] : field.type==='image' ? '' : field.key==='title'?'热门模型 · 限时优惠':field.key==='subtitle'?'精选 AI 模型，畅享高效创作':field.label
  ]));
}
