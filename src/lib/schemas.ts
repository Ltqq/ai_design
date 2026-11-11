import { z } from 'zod';

export const configSchema = z.object({
  kind: z.enum(['vision', 'image']),
  baseURL: z.url(),
  modelId: z.string().min(1),
  apiKey: z.string().optional(),
});
export const fieldSchema = z.object({ key: z.string().regex(/^[\w-]+$/), label: z.string(), type: z.enum(['text','image','list']) });
export const manifestSchema = z.object({
  name: z.string().min(1),
  width: z.number().int().min(100).max(4000),
  height: z.number().int().min(100).max(4000),
  fields: z.array(fieldSchema).min(1),
  listFields: z.record(z.string(), z.array(z.object({ key: z.string().regex(/^[\w-]+$/), label: z.string() }))),
}).refine(m => m.fields.some(f=>f.key==='items'&&f.type==='list') && ['name','discount'].every(k=>m.listFields.items?.some(f=>f.key===k)),'模板必须有 items 列表及 name、discount 两个占位字段');
export const sourceSchema = z.object({
  html: z.string().min(1).refine(v => !/<script\b|\bon\w+\s*=|<iframe\b|<object\b|<embed\b/i.test(v), '模板只能包含静态 HTML'),
  css: z.string(),
  manifest: manifestSchema,
});
export const posterSchema = z.object({
  templateId: z.string().uuid(),
  models: z.array(z.object({name:z.string().min(1),discount:z.string().min(1)})).min(1).max(6),
  fixedFields: z.record(z.string(),z.string()),
});
export const draftSchema = z.object({ id: z.string().uuid(), name: z.string().min(1) });
export const createSchema = z.object({ referencePath: z.string().regex(/^\/api\/assets\/references\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/), prompt: z.string(), width: z.number().int().min(100).max(4000), height: z.number().int().min(100).max(4000) });
export const reviseSchema = z.object({ instruction: z.string().min(1) });
export const renameSchema = z.object({ name: z.string().min(1), action: z.enum(['rename','copy']).default('rename') });
export const chatInputSchema=z.object({threadId:z.string().uuid().optional(),message:z.string().trim().min(1).max(12000),imagePath:z.string().regex(/^\/api\/assets\/references\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/).optional()});
