import { NextResponse } from 'next/server';
import { reviseSchema } from '@/lib/schemas';
import { withErrors } from '@/lib/http';
import { reviseDesignTemplate } from '@/lib/design-operations';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=withErrors(async(request:Request,{params}:{params:Promise<{id:string}>})=>{
  const {id}=await params;
  const {instruction}=reviseSchema.parse(await request.json());
  const result=await reviseDesignTemplate('drafts',id,instruction);
  return NextResponse.json({draftId:id,...result});
});
