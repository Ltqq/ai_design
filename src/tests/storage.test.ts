import { describe,expect,it } from 'vitest';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

describe('SQLite 和模板真实持久化',()=>{
  it('模板、模型表、对话和导出历史能保存及读取',async()=>{
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
      storage.replaceModels([{name:'deepseek-v4.1-flash',discount:'4折'},{name:'kimi-k3',discount:'5折'}]);
      expect(storage.getModels()[0]).toEqual({name:'deepseek-v4.1-flash',discount:'4折'});
      storage.replaceModels([{name:'glm-5.3',discount:'7折'}]);
      expect(storage.getModels()).toEqual([{name:'glm-5.3',discount:'7折'}]);
      const png=Buffer.from('example-png');
      const posterId=await storage.savePoster(png,id,2);
      expect((await storage.readPoster(posterId)).equals(png)).toBe(true);
      expect(storage.listPosters()[0]).toMatchObject({id:posterId,templateName:'修改后',modelCount:2});
      const threadId=storage.saveChatExchange(undefined,'帮我分析海报',null,'建议突出折扣。');
      expect(storage.listChats()[0].id).toBe(threadId);
      storage.saveChatExchange(threadId,'再提一个方案',null,'增加光效。');
      expect(storage.getChat(threadId).map(x=>x.content)).toEqual(['帮我分析海报','建议突出折扣。','再提一个方案','增加光效。']);
      storage.deleteChat(threadId);
      expect(storage.getChat(threadId)).toHaveLength(0);
      await storage.deleteTemplate(id);
      await storage.deleteTemplate(id2);
      expect(storage.listTemplates()).toHaveLength(0);
    }finally{await rm(dir,{recursive:true,force:true})}
  });
});
