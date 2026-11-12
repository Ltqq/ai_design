import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getModelPrices, listModelUsage, saveModelPrices } from '@/lib/model-usage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
const price=z.number().min(0).nullable();
const input=z.object({kind:z.enum(['vision','image']),inputPerMillion:price,outputPerMillion:price,cachedInputPerMillion:price,perImage:price});
export const GET=withErrors(async()=>{
  const records=listModelUsage(100);
  const priced=records.filter(item=>item.estimatedCostCny!==null);
  return NextResponse.json({records,prices:{vision:getModelPrices('vision'),image:getModelPrices('image')},
    summary:{knownCostCny:priced.reduce((sum,row)=>sum+(row.estimatedCostCny??0),0),
      unpricedCalls:records.length-priced.length,callCount:records.length,
      inputTokens:records.reduce((sum,row)=>sum+(row.inputTokens??0),0),
      outputTokens:records.reduce((sum,row)=>sum+(row.outputTokens??0),0),
      imageCount:records.reduce((sum,row)=>sum+row.imageCount,0)}});
});
export const PUT=withErrors(async(request:Request)=>{
  const {kind,...prices}=input.parse(await request.json());
  saveModelPrices(kind,prices);
  return NextResponse.json({success:true});
});
