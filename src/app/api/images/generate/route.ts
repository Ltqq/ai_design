import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateDesignImage } from '@/lib/design-operations';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const POST=withErrors(async(request:Request)=>{
  const {prompt}=z.object({prompt:z.string().min(3)}).parse(await request.json());
  const referencePath=await generateDesignImage(prompt);
  return NextResponse.json({referencePath});
});
