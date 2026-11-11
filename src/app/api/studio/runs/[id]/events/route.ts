import { z } from 'zod';
import { getStudioRun, readRunEvents } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export const GET=withErrors(async(request:Request,{params}:{params:Promise<{id:string}>})=>{
  const id=z.string().uuid().parse((await params).id);
  if(!getStudioRun(id))return Response.json({error:'任务不存在'},{status:404});
  let cursor=Number(request.headers.get('last-event-id')||new URL(request.url).searchParams.get('after')||0);
  const encoder=new TextEncoder();
  let canceled=false;
  const stream=new ReadableStream<Uint8Array>({
    async start(controller){
      try{
        while(!canceled && !request.signal.aborted){
          for(const event of readRunEvents(id,cursor)){
            controller.enqueue(encoder.encode(`id: ${event.id}\nevent: update\ndata: ${JSON.stringify(event)}\n\n`));
            cursor=event.id;
          }
          if(getStudioRun(id)?.status!=='running')break;
          await new Promise(resolve=>setTimeout(resolve,350));
        }
        if(!canceled)controller.close();
      }catch(error){if(!canceled)controller.error(error)}
    },
    cancel(){canceled=true;},
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
});
