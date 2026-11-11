import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles, LayoutTemplate, FileSpreadsheet, SlidersHorizontal, Boxes, WandSparkles } from 'lucide-react';
import './globals.css';

export const metadata: Metadata={title:'AI Design · 智能海报工作台',description:'AI 生图、图片转 HTML 模板与 Excel 海报填充'};
const nav=[{href:'/create',name:'AI 创作',icon:WandSparkles},{href:'/templates',name:'我的模板',icon:LayoutTemplate},{href:'/posters',name:'数据填充',icon:FileSpreadsheet},{href:'/settings',name:'模型配置',icon:SlidersHorizontal}];
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="zh-CN"><body><div className="shell"><aside className="sidebar"><Link className="brand" href="/create"><div className="brandmark"><Sparkles size={21}/></div><span>AI Design</span></Link><div className="nav-label">工作空间</div><nav className="nav">{nav.map(item=><Link key={item.href} href={item.href}><item.icon size={19}/><span>{item.name}</span></Link>)}</nav><div className="sidebar-bottom"><Boxes size={21} color="#afa4ff"/><strong>Design Intelligence</strong>从一张图片开始，让每一张营销海报都能重复使用。</div></aside><main className="main">{children}</main></div></body></html>;
}
