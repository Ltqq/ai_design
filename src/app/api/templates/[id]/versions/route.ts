import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listTemplateVersions,restoreTemplateVersion } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export const GET=withErrors(async(_request:Request,{params}:Context)=>{
  const templateId=z.string().uuid().parse((await params).id);
  return NextResponse.json({versions:listTemplateVersions(templateId)});
});
export const POST=withErrors(async(request:Request,{params}:Context)=>{
  const templateId=z.string().uuid().parse((await params).id);
  const {versionId}=z.object({versionId:z.string().uuid()}).parse(await request.json());
  await restoreTemplateVersion(templateId,versionId);
  return NextResponse.json({success:true});
});
