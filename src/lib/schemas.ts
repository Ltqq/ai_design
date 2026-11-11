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
});
export const sourceSchema = z.object({
  html: z.string().min(1).refine(v => !/<script\b|\bon\w+\s*=|<iframe\b|<object\b|<embed\b/i.test(v), '模板只能包含静态 HTML'),
  css: z.string(),
  manifest: manifestSchema,
}).refine(source => /{{\s*#each\s+items\s*}}/.test(source.html) && /{{\s*name\s*}}/.test(source.html) && /{{\s*discount\s*}}/.test(source.html) && /{{\s*\/each\s*}}/.test(source.html), 'HTML 必须真实使用 items 循环以及 name、discount 占位符');
export const posterSchema = z.object({
  templateId: z.string().uuid(),
  rows: z.array(z.record(z.string(), z.string())),
  selectedRows: z.array(z.number().int().nonnegative()),
  mapping: z.record(z.string(), z.string()),
  fixedFields: z.record(z.string(), z.string()),
});
export const draftSchema = z.object({ id: z.string().uuid(), name: z.string().min(1) });
export const createSchema = z.object({ referencePath: z.string().regex(/^\/api\/assets\/references\/[a-f0-9-]{36}\.(png|jpg|jpeg|webp)$/), prompt: z.string(), width: z.number().int().min(100).max(4000), height: z.number().int().min(100).max(4000) });
export const reviseSchema = z.object({ instruction: z.string().min(1) });
export const renameSchema = z.object({ name: z.string().min(1), action: z.enum(['rename','copy']).default('rename') });
