import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { referenceBytes, writeSource } from '@/lib/storage';
import { askTemplateAgent } from '@/mastra/agents/template-agent';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
import { sourceSchema } from '@/lib/schemas';

const inputSchema=z.object({referencePath:z.string().optional(),prompt:z.string(),width:z.number(),height:z.number(),runId:z.string().optional()});
const generatedSchema=z.object({prompt:z.string(),source:sourceSchema});
const finalSchema=z.object({draftId:z.string(),preview:z.string(),manifest:sourceSchema.shape.manifest});

const generateStep=createStep({
  id:'generate-template',inputSchema,outputSchema:generatedSchema,
  execute:async ({inputData})=>{
    const image=inputData.referencePath?await referenceBytes(inputData.referencePath):undefined;
    const mimeType=inputData.referencePath?.endsWith('.webp')?'image/webp':inputData.referencePath?.endsWith('.png')?'image/png':'image/jpeg';
    const source=await askTemplateAgent({prompt:inputData.prompt,image,mimeType,assetPath:inputData.referencePath,width:inputData.width,height:inputData.height,runId:inputData.runId,operation:'template-create'});
    return {prompt:inputData.prompt,source};
  }
});
const renderStep=createStep({
  id:'render-and-save',inputSchema:generatedSchema,outputSchema:finalSchema,
  execute:async ({inputData})=>{
    const {source}=inputData;
    const preview=await renderPNG(source,previewFields(source.manifest));
    const draftId=randomUUID();
    await writeSource('drafts',draftId,source,preview);
    return {draftId,preview:`/api/assets/drafts/${draftId}/thumbnail.png`,manifest:source.manifest};
  }
});
export const createTemplateWorkflow=createWorkflow({id:'create-poster-template',inputSchema,outputSchema:finalSchema}).then(generateStep).then(renderStep).commit();
