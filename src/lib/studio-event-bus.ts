import type { StudioEvent } from '@/types';

// The application intentionally runs as one persistent Node process.
// Events are written to SQLite first; subscribers only receive the live copy.
const listeners=new Map<string,Set<(event:StudioEvent)=>void>>();

export function subscribeStudioRun(runId:string,listener:(event:StudioEvent)=>void) {
  const current=listeners.get(runId)||new Set<(event:StudioEvent)=>void>();
  current.add(listener);
  listeners.set(runId,current);
  return ()=>{
    current.delete(listener);
    if(current.size===0)listeners.delete(runId);
  };
}
export function broadcastStudioEvent(event:StudioEvent) {
  for(const listener of listeners.get(event.runId)||[])listener(event);
}
