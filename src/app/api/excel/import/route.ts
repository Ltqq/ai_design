import { NextResponse } from 'next/server';
import { parseExcel } from '@/lib/excel';
import { getModels, replaceModels } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async()=>NextResponse.json({models:getModels()}));
export const POST=withErrors(async(request:Request)=>{
  const file=(await request.formData()).get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx') || file.size>10*1024*1024) return NextResponse.json({error:'请上传最大 10MB 的 .xlsx 文件'},{status:400});
  const models=await parseExcel(Buffer.from(await file.arrayBuffer()));
  replaceModels(models);
  return NextResponse.json({models});
});
