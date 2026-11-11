'use client';
import { useRef,useState } from 'react';
import { Sparkles, UploadCloud, WandSparkles, Save, RotateCcw, ImagePlus } from 'lucide-react';
import { Heading,Panel,Loading,Placeholder,readJSON } from '@/components/ui';
import type { Manifest } from '@/types';

export default function CreatePage(){
  const [mode,setMode]=useState<'generate'|'upload'>('generate');
  const [prompt,setPrompt]=useState('暗黑科技立体风格，紫蓝霓虹灯光，高级商业质感，宣传热门 AI 模型，突出模型卡片与优惠信息。');
  const [width,setWidth]=useState(1080),[height,setHeight]=useState(1440);
  const [referencePath,setReferencePath]=useState('');
  const [draft,setDraft]=useState<{draftId:string;preview:string;manifest:Manifest}|null>(null);
  const [name,setName]=useState(''),[instruction,setInstruction]=useState('');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const job=async (label:string,callback:()=>Promise<void>)=>{setBusy(label);setError('');setMessage('');try{await callback()}catch(err){setError(err instanceof Error?err.message:String(err))}finally{setBusy('')}};
  const upload=async(file:File)=>job('正在上传参考图…',async()=>{
    const form=new FormData();form.append('file',file);
    const result=await readJSON(await fetch('/api/images/upload',{method:'POST',body:form}));setReferencePath(result.referencePath);setDraft(null);
  });
  const generate=()=>job('正在通过图片模型生成参考海报…',async()=>{
    const result=await readJSON(await fetch('/api/images/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})}));setReferencePath(result.referencePath);setDraft(null);
  });
  const convert=()=>job('Mastra Agent 正在重建 HTML 模板并校对预览，可能需要多个模型调用…',async()=>{
    const result=await readJSON(await fetch('/api/templates/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referencePath,prompt,width,height})}));setDraft(result);setName(result.manifest.name);
  });
  const revise=()=>job('正在按修改意见重新生成模板…',async()=>{
    const result=await readJSON(await fetch(`/api/drafts/${draft!.draftId}/revise`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction})}));setDraft(result);setInstruction('');
  });
  const save=()=>job('正在保存模板…',async()=>{
    await readJSON(await fetch('/api/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:draft!.draftId,name})}));setMessage('模板已存入「我的模板」，后续填充 Excel 不再调用 AI。');
  });
  return <><Heading eyebrow="CREATE WITH AI" title="从灵感到可复用模板" description="生成一张海报设计图，或上传喜欢的参考图。AI 自动重建带变量的 HTML 模板，以后只换数据。"/><div className="wizard-steps"><span className="done">01 参考设计</span><span className={referencePath?'done':''}>02 AI 转模板</span><span className={draft?'done':''}>03 保存复用</span></div>
    <div className="two-col"><div className="stack"><Panel title="01 · 参考设计来源"><div className="segmented"><button className={mode==='generate'?'active':''} onClick={()=>setMode('generate')}><Sparkles size={15}/> AI 生图</button><button className={mode==='upload'?'active':''} onClick={()=>setMode('upload')}><UploadCloud size={15}/> 上传图片</button></div>
      {mode==='generate'?<><label className="label">画面描述</label><textarea className="textarea" rows={5} value={prompt} onChange={e=>setPrompt(e.target.value)}/><button className="btn primary full" style={{marginTop:17}} disabled={!!busy} onClick={generate}><ImagePlus size={17}/>生成参考海报</button></>:<><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={fileInput} onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/><button className="dropzone" style={{width:'100%',marginTop:18}} onClick={()=>fileInput.current?.click()} disabled={!!busy}><UploadCloud size={30}/><b>点击上传参考海报</b><span className="small muted">PNG / JPG / WebP · 最大 15 MB</span></button></>}
      </Panel><Panel title="02 · 让 AI 重建模板"><div className="form-row"><div><label className="label">宽度 / px</label><input className="input" type="number" value={width} onChange={e=>setWidth(Number(e.target.value))}/></div><div><label className="label">高度 / px</label><input className="input" type="number" value={height} onChange={e=>setHeight(Number(e.target.value))}/></div></div><p className="small muted">模板会自动识别标题、重复模型卡片、价格及图片槽位。</p><button className="btn primary full" onClick={convert} disabled={!referencePath||!!busy}><WandSparkles size={17}/> 生成可复用 HTML 模板</button></Panel>
      {draft&&<Panel title="03 · AI 修改与确认保存"><label className="label">修改当前版式（可选）</label><textarea className="textarea" rows={3} placeholder="例如：让卡片更立体，把主标题放大，右下角留二维码位置" value={instruction} onChange={e=>setInstruction(e.target.value)}/><button className="btn" disabled={!instruction.trim()||!!busy} style={{marginTop:12}} onClick={revise}><RotateCcw size={16}/>让 Agent 修改</button><div className="divider"/><label className="label">模板名称</label><input className="input" value={name} onChange={e=>setName(e.target.value)}/><div className="actions"><button className="btn primary" disabled={!name.trim()||!!busy} onClick={save}><Save size={16}/>保存到模板库</button></div><div className="chips" style={{marginTop:15}}>{draft.manifest.fields.map(f=><span className="chip" key={f.key}>{f.label} · {f.type}</span>)}</div></Panel>}
      {busy&&<div className="notice"><Loading text={busy}/></div>}{error&&<div className="notice error">{error}</div>}{message&&<div className="notice success">{message}</div>}</div>
      <div className="stack"><Panel title="参考设计图"><div className="preview">{referencePath?<img alt="参考海报" src={referencePath}/>:<Placeholder text="在左侧 AI 生图或上传图片后，这里将展示你的参考设计"/>}</div></Panel><Panel title="HTML 模板渲染效果"><div className="preview">{draft?<img alt="转换后的模板" src={draft.preview}/>:<Placeholder text="转换后的设计将以真实 HTML/CSS 渲染在这里，不是将文字叠到原图上"/>}</div>{draft&&<p className="small muted" style={{marginBottom:0}}>尺寸 {draft.manifest.width} × {draft.manifest.height} · {draft.manifest.fields.length} 个可填充字段</p>}</Panel></div>
    </div></>;
}
