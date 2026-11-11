import { generateImage } from 'ai';
import { configuredModel } from '@/lib/model-provider';
import { saveReference, referenceBytes, readSource, writeSource } from '@/lib/storage';
import { createTemplateWorkflow } from '@/mastra/workflows/create-template';
import { askTemplateAgent } from '@/mastra/agents/template-agent';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import type { TemplateSource } from '@/types';

export async function generateDesignImage(prompt: string) {
  const { config, provider } = configuredModel('image');
  const result = await generateImage({
    model: provider.imageModel(config.modelId),
    prompt: `专业高级商业营销海报，${prompt}。精美立体质感、视觉层次丰富。清晰构图，广告设计品质。`,
  });
  const image = result.images[0];
  const ext = image.mediaType === 'image/jpeg' ? 'jpg' : image.mediaType === 'image/webp' ? 'webp' : 'png';
  return saveReference(Buffer.from(image.uint8Array), ext);
}

export async function convertDesignToTemplate(referencePath: string, prompt: string, width: number, height: number) {
  const run = await createTemplateWorkflow.createRun();
  const result = await run.start({ inputData: { referencePath, prompt, width, height } });
  if (result.status !== 'success') throw new Error('模板生成失败：' + JSON.stringify(result));
  return result.result;
}

export async function reviseDesignTemplate(kind: 'drafts' | 'templates', id: string, instruction: string) {
  const previous = await readSource(kind, id);
  const screenshot = await renderPNG(previous, previewFields(previous.manifest));
  const source: TemplateSource = await askTemplateAgent({
    prompt: instruction, image: screenshot, mimeType: 'image/png',
    width: previous.manifest.width, height: previous.manifest.height, previous,
  });
  const preview = await renderPNG(source, previewFields(source.manifest));
  await writeSource(kind, id, source, preview);
  return { preview: `/api/assets/${kind}/${id}/thumbnail.png?v=${Date.now()}`, manifest: source.manifest };
}
