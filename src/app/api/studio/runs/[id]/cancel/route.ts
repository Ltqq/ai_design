import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrors } from '@/lib/http';
import { getStudioRun } from '@/lib/storage';
import { stopStudioRun } from '@/lib/task-control';

export const runtime='nodejs';
export const POST=withErrors(async(_request:Request,{params}:{params:Promise<{id:string}>})=>{
  const id=z.string().uuid().parse((await params).id);
  const run=getStudioRun(id);
  if(!run)return NextResponse.json({error:'任务不存在'},{status:404});
  if(run.status!=='running')return NextResponse.json({error:'任务已经结束'},{status:409});
  stopStudioRun(id);
  return NextResponse.json({success:true});
});
