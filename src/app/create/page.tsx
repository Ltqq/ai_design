'use client';
import { TextInput, Textarea } from '@mantine/core';
import { ActionButton } from '@/components/ui';
import { useRef,useState } from 'react';
import Link from 'next/link';
import { Sparkles, UploadCloud, WandSparkles, Save, RotateCcw, ImagePlus, ArrowRight, CheckCircle2, Info, SlidersHorizontal, ScanEye, LayoutTemplate } from 'lucide-react';
import { Heading,Panel,Loading,Placeholder,readJSON } from '@/components/ui';
import type { Manifest } from '@/types';

type Draft={draftId:string;preview:string;manifest:Manifest};
export default function CreatePage(){
  const [mode,setMode]=useState<'generate'|'upload'>('generate');
  const [prompt,setPrompt]=useState('高级商业科技风、暗色背景、立体卡片和精致光效，适合宣传热门 AI 模型折扣。画面留出主标题、模型名称和折扣展示区域。');
  const [width,setWidth]=useState(1080),[height,setHeight]=useState(1440);
  const [referencePath,setReferencePath]=useState('');
  const [draft,setDraft]=useState<Draft|null>(null);
  const [previewTab,setPreviewTab]=useState<'reference'|'template'>('reference');
  const [name,setName]=useState(''),[instruction,setInstruction]=useState(''),[savedId,setSavedId]=useState('');
  const [busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);
  const job=async (label:string,callback:()=>Promise<void>)=>{setBusy(label);setError('');setMessage('');try{await callback()}catch(err){setError(err instanceof Error?err.message:String(err))}finally{setBusy('')}};
  const upload=(file:File)=>job('正在上传参考图片…',async()=>{
    const form=new FormData();form.append('file',file);
    const result=await readJSON(await fetch('/api/images/upload',{method:'POST',body:form}));
    setReferencePath(result.referencePath);setDraft(null);setSavedId('');setPreviewTab('reference');
  });
  const generate=()=>job('正在通过生图模型创作设计图…',async()=>{
    const result=await readJSON(await fetch('/api/images/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})}));
    setReferencePath(result.referencePath);setDraft(null);setSavedId('');setPreviewTab('reference');
  });
  const convert=()=>job('Mastra Agent 正在理解图片、重建 HTML 并校对版式…',async()=>{
    const result=await readJSON(await fetch('/api/templates/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({referencePath,prompt,width,height})}));
    setDraft(result);setName(result.manifest.name);setSavedId('');setPreviewTab('template');
  });
  const revise=()=>job('Agent 正在根据你的反馈重新设计模板…',async()=>{
    const result=await readJSON(await fetch(`/api/drafts/${draft!.draftId}/revise`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instruction})}));
    setDraft(result);setInstruction('');setSavedId('');setPreviewTab('template');
  });
  const save=()=>job('正在保存设计模板…',async()=>{
    const result=await readJSON(await fetch('/api/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:draft!.draftId,name})}));
    setSavedId(result.templateId);setMessage('模板保存成功。以后更新模型折扣，不需要再调用 AI。');
  });
  return <>
    <Heading eyebrow="AI CREATIVE STUDIO" title="把灵感，变成可复用的海报模板" description="AI 生图或上传参考设计，多模态 Agent 会把画面转成可填充模型名称与折扣的 HTML 模板。" aside={<Link className="btn ghost" href="/settings"><SlidersHorizontal size={16}/>模型配置</Link>}/>
    <div className="wizard-steps"><span className="done"><Sparkles size={14}/>01 参考设计</span><i/><span className={referencePath?'done':''}><ScanEye size={14}/>02 AI 转换</span><i/><span className={draft?'done':''}><LayoutTemplate size={14}/>03 确认保存</span></div>
    <div className="two-col">
      <div className="stack">
        <Panel title="选择设计来源" description="先准备一张喜欢的海报，AI 会根据这张图重建布局。">
          <div className="segmented"><button className={mode==='generate'?'active':''} onClick={()=>setMode('generate')}><Sparkles size={17}/>AI 生图</button><button className={mode==='upload'?'active':''} onClick={()=>setMode('upload')}><UploadCloud size={17}/>上传参考图</button></div>
          {mode==='generate'?<><label className="label" htmlFor="create-prompt">你希望海报是什么风格？</label><Textarea id="create-prompt"  rows={5} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="描述海报风格、主题、颜色和卡片形式…"/><div className="actions" style={{marginTop:14}}><ActionButton className="btn primary full" disabled={!!busy||!prompt.trim()} onClick={generate}><ImagePlus size={17}/>生成参考海报<ArrowRight size={15}/></ActionButton></div><p className="hint" style={{margin:'10px 0 0'}}>调用已配置的生图模型，生成后仍需点击「转换为模板」。</p></>:<><input type="file" accept="image/png,image/jpeg,image/webp" hidden ref={fileInput} onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/><button className="dropzone" style={{marginTop:17}} onClick={()=>fileInput.current?.click()} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files[0])upload(e.dataTransfer.files[0])}} disabled={!!busy}><UploadCloud size={30}/><b>点击选择或拖入图片</b><small>支持 PNG / JPG / WebP · 不超过 15 MB</small></button><p className="hint" style={{margin:'11px 0 0'}}>上传后可在下方填写转换要求；不用先调用生图模型。</p></>}
          {referencePath&&<div className="notice success" style={{marginTop:18}}><CheckCircle2 size={16}/>参考图已就绪，可以继续转换模板，也可以重新生成/上传。</div>}
        </Panel>
        <Panel title="转换为可复用模板" description="只重建一次设计，之后 Excel 换数据即可批量使用。">
          <div className="form-row"><div><label className="label" htmlFor="w">海报宽度</label><TextInput id="w"  type="number" min="100" max="4000" value={width} onChange={e=>setWidth(Number(e.target.value))}/></div><div><label className="label" htmlFor="h">海报高度</label><TextInput id="h"  type="number" min="100" max="4000" value={height} onChange={e=>setHeight(Number(e.target.value))}/></div></div>
          <div className="chips" style={{margin:'15px 0 20px'}}><span className="chip">1080 × 1440 推荐</span><span className="chip">模型名称</span><span className="chip">折扣变量</span></div>
          <ActionButton className="btn primary full" disabled={!referencePath||!!busy} onClick={convert}><WandSparkles size={17}/>转换为 HTML 模板<ArrowRight size={16}/></ActionButton>
          <p className="hint" style={{margin:'12px 0 0'}}>不把整张原图当背景；标题、模型名及折扣会转换为可替换的文字元素。</p>
        </Panel>
        {draft&&<Panel title="微调设计并保存" description="用自然语言让 Agent 修改，不需要手工编辑 HTML。">
          <div className="chips">{draft.manifest.fields.map(f=><span className="chip" key={f.key}>{f.label}</span>)}</div>
          <label className="label" htmlFor="revision">设计修改建议</label><Textarea id="revision"  rows={3} placeholder="例如：卡片更立体、标题放大、留出二维码空间…" value={instruction} onChange={e=>setInstruction(e.target.value)}/>
          <div className="actions" style={{marginTop:11}}><ActionButton className="btn soft" disabled={!instruction.trim()||!!busy} onClick={revise}><RotateCcw size={15}/>让 Agent 修改设计</ActionButton></div>
          <div className="divider"/>
          <label className="label" htmlFor="template-name">模板名称</label><TextInput  id="template-name" value={name} onChange={e=>{setName(e.target.value);setSavedId('')}} placeholder="为模板取一个容易识别的名称"/>
          <div className="footer-toolbar"><ActionButton className="btn primary" disabled={!name.trim()||!!busy||!!savedId} onClick={save}><Save size={16}/>{savedId?'已保存到模板库':'保存为模板'}</ActionButton>{savedId&&<Link className="btn" href={`/posters?template=${savedId}`}>使用这个模板<ArrowRight size={15}/></Link>}</div>
        </Panel>}
        {busy&&<div className="notice"><Loading text={busy}/></div>}{error&&<div className="notice error"><Info size={16}/>{error}</div>}{message&&<div className="notice success"><CheckCircle2 size={16}/>{message}</div>}
      </div>
      <div className="sticky-preview"><Panel><div className="preview-top"><h2>设计预览</h2><span className="chip">{width} × {height} px</span></div><div className="segmented" style={{marginBottom:16}}><button className={previewTab==='reference'?'active':''} onClick={()=>setPreviewTab('reference')}>参考设计图</button><button className={previewTab==='template'?'active':''} onClick={()=>setPreviewTab('template')} disabled={!draft}>可填充模板</button></div><div className="preview studio-preview">{previewTab==='template'&&draft?<img alt="真实 HTML 模板渲染效果" src={draft.preview}/>:referencePath?<img alt="海报参考设计图" src={referencePath}/>:<Placeholder text="设计预览将在这里出现。先通过 AI 生图，或上传一张喜欢的参考海报。"/>}</div><div className="preview-caption"><span>{draft&&previewTab==='template'?'真实 HTML / CSS 渲染':'图片设计参考'}</span><span>{draft?`${draft.manifest.fields.length} 个模板字段`:'等待参考图'}</span></div></Panel></div>
    </div>
  </>;
}
