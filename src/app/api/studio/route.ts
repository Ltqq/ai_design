import { NextResponse } from 'next/server';
import { z } from 'zod';
import { chatInputSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { getChat,getCurrentStudioRun,getStudioState,listChats,recentStudioEvents,deleteChat } from '@/lib/storage';
import { startStudioRun, studioView } from '@/lib/studio-runner';
import { studioMemory } from '@/lib/agent-memory';

export const runtime='nodejs';
const studioInputSchema=chatInputSchema.extend({width:z.number().int().min(100).max(4000).optional(),height:z.number().int().min(100).max(4000).optional()});
const threadSchema=z.string().uuid();

export const GET=withErrors(async(request:Request)=>{
  const id=new URL(request.url).searchParams.get('threadId');
  if(!id)return NextResponse.json({sessions:listChats()});
  threadSchema.parse(id);
  return NextResponse.json({messages:getChat(id),design:studioView(getStudioState(id)),run:getCurrentStudioRun(id),events:recentStudioEvents(id)});
});
export const POST=withErrors(async(request:Request)=>{
  const input=studioInputSchema.parse(await request.json());
  return NextResponse.json(startStudioRun(input),{status:202});
});
export const DELETE=withErrors(async(request:Request)=>{
  const id=threadSchema.parse(new URL(request.url).searchParams.get('threadId'));
  const run=getCurrentStudioRun(id);
  if(run?.status==='running')return NextResponse.json({error:'任务正在执行，请完成后再删除对话'},{status:409});
  await studioMemory().deleteThread(id);
  deleteChat(id);
  return NextResponse.json({success:true});
});
