'use client';
import { useEffect,useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Download,FileSpreadsheet,Check,ArrowUp,ArrowDown,Image as ImageIcon } from 'lucide-react';
import { Heading,Panel,Loading,Placeholder,readJSON } from '@/components/ui';
import type { Manifest,Mapping,SheetData,TemplateRecord } from '@/types';

function Editor(){
  const params=useSearchParams();
  const [templates,setTemplates]=useState<TemplateRecord[]>([]),[templateId,setTemplateId]=useState(params.get('template')||'');
  const [manifest,setManifest]=useState<Manifest|null>(null),[sheets,setSheets]=useState<SheetData[]>([]),[sheetIndex,setSheetIndex]=useState(0);
  const [selected,setSelected]=useState<number[]>([]),[mapping,setMapping]=useState<Mapping>({}),[fixed,setFixed]=useState<Record<string,string>>({});
  const [preview,setPreview]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const sheet=sheets[sheetIndex];
  useEffect(()=>{fetch('/api/templates').then(readJSON).then(data=>{setTemplates(data.templates);if(!params.get('template')&&data.templates[0])setTemplateId(data.templates[0].id)}).catch(e=>setError(e.message))},[params]);
  useEffect(()=>{if(!templateId)return;fetch(`/api/templates/${templateId}`).then(readJSON).then(data=>{setManifest(data.manifest);setMapping({});setFixed({});setPreview('')}).catch(e=>setError(e.message))},[templateId]);
  const upload=async(file:File)=>{setBusy('正在解析 Excel…');setError('');try{const form=new FormData();form.append('file',file);const result=await readJSON(await fetch('/api/excel/import',{method:'POST',body:form}));setSheets(result.sheets);setSheetIndex(0);setSelected(result.sheets[0]?.rows.map((_:unknown,i:number)=>i).slice(0,3)||[]);setPreview('')}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}};
  const changeSheet=(index:number)=>{setSheetIndex(index);setSelected(sheets[index]?.rows.map((_,i)=>i).slice(0,3)||[])};
  const updateSelected=(index:number,checked:boolean)=>setSelected(current=>checked?[...current,index]:current.filter(v=>v!==index));
  const move=(index:number,offset:number)=>setSelected(current=>{const copy=[...current],other=index+offset;if(other>=0&&other<copy.length)[copy[index],copy[other]]=[copy[other],copy[index]];return copy});
  const render=async(download:boolean)=>{
    if(!manifest||!sheet)return;
    setBusy('正在通过 Playwright 渲染海报…');setError('');
    try{
      const response=await fetch('/api/posters/render',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({templateId,rows:sheet.rows,selectedRows:selected,mapping,fixedFields:fixed})});
      if(!response.ok){const data=await response.json();throw new Error(data.error)}
      const blob=await response.blob();const url=URL.createObjectURL(blob);
      if(download){const a=document.createElement('a');a.href=url;a.download=`ai-design-${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
      else setPreview(old=>{if(old)URL.revokeObjectURL(old);return url});
    }catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy('')}
  };
  const listFields=manifest?.fields.filter(f=>f.type==='list')||[];
  const singles=manifest?.fields.filter(f=>f.type!=='list')||[];
  return <><Heading eyebrow="DATA TO DESIGN" title="Excel 数据填充" description="选择模板，导入表格，绑定你需要对外展示的字段。预览与下载使用同一套浏览器渲染逻辑。"/>
    <div className="two-col"><div className="stack"><Panel title="01 · 选择模板"><select className="select" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">请选择</option>{templates.map(item=><option key={item.id} value={item.id}>{item.name} · {item.width}×{item.height}</option>)}</select>{manifest&&<div className="chips" style={{marginTop:12}}>{manifest.fields.map(f=><span className="chip" key={f.key}>{f.label}</span>)}</div>}</Panel>
      <Panel title="02 · 导入 Excel"><label className="dropzone" style={{cursor:'pointer'}}><FileSpreadsheet size={27}/><b>上传 .xlsx 数据表</b><span className="small muted">按 Excel 实际表头读取，不预设任何价格或折扣列</span><input type="file" accept=".xlsx" hidden onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/></label>{sheets.length>0&&<><label className="label">工作表</label><select className="select" value={sheetIndex} onChange={e=>changeSheet(Number(e.target.value))}>{sheets.map((s,i)=><option value={i} key={i}>{s.name} · {s.rows.length} 行</option>)}</select><p className="small muted">勾选需要展示的行，按选择顺序作为重复卡片的数据。</p><div className="table-wrap"><table className="table"><thead><tr><th>选择</th>{sheet?.columns.map(c=><th key={c}>{c}</th>)}</tr></thead><tbody>{sheet?.rows.map((row,i)=><tr key={i}><td><input type="checkbox" checked={selected.includes(i)} onChange={e=>updateSelected(i,e.target.checked)}/></td>{sheet.columns.map(c=><td key={c}>{row[c]}</td>)}</tr>)}</tbody></table></div><div className="chips" style={{marginTop:13}}>{selected.map((id,i)=><span className="chip" key={id}>{id+2} 行 <button className="btn ghost" style={{padding:1}} disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={12}/></button><button className="btn ghost" style={{padding:1}} disabled={i===selected.length-1} onClick={()=>move(i,1)}><ArrowDown size={12}/></button></span>)}</div></>}</Panel>
      {manifest&&<Panel title="03 · 数据字段绑定">{listFields.flatMap(list=>(manifest.listFields[list.key]||[]).map(field=><div key={`${list.key}.${field.key}`}><label className="label">{list.label} / {field.label}</label><select className="select" value={mapping[`${list.key}.${field.key}`]||''} onChange={e=>setMapping(prev=>({...prev,[`${list.key}.${field.key}`]:e.target.value}))}><option value="">不填充</option>{sheet?.columns.map(column=><option key={column} value={column}>{column}</option>)}</select></div>))}{singles.map(field=><div key={field.key}><label className="label">{field.label}</label>{field.type==='image'?<input type="file" accept="image/*" className="input" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setFixed(prev=>({...prev,[field.key]:String(reader.result)}));reader.readAsDataURL(file)}}/>:<><select className="select" value={mapping[field.key]||''} onChange={e=>setMapping(prev=>({...prev,[field.key]:e.target.value}))}><option value="">手动填写</option>{sheet?.columns.map(col=><option key={col} value={col}>Excel：{col}（使用选中第一行）</option>)}</select><input className="input" style={{marginTop:8}} value={fixed[field.key]||''} onChange={e=>setFixed(prev=>({...prev,[field.key]:e.target.value}))} placeholder="可手动输入覆盖 Excel"/></>}</div>)}<div className="actions"><button className="btn primary" disabled={!sheet||!templateId||!!busy} onClick={()=>render(false)}><ImageIcon size={16}/>更新预览</button><button className="btn" disabled={!sheet||!templateId||!!busy} onClick={()=>render(true)}><Download size={16}/>导出 PNG</button></div></Panel>}
      {busy&&<Loading text={busy}/ >}{error&&<div className="notice error">{error}</div>}</div><Panel title="海报实时预览"><div className="preview" style={{minHeight:650}}>{preview?<img src={preview} alt="最终海报预览"/>:templateId?<img src={`/api/assets/templates/${templateId}/thumbnail.png`} alt="模板预览"/>:<Placeholder text="选择模板并填入 Excel 后生成预览"/>}</div>{manifest&&<p className="small muted">PNG 导出尺寸 {manifest.width} × {manifest.height} · 不调用 AI 修改数据</p>}</Panel></div></>;
}
export default function PostersPage(){return <Suspense fallback={<Loading text="加载中…"/>}><Editor/></Suspense>}
