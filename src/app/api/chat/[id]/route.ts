import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getChat,deleteChat } from '@/lib/storage';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
type Context={params:Promise<{id:string}>};
export const GET=withErrors(async(_request:Request,{params}:Context)=>{
  const id=z.string().uuid().parse((await params).id);
  return NextResponse.json({messages:getChat(id)});
});
export const DELETE=withErrors(async(_request:Request,{params}:Context)=>{
  const id=z.string().uuid().parse((await params).id);
  deleteChat(id);
  return NextResponse.json({success:true});
});
