import { NextResponse } from 'next/server';
import { generateImage } from 'ai';
import { z } from 'zod';
import { configuredModel } from '@/lib/model-provider';
import { saveReference } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const {prompt}=z.object({prompt:z.string().min(3)}).parse(await request.json());
  const {config,provider}=configuredModel('image');
  const response=await generateImage({model:provider.imageModel(config.modelId),prompt:`专业高级商业营销海报，${prompt}。精美立体质感、视觉层次丰富。清晰构图，广告设计品质。`});
  const image=response.images[0];
  const ext=image.mediaType==='image/jpeg'?'jpg':image.mediaType==='image/webp'?'webp':'png';
  const referencePath=await saveReference(Buffer.from(image.uint8Array),ext);
  return NextResponse.json({referencePath});
});
