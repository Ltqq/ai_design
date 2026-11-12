import { z } from 'zod';
import { getStudioRun, readRunEvents } from '@/lib/storage';
import { subscribeStudioRun } from '@/lib/studio-event-bus';
import { withErrors } from '@/lib/http';
import type { StudioEvent } from '@/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export const GET=withErrors(async(request:Request,{params}:{params:Promise<{id:string}>})=>{
  const id=z.string().uuid().parse((await params).id);
  if(!getStudioRun(id))return Response.json({error:'任务不存在'},{status:404});
  let cursor=Number(request.headers.get('last-event-id')||new URL(request.url).searchParams.get('after')||0);
  const encoder=new TextEncoder();
  let stopped=false;
  let unsubscribe=()=>{};
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      const cleanup=()=>{unsubscribe();request.signal.removeEventListener('abort',abort)};
      const close=()=>{
        if(stopped)return;
        stopped=true;cleanup();controller.close();
      };
      const abort=()=>close();
      const emit=(event:StudioEvent)=>{
        if(stopped||event.id<=cursor)return;
        cursor=event.id;
        controller.enqueue(encoder.encode(`id: ${event.id}\nevent: update\ndata: ${JSON.stringify(event)}\n\n`));
        if(event.type==='finished')close();
      };
      // Subscribe before replay so events written during connection setup are not lost.
      unsubscribe=subscribeStudioRun(id,emit);
      request.signal.addEventListener('abort',abort,{once:true});
      for(const event of readRunEvents(id,cursor))emit(event);
      if(getStudioRun(id)?.status!=='running')close();
    },
    cancel(){stopped=true;unsubscribe();},
  });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'}});
});
