import { NextResponse } from 'next/server';
import { withErrors } from '@/lib/http';
import { saveReference } from '@/lib/storage';
export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const file=(await request.formData()).get('file');
  if (!(file instanceof File) || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>15*1024*1024) return NextResponse.json({error:'仅支持最大 15MB 的 PNG/JPG/WebP 图片'},{status:400});
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const referencePath=await saveReference(Buffer.from(await file.arrayBuffer()),ext);
  return NextResponse.json({referencePath});
});
