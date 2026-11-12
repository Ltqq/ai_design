import { chromium } from 'playwright';
import { renderHTML } from '@/lib/template';
import { referenceBytes } from '@/lib/storage';
import type { TemplateSource } from '@/types';

export async function renderPNG(source:TemplateSource, data:Record<string,unknown>):Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: {width:source.manifest.width, height:source.manifest.height}, deviceScaleFactor: 1, javaScriptEnabled:false });
    let html=renderHTML(source,data);
    // Screenshot pages have no HTTP origin; inline only existing local reference assets.
    const assets=new Set(html.match(/\/api\/assets\/references\/[a-f0-9-]{36}\.(?:png|jpe?g|webp)/g)||[]);
    for(const asset of assets){
      const ext=asset.split('.').at(-1);
      const mime=ext==='jpg'?'jpeg':ext;
      const bytes=await referenceBytes(asset);
      html=html.replaceAll(asset,`data:image/${mime};base64,${bytes.toString('base64')}`);
    }
    await page.setContent(html,{waitUntil:'load'});
    await page.evaluate(() => document.fonts.ready);
    const screenshot = await page.screenshot({type:'png',fullPage:false});
    await page.close();
    return screenshot;
  } finally {
    await browser.close();
  }
}
