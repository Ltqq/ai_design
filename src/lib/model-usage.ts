import { db, recordStudioEvent } from '@/lib/storage';
import type { ModelKind, ModelPrices, ModelUsageRecord } from '@/types';

export const emptyPrices:ModelPrices={inputPerMillion:null,outputPerMillion:null,cachedInputPerMillion:null,perImage:null};

export function getModelPrices(kind:ModelKind):ModelPrices {
  const row=db().prepare('SELECT input_per_million,output_per_million,cached_input_per_million,per_image FROM model_prices WHERE kind=?')
    .get(kind) as {input_per_million:number|null;output_per_million:number|null;cached_input_per_million:number|null;per_image:number|null}|undefined;
  return row?{inputPerMillion:row.input_per_million,outputPerMillion:row.output_per_million,cachedInputPerMillion:row.cached_input_per_million,perImage:row.per_image}:{...emptyPrices};
}
export function saveModelPrices(kind:ModelKind,prices:ModelPrices) {
  db().prepare('INSERT INTO model_prices(kind,input_per_million,output_per_million,cached_input_per_million,per_image) VALUES(?,?,?,?,?) ON CONFLICT(kind) DO UPDATE SET input_per_million=excluded.input_per_million,output_per_million=excluded.output_per_million,cached_input_per_million=excluded.cached_input_per_million,per_image=excluded.per_image')
    .run(kind,prices.inputPerMillion,prices.outputPerMillion,prices.cachedInputPerMillion,prices.perImage);
}
function numberOrNull(value:unknown):number|null {return typeof value==='number'&&Number.isFinite(value)?value:null}

/** Preserve unknown provider usage as null: do not invent free calls or cache hits. */
export function normalizeModelUsage(value:unknown) {
  const usage=(value&&typeof value==='object'?value:{}) as Record<string,unknown>;
  const inputDetails=(usage.inputTokenDetails&&typeof usage.inputTokenDetails==='object'?usage.inputTokenDetails:{}) as Record<string,unknown>;
  const outputDetails=(usage.outputTokenDetails&&typeof usage.outputTokenDetails==='object'?usage.outputTokenDetails:{}) as Record<string,unknown>;
  return {
    inputTokens:numberOrNull(usage.inputTokens),
    outputTokens:numberOrNull(usage.outputTokens),
    cacheReadTokens:numberOrNull(inputDetails.cacheReadTokens),
    reasoningTokens:numberOrNull(outputDetails.reasoningTokens),
  };
}
export type RecordModelUsageInput={
  runId?:string;kind:ModelKind;operation:string;modelId:string;usage?:unknown;imageCount?:number;durationMs:number;
};
export function recordModelUsage(input:RecordModelUsageInput):ModelUsageRecord {
  const counts=normalizeModelUsage(input.usage);
  const prices=getModelPrices(input.kind);
  const imageCount=input.imageCount??0;
  let estimatedCostCny:number|null=null;
  if(input.kind==='image'){
    if(prices.perImage!==null)estimatedCostCny=imageCount*prices.perImage;
  }else if(counts.inputTokens!==null&&counts.outputTokens!==null
      &&prices.inputPerMillion!==null&&prices.outputPerMillion!==null){
    const cached=counts.cacheReadTokens??0;
    const regular=Math.max(0,counts.inputTokens-cached);
    // If no cached tariff exists, cached tokens are conservatively valued at normal input price.
    estimatedCostCny=(regular*prices.inputPerMillion+cached*(prices.cachedInputPerMillion??prices.inputPerMillion)+counts.outputTokens*prices.outputPerMillion)/1_000_000;
  }
  const createdAt=new Date().toISOString();
  const result=db().prepare('INSERT INTO model_usage(run_id,kind,operation,model_id,input_tokens,output_tokens,cache_read_tokens,reasoning_tokens,image_count,duration_ms,estimated_cost_cny,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(input.runId||null,input.kind,input.operation,input.modelId,counts.inputTokens,counts.outputTokens,counts.cacheReadTokens,counts.reasoningTokens,imageCount,input.durationMs,estimatedCostCny,createdAt);
  const item:ModelUsageRecord={id:Number(result.lastInsertRowid),runId:input.runId||null,kind:input.kind,operation:input.operation,modelId:input.modelId,...counts,imageCount,durationMs:input.durationMs,estimatedCostCny,createdAt};
  if(input.runId)recordStudioEvent(input.runId,'usage',item);
  return item;
}
export function listModelUsage(limit=50):ModelUsageRecord[]{
  const rows=db().prepare('SELECT id,run_id,kind,operation,model_id,input_tokens,output_tokens,cache_read_tokens,reasoning_tokens,image_count,duration_ms,estimated_cost_cny,created_at FROM model_usage ORDER BY id DESC LIMIT ?')
    .all(limit) as Array<{id:number;run_id:string|null;kind:ModelKind;operation:string;model_id:string;input_tokens:number|null;output_tokens:number|null;cache_read_tokens:number|null;reasoning_tokens:number|null;image_count:number;duration_ms:number;estimated_cost_cny:number|null;created_at:string}>;
  return rows.map(row=>({id:row.id,runId:row.run_id,kind:row.kind,operation:row.operation,modelId:row.model_id,inputTokens:row.input_tokens,outputTokens:row.output_tokens,cacheReadTokens:row.cache_read_tokens,reasoningTokens:row.reasoning_tokens,imageCount:row.image_count,durationMs:row.duration_ms,estimatedCostCny:row.estimated_cost_cny,createdAt:row.created_at}));
}

export function getModelUsageSummary(){
  const row=db().prepare('SELECT COUNT(*) AS callCount, COALESCE(SUM(input_tokens),0) AS inputTokens, COALESCE(SUM(output_tokens),0) AS outputTokens, COALESCE(SUM(image_count),0) AS imageCount, COALESCE(SUM(estimated_cost_cny),0) AS knownCostCny, COUNT(*)-COUNT(estimated_cost_cny) AS unpricedCalls FROM model_usage')
    .get() as {callCount:number;inputTokens:number;outputTokens:number;imageCount:number;knownCostCny:number;unpricedCalls:number};
  return row;
}
