import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getModelPrices, listModelUsage, getModelUsageSummary, saveModelPrices } from '@/lib/model-usage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
const price=z.number().min(0).nullable();
const input=z.object({kind:z.enum(['vision','image']),inputPerMillion:price,outputPerMillion:price,cachedInputPerMillion:price,perImage:price});
export const GET=withErrors(async()=>{
  const records=listModelUsage(100);
  return NextResponse.json({records,prices:{vision:getModelPrices('vision'),image:getModelPrices('image')},
    summary:getModelUsageSummary()
});
export const PUT=withErrors(async(request:Request)=>{
  const {kind,...prices}=input.parse(await request.json());
  saveModelPrices(kind,prices);
  return NextResponse.json({success:true});
});
