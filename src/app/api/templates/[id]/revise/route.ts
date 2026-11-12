import { NextResponse } from 'next/server';
import { z } from 'zod';
import { reviseSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { reviseDesignTemplate } from '@/lib/design-operations';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=withErrors(async(request:Request,{params}:{params:Promise<{id:string}>})=>{
  const id=z.string().uuid().parse((await params).id);
  const {instruction,mode}=reviseSchema.extend({mode:z.enum(['patch','redesign']).default('patch')}).parse(await request.json());
  await reviseDesignTemplate('templates',id,instruction,undefined,mode);
  return NextResponse.json({success:true});
});
