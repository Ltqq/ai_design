import { NextResponse } from 'next/server';
import { posterSchema } from '@/lib/schemas';
import { readSource } from '@/lib/storage';
import { bindFields } from '@/lib/template';
import { renderPNG } from '@/lib/render';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=120;
export const POST=withErrors(async(request:Request)=>{
  const input=posterSchema.parse(await request.json());
  const source=await readSource('templates',input.templateId);
  const data=bindFields(source.manifest,input);
  const image=await renderPNG(source,data);
  return new Response(new Uint8Array(image),{headers:{'Content-Type':'image/png','Content-Disposition':'inline; filename="poster.png"','Cache-Control':'no-store'}});
});
