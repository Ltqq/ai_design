import Handlebars from 'handlebars';
import type { Manifest, PosterInput, TemplateSource } from '@/types';

export function bindFields(manifest: Manifest, input: PosterInput): Record<string,unknown> {
  const result: Record<string,unknown> = {};
  for (const field of manifest.fields) {
    if (field.type === 'list') {
      const subFields = manifest.listFields[field.key] || [];
      result[field.key] = input.selectedRows.map(index => Object.fromEntries(subFields.map(child => [child.key, input.rows[index]?.[input.mapping[`${field.key}.${child.key}`]] ?? ''])));
    } else {
      result[field.key] = input.fixedFields[field.key] || (input.mapping[field.key] ? input.rows[input.selectedRows[0]]?.[input.mapping[field.key]] : '') || '';
    }
  }
  return result;
}
export function renderHTML(source: TemplateSource, data: Record<string,unknown>) {
  const { width, height } = source.manifest;
  const html = Handlebars.compile(source.html, { noEscape:false })(data);
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden}body{font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif}${source.css}</style></head><body>${html}</body></html>`;
}
export function previewFields(manifest:Manifest) {
  return Object.fromEntries(manifest.fields.map(field => [field.key, field.type==='list' ? [Object.fromEntries((manifest.listFields[field.key]||[]).map(child=>[child.key,child.label||child.key]))] : field.type==='image' ? '' : field.label]));
}
