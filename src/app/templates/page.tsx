'use client';
import { SegmentedControl, TextInput, Textarea } from '@mantine/core';
import { ActionButton } from '@/components/ui';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { LayoutTemplate,Copy,Trash2,Pencil,ArrowUpRight,RotateCcw,Plus,CheckCircle2,Info,X,Grid2X2 } from 'lucide-react';
import { Heading,Loading,readJSON } from '@/components/ui';
import type { TemplateRecord, TemplateVersion } from '@/types';
export default function TemplatesPage(){
  const [items,setItems]=useState<TemplateRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [versions,setVersions]=useState<TemplateVersion[]>([]);
  const [revisionMode,setRevisionMode]=useState<'patch'|'redesign'>('patch');
  const [selected,setSelected]=useState<TemplateRecord|null>(null),[rename,setRename]=useState(''),[instruction,setInstruction]=useState(''),[busy,setBusy]=useState(''),[success,setSuccess]=useState('');
  const reload=async()=>{const data=await readJSON(await fetch('/api/templates',{cache:'no-store'}));setItems(data.templates.map((item:TemplateRecord)=>({...item,thumbnail:`${item.thumbnail}?v=${Date.now()}`})));};
  useEffect(()=>{reload().catch(err=>setError(err.message)).finally(()=>setLoading(false))},[]);
  const open=(item:TemplateRecord)=>{
    setSelected(item);setRename(item.name);setInstruction('');setRevisionMode('patch');setError('');
    void fetch(`/api/templates/${item.id}/versions`).then(readJSON).then(data=>setVersions(data.versions)).catch(e=>setError(e.message));
  };
  const apply=async(item:TemplateRecord,action:'copy'|'rename'|'delete'|'revise',value='')=>{
    setBusy(action);setError('');setSuccess('');
    try{
      if(action==='delete')await readJSON(await fetch(`/api/templates/${item.id}`,{method:'DELETE'}));
      if(action==='rename'||action==='copy')await readJSON(await fetch(`/api/templates/${item.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:value||item.name,action})}));
      if(action==='revise')await readJSON(await fetch(`/api/templates/${item.id}/revise`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction:value,mode:revisionMode})}));
      await reload();setSelected(null);setInstruction('');
      setSuccess(action==='copy'?'模板已复制':action==='rename'?'名称已更新':action==='delete'?'模板已删除':'AI 修改完成，模板已更新');
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  const restore=async(version:TemplateVersion)=>{
    if(!selected||!confirm(`确定恢复 ${new Date(version.createdAt).toLocaleString('zh-CN')} 的版本？当前版本会自动备份。`))return;
    setBusy('restore');setError('');
    try{
      await readJSON(await fetch(`/api/templates/${selected.id}/versions`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({versionId:version.id})}));
      await reload();setSelected(null);setSuccess('历史版本已恢复，恢复前的设计也已保留');
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  return <>
    <Heading eyebrow="DESIGN LIBRARY" title="你的专属海报模板库" description="好的设计只需创作一次。管理、复制或用 AI 微调模板，下一次直接填表生成。" aside={<Link className="btn primary" href="/create"><Plus size={16}/>创作新模板</Link>}/>
    <div className="hero-tip"><Grid2X2 size={22}/><div><strong>设计资产，重复利用</strong>所有模板保存在本机。更换 Excel 模型名称和折扣时，不会再次调用 AI，直接生成新海报。</div></div>
    {success&&<p className="notice success" style={{marginBottom:20}}><CheckCircle2 size={16}/>{success}</p>}{error&&!selected&&<p className="notice error" style={{marginBottom:20}}><Info size={16}/>{error}</p>}
    {loading?<Loading text="正在读取模板…"/>:<div className="template-grid">{!items.length?<div className="empty"><LayoutTemplate size={36}/><h2>还没有可用模板</h2><p>先上传一张喜欢的海报，或者让 AI 帮你生成第一张。</p><Link className="btn primary" href="/create"><Plus size={16}/>创建第一个模板</Link></div>:items.map(item=><article className="template-card" key={item.id}><div className="thumb"><img src={item.thumbnail} alt={`${item.name} 缩略图`}/></div><div className="detail"><strong>{item.name}</strong><p>{item.width} × {item.height} · {new Date(item.createdAt).toLocaleDateString('zh-CN')}</p><div className="actions"><Link className="btn primary" href={`/posters?template=${item.id}`}><ArrowUpRight size={15}/>使用</Link><ActionButton className="btn icon-button" aria-label={`编辑${item.name}`} title="重命名 / AI 修改" onClick={()=>open(item)}><Pencil size={15}/></ActionButton><ActionButton className="btn icon-button" aria-label={`复制${item.name}`} title="复制模板" onClick={()=>apply(item,'copy')} disabled={!!busy}><Copy size={15}/></ActionButton><ActionButton className="btn icon-button danger" aria-label={`删除${item.name}`} title="删除模板" onClick={()=>{if(confirm(`确定删除「${item.name}」吗？`))apply(item,'delete')}} disabled={!!busy}><Trash2 size={15}/></ActionButton></div></div></article>)}</div>}
    {selected&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-template-title" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setSelected(null)}}><section className="modal"><div className="modal-header"><h2 id="edit-template-title">修改模板</h2><ActionButton className="btn icon-button ghost" aria-label="关闭" disabled={!!busy} onClick={()=>setSelected(null)}><X size={19}/></ActionButton></div><div className="modal-preview"><img src={selected.thumbnail} alt={selected.name}/><div className="modal-meta"><strong style={{color:'white',fontSize:15}}>{selected.name}</strong><p style={{marginTop:8}}>尺寸 {selected.width} × {selected.height}</p><p>更改名称不会改变设计；默认只让 AI 生成局部代码编辑补丁并重新截图；只有整体重构才重新输出整份模板。</p></div></div><div className="modal-section"><label className="label" htmlFor="rename-template">模板名称</label><div className="actions"><TextInput id="rename-template"  style={{flex:1}} value={rename} onChange={e=>setRename(e.target.value)}/><ActionButton className="btn" disabled={!rename.trim()||!!busy} onClick={()=>apply(selected,'rename',rename)}>保存名称</ActionButton></div></div><div className="divider"/><div className="modal-section"><label className="label" htmlFor="revise-template">用自然语言修改设计</label><SegmentedControl fullWidth value={revisionMode} onChange={value=>setRevisionMode(value as 'patch'|'redesign')} data={[{label:'局部编辑 · 默认省 Token',value:'patch'},{label:'整体重构 · 高成本',value:'redesign'}]}/><Textarea id="revise-template"  value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="例如：使用更强的玻璃质感，增加立体层次，让折扣标签更醒目…" rows={4}/><div className="footer-toolbar"><ActionButton className="btn primary" disabled={!instruction.trim()||!!busy} onClick={()=>apply(selected,'revise',instruction)}><RotateCcw size={16}/>{revisionMode==='patch'?'只修改指定部分':'整体重新设计'}</ActionButton><ActionButton className="btn ghost" disabled={!!busy} onClick={()=>setSelected(null)}>取消</ActionButton></div>{busy&&<p style={{marginTop:14}}><Loading text="正在保存或重新设计，请稍候…"/></p>}{error&&<p className="notice error" style={{marginTop:14}}><Info size={15}/>{error}</p>}</div>
        <div className="modal-section"><div className="divider"/><label className="label">历史版本 · 修改前自动保留</label>
          {versions.length?<div className="stack">{versions.map(version=><div key={version.id} className="record"><div className="meta"><b>{new Date(version.createdAt).toLocaleString('zh-CN')}</b><small>HTML / CSS / 预览图片</small></div><ActionButton className="btn tiny" disabled={!!busy} onClick={()=>restore(version)}>恢复此版本</ActionButton></div>)}</div>:<p className="hint">尚无历史版本。第一次修改模板后自动保留旧版本。</p>}
        </div></section></div>}
  </>;
}
