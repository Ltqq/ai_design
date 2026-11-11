import { describe,expect,it } from 'vitest';
import { bindFields,renderHTML } from '../lib/template';
import { sourceSchema } from '../lib/schemas';
import type { TemplateSource } from '../types';

const source:TemplateSource={
  html:'<h1>{{title}}</h1><main>{{#each items}}<div class="card">{{name}}: {{discount}}</div>{{/each}}</main>',
  css:'h1{color:#abc}',
  manifest:{name:'折扣海报',width:800,height:1000,fields:[{key:'title',label:'主标题',type:'text'},{key:'items',label:'模型',type:'list'}],listFields:{items:[{key:'name',label:'模型名称'},{key:'discount',label:'折扣'}]}}
};

describe('AI 产物入口验证',()=>{
  it('拒绝 manifest 声明了字段、实际 HTML 没有折扣占位符的模板',()=>{
    const correct={html:'<section>{{#each items}}<b>{{name}} {{discount}}</b>{{/each}}</section>',css:'',manifest:{name:'模板',width:640,height:800,fields:[{key:'items',label:'模型卡片',type:'list'}],listFields:{items:[{key:'name',label:'模型名称'},{key:'discount',label:'折扣'}]}}};
    expect(sourceSchema.safeParse(correct).success).toBe(true);
    expect(sourceSchema.safeParse({...correct,html:correct.html.replace('{{discount}}','4折')}).success).toBe(false);
  });
});
describe('确定性字段填充与真实 HTML',()=>{
  it('按选中顺序填入模型名称、折扣，并转义外部文本',()=>{
    const fields=bindFields(source.manifest,{templateId:'00000000-0000-0000-0000-000000000000',models:[{name:'<script>',discount:'4折'},{name:'kimi-k3',discount:'5.7折'}],fixedFields:{title:'精选优惠'}});
    const html=renderHTML(source,fields);
    expect(html).toContain('<h1>精选优惠</h1>');
    expect(html).toContain('&lt;script&gt;: 4折');
    expect(html.indexOf('&lt;script&gt;: 4折')).toBeLessThan(html.indexOf('kimi-k3: 5.7折'));
    expect(html).toContain('width:800px;height:1000px');
  });
});
