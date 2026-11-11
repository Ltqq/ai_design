import { NextResponse } from 'next/server';
import { reviseSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { readSource, writeSource } from '@/lib/storage';
import { askTemplateAgent } from '@/mastra/agents/template-agent';
import { renderPNG } from '@/lib/render';
import { previewFields } from '@/lib/template';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=withErrors(async(request:Request,{params}:{params:Promise<{id:string}>})=>{
  const {id}=await params;
  const {instruction}=reviseSchema.parse(await request.json());
  const existing=await readSource('drafts',id);
  const screenshot=await renderPNG(existing,previewFields(existing.manifest));
  const source=await askTemplateAgent({prompt:instruction,image:screenshot,mimeType:'image/png',width:existing.manifest.width,height:existing.manifest.height,previous:existing});
  const preview=await renderPNG(source,previewFields(source.manifest));
  await writeSource('drafts',id,source,preview);
  return NextResponse.json({draftId:id,preview:`/api/assets/drafts/${id}/thumbnail.png?t=${Date.now()}`,manifest:source.manifest});
});
