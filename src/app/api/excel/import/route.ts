import { NextResponse } from 'next/server';
import { parseExcel } from '@/lib/excel';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const file=(await request.formData()).get('file');
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith('.xlsx') || file.size>10*1024*1024) return NextResponse.json({error:'请上传最大 10MB 的 .xlsx 文件'},{status:400});
  const sheets=await parseExcel(Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({sheets});
});
