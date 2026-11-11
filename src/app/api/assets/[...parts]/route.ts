import { getAsset } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async(_request:Request,{params}:{params:Promise<{parts:string[]}>})=>{
  const {parts}=await params;
  const bytes=await getAsset(parts);
  const type=parts.at(-1)?.endsWith('.webp')?'image/webp':parts.at(-1)?.endsWith('.jpg')?'image/jpeg':'image/png';
  return new Response(new Uint8Array(bytes),{headers:{'Content-Type':type,'Cache-Control':'no-store'}});
});
