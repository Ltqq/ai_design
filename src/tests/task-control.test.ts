import { describe,expect,it } from 'vitest';
import { registerStudioRun,releaseStudioRun,stopStudioRun,withTemplateMutation } from '../lib/task-control';

describe('真实任务控制',()=>{
  it('停止信号传递给运行中的任务',()=>{
    const controller=new AbortController();
    registerStudioRun('cancel-test',controller);
    expect(stopStudioRun('cancel-test')).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    releaseStudioRun('cancel-test');
    expect(stopStudioRun('cancel-test')).toBe(false);
  });
  it('同一模板拒绝重叠修改，但不影响其他模板',async()=>{
    let release!:()=>void;
    const first=withTemplateMutation('a',()=>new Promise<void>(resolve=>{release=resolve}));
    await expect(withTemplateMutation('a',async()=>{})).rejects.toThrow('正在被修改');
    await withTemplateMutation('b',async()=>{});
    release();
    await first;
    await withTemplateMutation('a',async()=>{});
  });
});
