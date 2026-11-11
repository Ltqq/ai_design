import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { getConfig } from '@/lib/storage';
import type { ModelKind } from '@/types';

export function configuredModel(kind: ModelKind) {
  const config = getConfig(kind);
  if (!config) throw new Error(`请先到模型设置页面配置${kind==='vision'?'多模态理解':'图片生成'}模型`);
  return { config, provider:createOpenAICompatible({name:`ai-design-${kind}`,baseURL:config.baseURL,apiKey:config.apiKey}) };
}
