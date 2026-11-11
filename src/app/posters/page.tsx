'use client';
import { TextInput, Textarea } from '@mantine/core';
import { ActionButton } from '@/components/ui';
import { useEffect,useMemo,useState,Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Download,FileSpreadsheet,ArrowUp,ArrowDown,Image as ImageIcon, Search, CheckCircle2, RefreshCw, Plus, Clock3, ArrowRight, FileDown, Info } from 'lucide-react';
import { Heading,Panel,Loading,Placeholder,readJSON } from '@/components/ui';
import type { Manifest,ModelDiscount,PosterRecord,TemplateRecord } from '@/types';

function Editor(){
  const params=useSearchParams();
  const [templates,setTemplates]=useState<TemplateRecord[]>([]),[templateId,setTemplateId]=useState(params.get('template')||'');
  const [manifest,setManifest]=useState<Manifest|null>(null),[models,setModels]=useState<ModelDiscount[]>([]);
  const [selected,setSelected]=useState<number[]>([]),[fixed,setFixed]=useState<Record<string,string>>({title:'热门模型 · 限时优惠',subtitle:'精选优质 AI 模型，超值折扣'});
  const [preview,setPreview]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[filter,setFilter]=useState('');
  const [history,setHistory]=useState<PosterRecord[]>([]);\n  const [ready,setReady]=useState(false);
  const visible=useMemo(()=>models.map((model,index)=>({...model,index})).filter(model=>model.name.toLowerCase().includes(filter.toLowerCase())),[models,filter]);
  const selectedModels=selected.map(index=>models[index]);
  const singles=manifest?.fields.filter(field=>field.type!=='list')||[];
  const reloadHistory=()=>fetch('/api/posters/render').then(readJSON).then(result=>setHistory(result.posters));
  useEffect(()=>{
    Promise.all([fetch('/api/templates').then(readJSON),fetch('/api/excel/import').then(readJSON),fetch('/api/posters/render').then(readJSON),fetch('/api/posters/draft').then(readJSON)])
      .then(([a,b,c,d])=>{
        const saved=d.draft;
        setTemplates(a.templates);setModels(b.models);setHistory(c.posters);
        const indices=saved?.selectedNames?.map((name:string)=>b.models.findIndex((model:ModelDiscount)=>model.name===name)).filter((index:number)=>index>=0) as number[]|undefined;
        setSelected(indices??b.models.map((_:ModelDiscount,i:number)=>i).slice(0,4));
        if(saved?.fixedFields)setFixed(saved.fixedFields);
        setTemplateId(params.get('template')||saved?.templateId||a.templates[0]?.id||'');
        setReady(true);
      }).catch(e=>setError(e.message));
  },[params]);
  useEffect(()=>{
    if(!ready)return;
    const timer=setTimeout(()=>{
      void fetch('/api/posters/draft',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId,selectedNames:selected.map(index=>models[index].name),fixedFields:fixed})})
        .then(readJSON).catch(e=>setError('海报编辑状态保存失败：'+e.message));
    },450);
    return()=>clearTimeout(timer);
  },[ready,templateId,models,selected,fixed]);
  useEffect(()=>{
    if(!templateId){setManifest(null);return;}
    fetch(`/api/templates/${templateId}`).then(readJSON).then(result=>{setManifest(result.manifest);setPreview('')}).catch(e=>setError(e.message));
  },[templateId]);
  const upload=async(file:File)=>{
    setBusy('正在读取并保存模型折扣表…');setError('');setSuccess('');
    try{
      const form=new FormData();form.append('file',file);
      const result=await readJSON(await fetch('/api/excel/import',{method:'POST',body:form}));
      setModels(result.models);setSelected(result.models.map((_:ModelDiscount,i:number)=>i).slice(0,4));setPreview('');
      setSuccess(`成功导入并保存 ${result.models.length} 条模型折扣，刷新页面后仍可使用。`);
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  const toggle=(index:number)=>{
    setError('');setSuccess('');setPreview('');
    setSelected(prev=>prev.includes(index)?prev.filter(v=>v!==index):prev.length<6?[...prev,index]:prev);
  };
  const move=(index:number,direction:number)=>{
    setPreview('');setSelected(prev=>{const copy=[...prev];const to=index+direction;[copy[index],copy[to]]=[copy[to],copy[index]];return copy;});
  };
  const render=async(download:boolean)=>{
    setBusy(download?'正在生成并保存 PNG 海报…':'正在渲染真实海报预览…');setError('');setSuccess('');
    try{
      const response=await fetch(`/api/posters/render${download?'?save=1':''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId,models:selectedModels,fixedFields:fixed})});
      if(!response.ok){const result=await response.json();throw new Error(result.error)}
      const blob=await response.blob();const url=URL.createObjectURL(blob);
      setPreview(old=>{if(old)URL.revokeObjectURL(old);return url});
      if(download){
        const a=document.createElement('a');a.href=url;a.download=`ai-design-${new Date().toISOString().slice(0,10)}.png`;a.click();
        await reloadHistory();setSuccess('海报已导出并保存到本地历史记录，可随时重新下载。');
      }
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  return <>
    <Heading eyebrow="POSTER GENERATOR" title="让表格，自动变成精美海报" description="固定两列：模型名称、折扣。上传一次后自动保存，选择要宣传的模型与文案，刷新也能继续编辑、预览并导出 PNG。" aside={<a className="btn" href="/api/excel/template"><FileDown size={16}/>下载 Excel 模板</a>}/>
    <div className="two-col">
      <div className="stack">
        <Panel title="选择海报模板" description="所有模板都支持按选中的模型自动填充。" aside={<Link className="inline-link" href="/templates">浏览模板库<ArrowRight size={14}/></Link>}>
          <select aria-label="选择模板" className="select" value={templateId} onChange={e=>{setTemplateId(e.target.value);setPreview('')}}><option value="">请选择模板</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name} · {t.width} × {t.height}</option>)}</select>
          {!templates.length&&<p className="hint">还没有可用模板。<Link className="inline-link" href="/create">先创建一个<ArrowRight size={13}/></Link></p>}
          {manifest&&<div className="chips" style={{marginTop:14}}><span className="chip">{manifest.width} × {manifest.height}</span><span className="chip highlight">自动绑定 name / discount</span></div>}
        </Panel>
        <Panel title="导入模型折扣" description="第一列「模型名称」，第二列「折扣」，例如 deepseek-v4.1-flash / 4折。" aside={<span className="pill"><CheckCircle2 size={13}/>{models.length} 条已保存</span>}>
          <label className="dropzone" style={{padding:'23px 12px'}}><FileSpreadsheet size={25}/><b>{models.length?'上传新表，替换当前模型数据':'点击上传模型折扣 Excel'}</b><small>仅支持 .xlsx · 最大 10 MB · 数据自动保存在本机</small><input type="file" accept=".xlsx" hidden onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/></label>
          <div className="actions" style={{justifyContent:'space-between',marginTop:12}}><span className="hint">只读取两列原始文字，不计算价格或折扣。</span><a className="inline-link" href="/api/excel/template">下载示例表格<Download size={13}/></a></div>
        </Panel>
        <Panel title="挑选宣传模型" description="最多 6 个。选中顺序就是海报展示顺序，折扣值原样填充。" aside={<span className="chip highlight">已选 {selected.length} / 6</span>}>
          {models.length?<><div style={{position:'relative'}}><Search size={17} style={{position:'absolute',left:13,top:13,color:'#8195b2'}}/><TextInput  style={{paddingLeft:39}} placeholder="搜索模型名称…" value={filter} onChange={e=>setFilter(e.target.value)}/></div><div className="model-select-list">{visible.map(item=><label className={`model-option ${selected.includes(item.index)?'selected':''}`} key={item.index}><input type="checkbox" checked={selected.includes(item.index)} onChange={()=>toggle(item.index)} disabled={!selected.includes(item.index)&&selected.length>=6}/><span className="model-name">{item.name}</span><span className="discount">{item.discount}</span></label>)}{!visible.length&&<div className="empty-row">没有匹配的模型</div>}</div><div className="divider"/><div className="stat-inline"><span>已选中的排列顺序</span><span>使用箭头调整</span></div><div className="selection-list">{selected.map((id,index)=><div className="selection-item" key={id}><strong>{index+1}. {models[id].name}</strong><button aria-label="上移" disabled={!index} onClick={()=>move(index,-1)}><ArrowUp size={12}/></button><button aria-label="下移" disabled={index===selected.length-1} onClick={()=>move(index,1)}><ArrowDown size={12}/></button></div>)}</div></>:<div className="empty-row"><FileSpreadsheet size={27} style={{marginBottom:11,color:'#a89bff'}}/><p>导入 Excel 后，在这里选择你想宣传的模型。</p></div>}
        </Panel>
        {manifest&&<Panel title="海报文案" description="这部分是模板上的固定文字，不来自 Excel。">{singles.map(field=><div key={field.key}><label className="label">{field.label}</label>{field.type==='image'?<input type="file" accept="image/*" className="input" onChange={e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{setFixed(prev=>({...prev,[field.key]:String(reader.result)}));setPreview('')};reader.readAsDataURL(file)}}/>:<TextInput  value={fixed[field.key]||''} onChange={e=>{setFixed(prev=>({...prev,[field.key]:e.target.value}));setPreview('')}} placeholder={`填写${field.label}`}/>}</div>)}</Panel>}
        {busy&&<div className="notice"><Loading text={busy}/></div>}{error&&<div className="notice error"><Info size={16}/>{error}</div>}{success&&<div className="notice success"><CheckCircle2 size={16}/>{success}</div>}
      </div>
      <div className="stack sticky-preview"><Panel><div className="preview-top"><h2>海报预览</h2><span className="chip">{manifest?`${manifest.width} × ${manifest.height} px`:'PNG'}</span></div><div className="preview studio-preview">{preview?<img src={preview} alt="本次填充后的完整海报"/>:templateId?<img src={`/api/assets/templates/${templateId}/thumbnail.png`} alt="当前模板参考预览"/>:<Placeholder text="先选一个海报模板。之后选模型、填充数据，就能看到你的宣传海报。" href="/create" action="创建模板"/>}</div><div className="preview-caption"><span>{preview?'当前数据的真实渲染结果':'模板效果展示 · 尚未填充当前数据'}</span><span>{selected.length} 个模型</span></div><div className="footer-toolbar"><ActionButton className="btn" style={{flex:1}} disabled={!manifest||!selected.length||!!busy} onClick={()=>render(false)}><RefreshCw size={16}/>更新预览</ActionButton><ActionButton className="btn primary" style={{flex:1}} disabled={!manifest||!selected.length||!!busy} onClick={()=>render(true)}><Download size={16}/>导出并保存 PNG</ActionButton></div></Panel>
        <Panel title="最近导出" description="生成过的海报保留在本地，刷新页面也能重新下载。" aside={<Clock3 size={17} color="#91a0b9"/>}><div className="record-list">{history.length?history.slice(0,5).map(record=><div className="record" key={record.id}><img src={`/api/posters/history/${record.id}`} alt={record.templateName}/><div className="meta"><b>{record.templateName}</b><small>{new Date(record.createdAt).toLocaleString('zh-CN')} · {record.modelCount} 个模型</small></div><a className="btn tiny" href={`/api/posters/history/${record.id}`} download={`poster-${record.id}.png`}><Download size={14}/>下载</a></div>):<div className="empty-row">尚无导出记录，首次导出后会自动保存。</div>}</div></Panel>
      </div>
    </div>
  </>;
}
export default function PostersPage(){return <Suspense fallback={<Loading text="加载海报工作台…"/>}><Editor/></Suspense>}
