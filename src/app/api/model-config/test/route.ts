import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { generateImage } from 'ai';
import { configuredModel } from '@/lib/model-provider';
import { withErrors } from '@/lib/http';

export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const {kind}=z.object({kind:z.enum(['vision','image'])}).parse(await request.json());
  const {config,provider}=configuredModel(kind);
  if (kind==='image') {
    const response=await generateImage({model:provider.imageModel(config.modelId),prompt:'蓝色渐变的简洁圆形几何图形，不要文字'});
    return NextResponse.json({success:response.images.length>0,message:'图片生成接口调用成功'});
  }
  const verificationTool=createTool({id:'confirm-image',description:'识别图像后必须调用此工具确认结果',inputSchema:z.object({visible:z.boolean()}),outputSchema:z.object({ok:z.boolean()}),execute:async ({visible})=>({ok:visible})});
  const agent=new Agent({id:'capability-check',name:'多模态能力测试',model:provider.chatModel(config.modelId),instructions:'你需要查看图片并调用 confirm-image 工具，传入 visible=true，不要直接答复。',tools:{'confirm-image':verificationTool}});
  const onePixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrN8AAAAASUVORK5CYII=';
  const result=await agent.generate({messages:[{role:'user',content:[{type:'text',text:'这是一张图片，请执行指定工具确认你支持看图及工具调用。'},{type:'file',data:onePixel,mediaType:'image/png'}]}]});
  return NextResponse.json({success:result.toolCalls.length>0,message:result.toolCalls.length?'图片输入与工具调用正常':'模型没有发起工具调用，请检查能力支持'});
});
