import { z } from 'zod';
import { sourceSchema } from '@/lib/schemas';
import type { TemplateSource } from '@/types';

export const editInstructionsSchema=z.object({
  edits:z.array(z.object({
    file:z.enum(['html','css']),
    oldText:z.string().min(1),
    newText:z.string(),
  })).min(1).max(12),
});

/** Only apply exact unique source replacements. Ambiguous edits must not silently alter other elements. */
export function applyTemplateEdits(source:TemplateSource, edits:z.infer<typeof editInstructionsSchema>['edits']):TemplateSource {
  const next={...source};
  for(const edit of edits){
    const current=next[edit.file];
    const first=current.indexOf(edit.oldText);
    if(first===-1 || current.indexOf(edit.oldText,first+edit.oldText.length)!==-1)
      throw new Error('局部编辑定位失败或匹配不唯一，请重新描述修改位置，或选择整体重构');
    next[edit.file]=current.slice(0,first)+edit.newText+current.slice(first+edit.oldText.length);
  }
  return sourceSchema.parse(next);
}
