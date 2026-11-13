import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { TemplateBusyError } from '@/lib/task-control';
export function withErrors<T extends unknown[]>(handler:(...args:T)=>Promise<Response>) {
  return async (...args:T):Promise<Response> => {
    try { return await handler(...args); }
    catch (error) {
      const message=error instanceof Error?error.message:'请求处理失败';
      return NextResponse.json({error:message},{status:error instanceof ZodError?400:error instanceof TemplateBusyError?409:500});
    }
  };
}
