import { z } from 'zod';
import { readPoster } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async(_request:Request,{params}:{params:Promise<{id:string}>})=>{
  const id=z.string().uuid().parse((await params).id);
  const png=await readPoster(id);
  return new Response(new Uint8Array(png),{headers:{'Content-Type':'image/png','Cache-Control':'private, max-age=60'}});
});
