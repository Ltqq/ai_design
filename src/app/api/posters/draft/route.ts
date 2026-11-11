import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPosterDraft,savePosterDraft } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const GET=withErrors(async()=>NextResponse.json({draft:getPosterDraft()}));
export const PUT=withErrors(async(request:Request)=>{
  const draft=z.object({templateId:z.union([z.string().uuid(),z.literal('')]),selectedNames:z.array(z.string()),fixedFields:z.record(z.string(),z.string())}).parse(await request.json());
  savePosterDraft(draft);
  return NextResponse.json({success:true});
});
