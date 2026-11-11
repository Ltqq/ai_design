import { NextResponse } from 'next/server';
import { chatInputSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { listChats,getChat,saveChatExchange,referenceBytes } from '@/lib/storage';
import { configuredModel } from '@/lib/model-provider';
import { Agent } from '@mastra/core/agent';
export const runtime='nodejs';
export const maxDuration=300;

export const GET=withErrors(async()=>NextResponse.json({sessions:listChats()}));
export const POST=withErrors(async(request:Request)=>{
  const {threadId,message,imagePath}=chatInputSchema.parse(await request.json());
  const {provider,config}=configuredModel('vision');
  const agent=new Agent({id:'design-chat',name:'AI Design 对话助手',model:provider.chatModel(config.modelId),instructions:'你是 AI Design 的创意与营销海报设计助手。用简洁、清晰、专业的中文回答；可以讨论视觉设计、营销文案及上传的参考图片。用户给出的模型名称和折扣必须原样保留，不要虚构价格。'});
  const history=threadId?getChat(threadId):[];
  const messages:Array<{role:'assistant';content:string}|{role:'user';content:string|Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>}>=[];
  for(const item of history){
    if(item.imagePath){
      const bytes=await referenceBytes(item.imagePath);
      messages.push({role:'user',content:[{type:'text',text:item.content},{type:'file',data:bytes.toString('base64'),mediaType:item.imagePath.endsWith('.png')?'image/png':item.imagePath.endsWith('.webp')?'image/webp':'image/jpeg'}]});
    }else messages.push(item.role==='user'?{role:'user',content:item.content}:{role:'assistant',content:item.content});
  }
  const content:Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>=[{type:'text',text:message}];
  if(imagePath){
    const image=await referenceBytes(imagePath);
    content.push({type:'file',data:image.toString('base64'),mediaType:imagePath.endsWith('.png')?'image/png':imagePath.endsWith('.webp')?'image/webp':'image/jpeg'});
  }
  messages.push({role:'user',content});
  const result=await agent.generate(messages);
  const id=saveChatExchange(threadId,message,imagePath||null,result.text);
  return NextResponse.json({threadId:id,reply:result.text});
});
