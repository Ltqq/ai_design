import { NextResponse } from 'next/server';
import { z } from 'zod';
import { renameSchema } from '@/lib/schemas';
import { readSource, renameTemplate, duplicateTemplate, deleteTemplate } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export const GET=withErrors(async(_request:Request,{params}:Context)=>{
  const {id}=await params;
  z.string().uuid().parse(id);
  return NextResponse.json(await readSource('templates',id));
});
export const PATCH=withErrors(async(request:Request,{params}:Context)=>{
  const {id}=await params;
  z.string().uuid().parse(id);
  const {name,action}=renameSchema.parse(await request.json());
  if(action==='copy') return NextResponse.json({templateId:await duplicateTemplate(id)});
  renameTemplate(id,name);
  return NextResponse.json({success:true});
});
export const DELETE=withErrors(async(_request:Request,{params}:Context)=>{
  const {id}=await params;
  z.string().uuid().parse(id);
  await deleteTemplate(id);
  return NextResponse.json({success:true});
});
