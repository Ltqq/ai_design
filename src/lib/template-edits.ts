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
    if(edit.newText.length-edit.oldText.length>Math.max(1200,current.length*0.6))
      throw new Error('局部编辑不能一次性插入接近整份文件的新代码，请使用整体重构');
    if(edit.oldText.length>160 && edit.oldText.length>current.length*0.45)
      throw new Error('局部编辑试图替换大段源文件，请改用整体重构');
    if(first===-1 || current.indexOf(edit.oldText,first+edit.oldText.length)!==-1)
      throw new Error('局部编辑定位失败或匹配不唯一，请重新描述修改位置，或选择整体重构');
    next[edit.file]=current.slice(0,first)+edit.newText+current.slice(first+edit.oldText.length);
  }
  return sourceSchema.parse(next);
}
