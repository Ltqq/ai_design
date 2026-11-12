import Handlebars from 'handlebars';
import type { Manifest, PosterInput, TemplateSource } from '@/types';

export function bindFields(manifest: Manifest, input: PosterInput): Record<string,unknown> {
  return Object.fromEntries(manifest.fields.map(field => [field.key,
    field.type==='list'
      ? input.models.map(model=>({name:model.name,discount:model.discount}))
      : input.fixedFields[field.key] ?? ''
  ]));
}

// Minimal static SVG shapes from the open-source Lucide icon set.
// The helper emits only built-in, trusted vector markup; no client JS or CDN.
const iconShapes:Record<string,string>={
  sparkles:'<path d="m12 3 1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="m19 17 .6 1.4L21 19l-1.4.6L19 21l-.6-1.4L17 19l1.4-.6z"/>',
  zap:'<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>',
  cpu:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3m6-3v3m-6 16v3m6-3v3M1 9h3m-3 6h3m16-6h3m-3 6h3"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20m-10-10c-6 5-6 15 0 20m0-20c6 5 6 15 0 20"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  layers:'<path d="m12 2 10 6-10 6L2 8z"/><path d="m2 12 10 6 10-6M2 16l10 6 10-6"/>',
  arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>'
};
const engine=Handlebars.create();
engine.registerHelper('icon',(name:unknown)=>{
  const shape=typeof name==='string'?iconShapes[name]:undefined;
  return new Handlebars.SafeString(shape?
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`:'');
});

export function renderHTML(source: TemplateSource, data: Record<string,unknown>) {
  const { width, height } = source.manifest;
  const html = engine.compile(source.html, { noEscape:false })(data);
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
