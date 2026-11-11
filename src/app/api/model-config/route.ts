import { NextResponse } from 'next/server';
import { configSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { getConfig, saveConfig } from '@/lib/storage';

export const runtime='nodejs';
export const GET=withErrors(async()=>{
  const redact=(kind:'vision'|'image')=>{
    const value=getConfig(kind);
    return value?{baseURL:value.baseURL,modelId:value.modelId,hasKey:Boolean(value.apiKey)}:null;
  };
  return NextResponse.json({vision:redact('vision'),image:redact('image')});
});
export const PUT=withErrors(async(request:Request)=>{
  const {kind,baseURL,modelId,apiKey}=configSchema.parse(await request.json());
  const key=apiKey||getConfig(kind)?.apiKey;
  if (!key) return NextResponse.json({error:'请填写 API Key'},{status:400});
  saveConfig(kind,{baseURL,modelId,apiKey:key});
  return NextResponse.json({success:true});
});
