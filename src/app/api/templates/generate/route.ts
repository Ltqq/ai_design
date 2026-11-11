import { NextResponse } from 'next/server';
import { createSchema } from '@/lib/schemas';
import { convertDesignToTemplate } from '@/lib/design-operations';
import { withErrors } from '@/lib/http';
export const runtime='nodejs';
export const maxDuration=300;
export const POST=withErrors(async(request:Request)=>{
  const {referencePath,prompt,width,height}=createSchema.parse(await request.json());
  return NextResponse.json(await convertDesignToTemplate(referencePath,prompt,width,height));
});
