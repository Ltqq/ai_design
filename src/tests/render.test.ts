import { describe,expect,it } from 'vitest';
import { renderPNG } from '../lib/render';
import sharp from 'sharp';
import type { TemplateSource } from '../types';
const source:TemplateSource={html:'<article><h1>{{title}}</h1></article>',css:'article{background:#191c37;color:white;width:100%;height:100%;padding:60px}',manifest:{name:'测试模板',width:640,height:800,fields:[{key:'title',label:'标题',type:'text'}],listFields:{}}};
describe('真实 Chromium 截图',()=>{
  it('生成尺寸正确的 PNG 文件',async()=>{
    const png=await renderPNG(source,{title:'自动化测试'});
    expect(png.subarray(1,4).toString()).toBe('PNG');
    const {width,height}=await sharp(png).metadata();
    expect({width,height}).toEqual({width:640,height:800});
  },30000);
});
