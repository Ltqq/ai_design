import { NextResponse } from 'next/server';
import { createSchema } from '@/lib/schemas';
import { createTemplateWorkflow } from '@/mastra/workflows/create-template';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=withErrors(async(request:Request)=>{
  const input=createSchema.parse(await request.json());
  const run=await createTemplateWorkflow.createRun();
  const result=await run.start({inputData:input});
  if(result.status!=='success') throw new Error('模板生成失败：'+JSON.stringify(result));
  return NextResponse.json(result.result);
});
