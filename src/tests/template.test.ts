import { describe,expect,it } from 'vitest';
import { bindFields,renderHTML } from '../lib/template';
import { sourceSchema } from '../lib/schemas';
import { applyTemplateEdits } from '../lib/template-edits';
import { writeFile,stat } from 'node:fs/promises';
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

describe('局部 HTML/CSS 编辑',()=>{
  const source={html:'<div>{{#each items}}<b>{{name}} <em class="discount">{{discount}}</em></b>{{/each}}</div>',
    css:'.discount{color:purple;} .title{font-size:30px;}',manifest:{name:'示例',width:640,height:800,fields:[{key:'items' as const,label:'模型',type:'list' as const}],listFields:{items:[{key:'name',label:'模型名称'},{key:'discount',label:'折扣'}]}}};
  it('仅替换目标 CSS，其余 HTML/manifest 保持完全一致',()=>{
    const result=applyTemplateEdits(source,[{file:'css',oldText:'color:purple',newText:'color:orange'}]);
    expect(result.css).toContain('color:orange');
    expect(result.css).toContain('font-size:30px');
    expect(result.html).toEqual(source.html);
    expect(result.manifest).toEqual(source.manifest);
  });
  it('拒绝模糊或重复匹配，避免修改无关元素',()=>{
    expect(()=>applyTemplateEdits(source,[{file:'css',oldText:'color:red',newText:'color:orange'}])).toThrow();
    expect(()=>applyTemplateEdits({...source,css:'color:red;color:red'},[{file:'css',oldText:'color:red',newText:'color:blue'}])).toThrow();
  });
  it('拒绝以局部编辑名义重写大段源文件',()=>{
    const css='.card{color:red;padding:10px;box-shadow:0 10px 30px black;}\n'.repeat(12);
    expect(()=>applyTemplateEdits({...source,css},[{file:'css',oldText:css,newText:css.replace('red','blue')}])).toThrow('大段源文件');
  });
  it('拒绝用小片段替换为整份巨大 CSS 以绕过局部编辑',()=>{
    const hugeCSS='.unrelated{background:linear-gradient(#111,#222);}'.repeat(110);
    expect(()=>applyTemplateEdits(source,[{file:'css',oldText:'color:purple',newText:hugeCSS}])).toThrow('局部编辑不能');
  });
  it('拒绝删除模型与折扣动态字段的补丁',()=>{
    expect(()=>applyTemplateEdits(source,[{file:'html',oldText:'{{discount}}',newText:'4折'}])).toThrow();
  });
});

describe('可复用 SVG 视觉元件',()=>{
  it('通过本地 Lucide 图标 helper 渲染静态 SVG，避免外部脚本',()=>{
    const iconSource={...source,html:'<div>{{{icon "sparkles"}}}{{#each items}}<b>{{name}} {{discount}}</b>{{/each}}</div>'};
    const html=renderHTML(iconSource,{items:[{name:'kimi-k3',discount:'6折'}]});
    expect(html).toContain('<svg');
    expect(html).toContain('kimi-k3');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('https://');
  });
});
