import { describe,expect,it } from 'vitest';
import { bindFields,renderHTML } from '../lib/template';
import type { TemplateSource } from '../types';

const source:TemplateSource={
  html:'<h1>{{title}}</h1><main>{{#each items}}<div class="card">{{name}}: {{price}}</div>{{/each}}</main>',
  css:'h1{color:#abc}',
  manifest:{name:'报价海报',width:800,height:1000,fields:[{key:'title',label:'主标题',type:'text'},{key:'items',label:'模型',type:'list'}],listFields:{items:[{key:'name',label:'模型名称'},{key:'price',label:'展示售价'}]}}
};

describe('模板绑定与真实 HTML',()=>{
  it('按选择顺序映射行，输出真实 HTML 并转义输入',()=>{
    const fields=bindFields(source.manifest,{templateId:'00000000-0000-0000-0000-000000000000',rows:[{产品:'模型A',价格:'2'},{产品:'<script>',价格:'3'}],selectedRows:[1,0],mapping:{'items.name':'产品','items.price':'价格'},fixedFields:{title:'热门模型'}});
    const html=renderHTML(source,fields);
    expect(html).toContain('<h1>热门模型</h1>');
    expect(html).toContain('&lt;script&gt;: 3');
    expect(html.indexOf('&lt;script&gt;: 3')).toBeLessThan(html.indexOf('模型A: 2'));
    expect(html).toContain('width:800px;height:1000px');
  });
});
