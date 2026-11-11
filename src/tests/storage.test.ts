import { describe,expect,it } from 'vitest';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

describe('模板本地真实落盘',()=>{
  it('保存、重命名、复制、删除模板',async()=>{
    const dir=await mkdtemp(path.join(os.tmpdir(),'ai-design-test-'));
    process.env.AI_DESIGN_DATA_DIR=dir;
    const storage=await import('../lib/storage');
    const draftId=randomUUID();
    const source={html:'<h1>{{title}}</h1>',css:'h1{color:white}',manifest:{name:'原稿',width:640,height:800,fields:[{key:'title',label:'标题',type:'text' as const}],listFields:{}}};
    try{
      await storage.writeSource('drafts',draftId,source,Buffer.from('png'));
      const id=await storage.saveDraft(draftId,'测试');
      expect(storage.listTemplates().length).toBe(1);
      expect((await storage.readSource('templates',id)).html).toBe(source.html);
      storage.renameTemplate(id,'修改后');
      expect(storage.listTemplates()[0].name).toBe('修改后');
      const id2=await storage.duplicateTemplate(id);
      expect(storage.listTemplates()).toHaveLength(2);
      await storage.deleteTemplate(id);
      await storage.deleteTemplate(id2);
      expect(storage.listTemplates()).toHaveLength(0);
    }finally{await rm(dir,{recursive:true,force:true})}
  });
});
