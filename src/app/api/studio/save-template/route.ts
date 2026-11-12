import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrors } from '@/lib/http';
import { getCurrentStudioRun, getStudioState, renameTemplate, saveDraft, saveStudioState } from '@/lib/storage';
import { studioView } from '@/lib/studio-runner';
export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const {threadId,name}=z.object({threadId:z.string().uuid(),name:z.string().trim().min(1)}).parse(await request.json());
  const run=getCurrentStudioRun(threadId);
  if(run?.status==='running')return NextResponse.json({error:'设计任务执行中，请完成后保存模板'},{status:409});
  const design=getStudioState(threadId);
  if(!design.draftId&&!design.templateId)return NextResponse.json({error:'当前会话还没有可保存的模板'},{status:400});
  if(design.templateId)renameTemplate(design.templateId,name);
  else design.templateId=await saveDraft(design.draftId,name);
  saveStudioState(threadId,design);
  return NextResponse.json({templateId:design.templateId,design:studioView(design)});
});
