'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutTemplate, FileSpreadsheet, SlidersHorizontal, WandSparkles, MessageSquareText, Sparkles, ArrowUpRight, HardDrive } from 'lucide-react';
import type { ReactNode } from 'react';

const nav=[
  {href:'/create',name:'AI 创作',desc:'图片转模板',icon:WandSparkles},
  {href:'/templates',name:'模板库',desc:'设计资产',icon:LayoutTemplate},
  {href:'/posters',name:'海报生成',desc:'Excel 数据填充',icon:FileSpreadsheet},
  {href:'/chat',name:'模型对话',desc:'创意与图片讨论',icon:MessageSquareText},
];
export function Shell({children}:{children:ReactNode}) {
  const pathname=usePathname();
  const current=[...nav,{href:'/settings',name:'模型设置'}].find(v=>pathname.startsWith(v.href));
  return <div className="shell">
    <aside className="sidebar">
      <Link className="brand" href="/create"><span className="brandmark"><Sparkles size={21}/></span><span className="brand-copy"><strong>AI Design</strong><small>CREATIVE STUDIO</small></span></Link>
      <div className="nav-label">创作空间</div>
      <nav className="nav" aria-label="主导航">{nav.map(item=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?'active':''}><item.icon size={19} strokeWidth={1.8}/><span>{item.name}<small>{item.desc}</small></span>{pathname.startsWith(item.href)&&<span className="nav-dot"/>}</Link>)}</nav>
      <div className="sidebar-separator"/>
      <div className="nav-label">偏好设置</div>
      <nav className="nav"><Link href="/settings" className={pathname.startsWith('/settings')?'active':''}><SlidersHorizontal size={19} strokeWidth={1.8}/><span>模型设置<small>API 接口配置</small></span></Link></nav>
      <div className="sidebar-bottom"><div className="footer-icon"><HardDrive size={18}/></div><div><strong>本地数据 · 持久保存</strong><p>模板、模型表和历史记录保存在当前服务器。</p></div><Link href="/settings" aria-label="查看模型配置"><ArrowUpRight size={16}/></Link></div>
    </aside>
    <div className="app-area"><header className="topbar"><div className="crumb"><span>工作空间</span><span className="crumb-divider">/</span><b>{current?.name||'AI Design'}</b></div><div className="topbar-right"><span className="status-dot"/>内部创意工作台</div></header><main className="main">{children}</main></div>
  </div>;
}
