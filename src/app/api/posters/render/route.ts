import { NextResponse } from 'next/server';
import { posterSchema } from '@/lib/schemas';
import { readSource,savePoster,listPosters } from '@/lib/storage';
import { bindFields } from '@/lib/template';
import { renderPNG } from '@/lib/render';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=120;
export const GET=withErrors(async()=>NextResponse.json({posters:listPosters()}));
export const POST=withErrors(async(request:Request)=>{
  const input=posterSchema.parse(await request.json());
  const source=await readSource('templates',input.templateId);
  const image=await renderPNG(source,bindFields(source.manifest,input));
  const save=new URL(request.url).searchParams.get('save')==='1';
  const id=save?await savePoster(image,input.templateId,input.models.length):null;
  return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Content-Disposition':`inline; filename="${id||'poster'}.png"`,'Cache-Control':'no-store',...(id?{'X-Poster-ID':id}:{})}});
});
