'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { LayoutTemplate,Copy,Trash2,Pencil,ArrowUpRight,RotateCcw } from 'lucide-react';
import { Heading,Panel,Loading,readJSON } from '@/components/ui';
import type { TemplateRecord } from '@/types';
export default function TemplatesPage(){
  const [items,setItems]=useState<TemplateRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState<TemplateRecord|null>(null),[instruction,setInstruction]=useState(''),[busy,setBusy]=useState('');
  const reload=async()=>{const data=await readJSON(await fetch('/api/templates',{cache:'no-store'}));setItems(data.templates);};
  useEffect(()=>{reload().catch(err=>setError(err.message)).finally(()=>setLoading(false))},[]);
  const apply=async(item:TemplateRecord,action:'copy'|'rename'|'delete'|'revise',value='')=>{
    setBusy(item.id);setError('');
    try{
      if(action==='delete') await readJSON(await fetch(`/api/templates/${item.id}`,{method:'DELETE'}));
      if(action==='rename'||action==='copy') await readJSON(await fetch(`/api/templates/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:value||item.name,action})}));
      if(action==='revise') await readJSON(await fetch(`/api/templates/${item.id}/revise`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction:value})}));
      await reload();setSelected(null);setInstruction('');
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  return <><Heading eyebrow="YOUR COLLECTION" title="我的模板库" description="每一次 AI 设计都会沉淀为可重复使用的模板。更换 Excel 数据，不必重新生成设计。"/>
    {loading?<Loading text="加载模板中…"/>:<div className="template-grid">{items.length===0?<div className="empty"><LayoutTemplate size={36}/><h2>还没有模板</h2><p>先从一张图片开始创作。</p><Link className="btn primary" href="/create">创建第一个模板</Link></div>:items.map(item=><div key={item.id} className="template-card"><div className="thumb"><img src={`${item.thumbnail}?t=${Date.now()}`} alt={item.name}/></div><div className="detail"><strong>{item.name}</strong><p className="muted small">{item.width} × {item.height} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</p><div className="actions"><Link className="btn primary" href={`/posters?template=${item.id}`}>使用 <ArrowUpRight size={14}/></Link><button className="btn" title="复制" onClick={()=>apply(item,'copy')} disabled={!!busy}><Copy size={15}/></button><button className="btn" title="重命名和 AI 修改" onClick={()=>setSelected(item)}><Pencil size={15}/></button><button className="btn danger" title="删除模板" onClick={()=>confirm(`删除「${item.name}」？`)&&apply(item,'delete')} disabled={!!busy}><Trash2 size={15}/></button></div></div></div>)}</div>}
    {selected&&<div style={{marginTop:24,maxWidth:660}}><Panel title={`编辑 · ${selected.name}`}><label className="label">重命名</label><div className="actions"><input className="input" id="rename" defaultValue={selected.name} style={{flex:1}}/><button className="btn" disabled={!!busy} onClick={()=>apply(selected,'rename',(document.getElementById('rename') as HTMLInputElement).value)}>保存名称</button></div><div className="divider"/><label className="label">用自然语言修改设计</label><textarea className="textarea" value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="例如：主标题加大，模型卡片更具立体感"/><div className="actions"><button className="btn primary" disabled={!instruction.trim()||!!busy} onClick={()=>apply(selected,'revise',instruction)}><RotateCcw size={15}/> 重新生成模板</button><button className="btn ghost" onClick={()=>setSelected(null)}>取消</button></div>{busy&&<Loading text="模板处理中…"/>}</Panel></div>}
    {error&&<p className="notice error">{error}</p>}
  </>;
}
