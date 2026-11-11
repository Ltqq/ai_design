import { NextResponse } from 'next/server';
import { draftSchema } from '@/lib/schemas';
import { listTemplates, saveDraft } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async()=>NextResponse.json({templates:listTemplates()}));
export const POST=withErrors(async(request:Request)=>{
  const {id,name}=draftSchema.parse(await request.json());
  const templateId=await saveDraft(id,name);
  return NextResponse.json({templateId});
});
