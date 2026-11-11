import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { referenceBytes, writeSource } from '@/lib/storage';
import { askTemplateAgent } from '@/mastra/agents/template-agent';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import { sourceSchema } from '@/lib/schemas';

const inputSchema=z.object({referencePath:z.string(),prompt:z.string(),width:z.number(),height:z.number(),previous:sourceSchema.optional()});
const generatedSchema=z.object({referencePath:z.string(),prompt:z.string(),source:sourceSchema});
const finalSchema=z.object({draftId:z.string(),preview:z.string(),manifest:sourceSchema.shape.manifest});

const generateStep=createStep({
  id:'generate-template',inputSchema,outputSchema:generatedSchema,
  execute:async ({inputData})=>{
    const image=await referenceBytes(inputData.referencePath);
    const source=await askTemplateAgent({prompt:inputData.prompt,image,mimeType:inputData.referencePath.endsWith('.webp')?'image/webp':inputData.referencePath.endsWith('.png')?'image/png':'image/jpeg',width:inputData.width,height:inputData.height,previous:inputData.previous});
    return {referencePath:inputData.referencePath,prompt:inputData.prompt,source};
  }
});
const inspectStep=createStep({
  id:'render-and-review',inputSchema:generatedSchema,outputSchema:finalSchema,
  execute:async ({inputData})=>{
    let source=inputData.source;
    let preview=await renderPNG(source,previewFields(source.manifest));
    const reference=await referenceBytes(inputData.referencePath);
    const draftId=randomUUID();
    await writeSource('drafts',draftId,source,preview);
    try {
      const feedback=await askTemplateAgent({prompt:`对比参考图与当前 HTML 预览，修正明显的排版、层次、比例偏差，保持现有占位字段及名称不变。参考要求：${inputData.prompt}`,image:reference,comparisonImage:preview,mimeType:inputData.referencePath.endsWith('.webp')?'image/webp':inputData.referencePath.endsWith('.png')?'image/png':'image/jpeg',width:source.manifest.width,height:source.manifest.height,previous:source});
      const correctedPreview=await renderPNG(feedback,previewFields(feedback.manifest));
      source=feedback;
      preview=correctedPreview;
      await writeSource('drafts',draftId,source,preview);
    } catch (error) {
      console.warn('视觉修正失败，保留已成功生成的第一版模板:',error);
    }
    return {draftId,preview:`/api/assets/drafts/${draftId}/thumbnail.png`,manifest:source.manifest};
  }
});
export const createTemplateWorkflow=createWorkflow({id:'create-poster-template',inputSchema,outputSchema:finalSchema}).then(generateStep).then(inspectStep).commit();
