import { describe,expect,it } from 'vitest';
import { renderPNG } from '../lib/render';
import sharp from 'sharp';
import { saveReference, dataDir } from '../lib/storage';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { TemplateSource } from '../types';
const source:TemplateSource={html:'<article><h1>{{title}}</h1></article>',css:'article{background:#191c37;color:white;width:100%;height:100%;padding:60px}',manifest:{name:'测试模板',width:640,height:800,fields:[{key:'title',label:'标题',type:'text'}],listFields:{}}};
describe('真实 Chromium 截图',()=>{
  it('生成尺寸正确的 PNG 文件',async()=>{
    const png=await renderPNG(source,{title:'自动化测试'});
    expect(png.subarray(1,4).toString()).toBe('PNG');
    const {width,height}=await sharp(png).metadata();
    expect({width,height}).toEqual({width:640,height:800});
  },30000);
  it('本地持久化装饰素材可内联渲染，PNG 不依赖外部 HTTP',async()=>{
    const image=await sharp({create:{width:8,height:8,channels:4,background:'#f02255'}}).png().toBuffer();
    const asset=await saveReference(image,'png');
    try{
      const withAsset:TemplateSource={...source,
        html:`<article><img src="${asset}" style="width:100%;height:100%;object-fit:cover"></article>`,
        css:'article{width:100%;height:100%}'};
      const png=await renderPNG(withAsset,{});
      const center=await sharp(png).extract({left:300,top:400,width:1,height:1}).raw().toBuffer();
      expect(center[0]).toBeGreaterThan(190);
      expect(center[1]).toBeLessThan(100);
    }finally{
      await rm(path.join(dataDir,'references',asset.split('/').at(-1)!));
    }
  },30000);
});
