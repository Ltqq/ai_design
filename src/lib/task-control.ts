const activeRuns = new Map<string, AbortController>();
const activeTemplates = new Set<string>();

export class TemplateBusyError extends Error {}

export function registerStudioRun(id: string, controller: AbortController) {
  activeRuns.set(id, controller);
}

export function releaseStudioRun(id: string) {
  activeRuns.delete(id);
}

export function stopStudioRun(id: string) {
  const controller = activeRuns.get(id);
  if (!controller) return false;
  controller.abort(new Error('用户已停止生成'));
  return true;
}

export async function withTemplateMutation<T>(id: string, operation: () => Promise<T>): Promise<T> {
  if (activeTemplates.has(id)) throw new TemplateBusyError('模板正在被修改，请完成或停止当前任务后再操作');
  activeTemplates.add(id);
  try {
    return await operation();
  } finally {
    activeTemplates.delete(id);
  }
}
