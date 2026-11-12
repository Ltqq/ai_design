import { designStudioAgent } from '@/mastra/agents/design-studio';
import { getConfig } from '@/lib/storage';
import { recordModelUsage } from '@/lib/model-usage';
import { beginStudioRun, finishStudioRun, getChat, getStudioState, recordStudioEvent, referenceBytes, saveStudioState } from '@/lib/storage';
import type { StudioState } from '@/types';

type ChatInput = {threadId?:string;message:string;imagePath?:string;width?:number;height?:number};

export function startStudioRun(input:ChatInput) {
  const design=getStudioState(input.threadId);
  if(input.imagePath) design.referencePath=input.imagePath;
  if(input.width) design.width=input.width;
  if(input.height) design.height=input.height;
  const run=beginStudioRun(input.threadId,input.message,input.imagePath||null,design);
  // This promise belongs to the long-lived single-instance Node process, not the SSE connection.
  void executeStudioRun(run.runId,run.threadId,design);
  return {...run,design:studioView(design)};
}

export function studioView(design:StudioState) {
  return {
    ...design,
    preview:design.templateId?`/api/assets/templates/${design.templateId}/thumbnail.png?v=${Date.now()}`:
      design.draftId?`/api/assets/drafts/${design.draftId}/thumbnail.png?v=${Date.now()}`:'',
  };
}

async function executeStudioRun(runId:string,threadId:string,design:StudioState) {
  let answer='';
  let pendingText='';
  let pendingReasoning='';
  let lastFlush=Date.now();
  const flush=()=>{
    if(pendingText){recordStudioEvent(runId,'text',{text:pendingText});pendingText='';}
    if(pendingReasoning){recordStudioEvent(runId,'reasoning',{text:pendingReasoning});pendingReasoning='';}
    lastFlush=Date.now();
  };
  const onUpdate=(stage:string)=>{
    flush();
    saveStudioState(threadId,design);
    recordStudioEvent(runId,'progress',{stage,design:studioView(design)});
  };
  try {
    // Old images remain in SQLite, but only the latest image is sent with the current request.
    const history=getChat(threadId).slice(-12);
    const messages:Array<{role:'assistant';content:string}|{role:'user';content:string|Array<{type:'text';text:string}|{type:'file';data:string;mediaType:string}>}>=[];
    for(let index=0;index<history.length;index++) {
      const item=history[index];
      if(item.role==='assistant'){messages.push({role:'assistant',content:item.content});continue;}
      if(index===history.length-1 && item.imagePath){
        const bytes=await referenceBytes(item.imagePath);
        messages.push({role:'user',content:[
          {type:'text',text:item.content},
          {type:'file',data:bytes.toString('base64'),mediaType:item.imagePath.endsWith('.png')?'image/png':item.imagePath.endsWith('.webp')?'image/webp':'image/jpeg'},
        ]});
      }else messages.push({role:'user',content:item.content});
    }
    recordStudioEvent(runId,'progress',{stage:'Agent 正在理解需求',design:studioView(design)});
    const agentStarted=Date.now();
    const output=await designStudioAgent(design,onUpdate,runId,/整体|整张|全部|彻底|从头|重构|重新设计/.test(history.at(-1)?.content||'')).stream(messages,{maxSteps:7,toolCallConcurrency:1});
    for await(const raw of output.fullStream){
      const chunk=raw as {type:string;payload?:{text?:string;toolName?:string;toolCallId?:string;error?:unknown;usage?:unknown};textDelta?:string};
      if(chunk.type==='text-delta'){
        const text=chunk.payload?.text||chunk.textDelta||'';
        answer+=text;pendingText+=text;
        if(pendingText.length>=20 || Date.now()-lastFlush>80)flush();
      }else if(chunk.type==='reasoning-delta'){
        pendingReasoning+=chunk.payload?.text||'';
        if(pendingReasoning.length>=45 || Date.now()-lastFlush>120)flush();
      }else if(chunk.type==='tool-call'){
        flush();
        recordStudioEvent(runId,'tool',{toolName:chunk.payload?.toolName||'tool',callId:chunk.payload?.toolCallId||'',status:'running'});
      }else if(chunk.type==='tool-result'){
        flush();
        saveStudioState(threadId,design);
        recordStudioEvent(runId,'tool',{toolName:chunk.payload?.toolName||'tool',callId:chunk.payload?.toolCallId||'',status:'completed',design:studioView(design)});
      }else if(chunk.type==='error'){
        throw new Error(chunk.payload?.error instanceof Error?chunk.payload.error.message:String(chunk.payload?.error||'模型流式请求失败'));
      }
    }
    flush();
    if(output.error)throw new Error(typeof output.error==='string'?output.error:output.error instanceof Error?output.error.message:JSON.stringify(output.error));
    const usage=await output.usage;
    if(usage)recordModelUsage({runId,kind:'vision',operation:'agent-routing',modelId:getConfig('vision')?.modelId||'unknown',usage,durationMs:Date.now()-agentStarted});
    saveStudioState(threadId,design);
    finishStudioRun(runId,answer.trim() || (design.draftId?'设计已更新，请查看右侧预览。':'操作完成，请查看右侧。'),'completed');
    recordStudioEvent(runId,'finished',{status:'completed',design:studioView(design)});
  }catch(error){
    flush();
    saveStudioState(threadId,design);
    const message=error instanceof Error?error.message:String(error);
    finishStudioRun(runId,answer.trim(),'failed',message);
    recordStudioEvent(runId,'finished',{status:'failed',error:message,design:studioView(design)});
    console.error('Studio Agent run failed:',message);
  }
}
