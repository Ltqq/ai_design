'use client';
import { useEffect,useState } from 'react';
import { Eye,Image,PlugZap,Save,CheckCircle2 } from 'lucide-react';
import { Heading,Panel,Loading,readJSON } from '@/components/ui';
type Config={baseURL:string;modelId:string;apiKey:string;hasKey?:boolean};
const blank={baseURL:'',modelId:'',apiKey:''};
export default function SettingsPage(){
  const [vision,setVision]=useState<Config>(blank),[image,setImage]=useState<Config>(blank),[busy,setBusy]=useState(''),[status,setStatus]=useState<Record<string,string>>({});
  useEffect(()=>{fetch('/api/model-config').then(readJSON).then(data=>{setVision(data.vision?{...data.vision,apiKey:''}:blank);setImage(data.image?{...data.image,apiKey:''}:blank)}).catch(e=>setStatus({global:e.message}))},[]);
  const perform=async(kind:'vision'|'image',action:'save'|'test')=>{
    setBusy(`${kind}-${action}`);setStatus(s=>({...s,[kind]:''}));
    try {
      const config=kind==='vision'?vision:image;
      if(action==='save') await readJSON(await fetch('/api/model-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...config})}));
      else {const res=await readJSON(await fetch('/api/model-config/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})}));if(!res.success)throw new Error(res.message)}
      setStatus(s=>({...s,[kind]:action==='save'?'配置保存成功':'真实模型能力测试通过'}));
    } catch(e) {setStatus(s=>({...s,[kind]:e instanceof Error?e.message:String(e)}))}finally{setBusy('')}
  };
  const cards=[{kind:'vision' as const,title:'多模态理解模型',icon:Eye,desc:'用于理解参考图片、生成 HTML 模板、预览修正；需要支持图片输入及工具调用。',value:vision,set:setVision},{kind:'image' as const,title:'图片生成模型',icon:Image,desc:'用于文字生成原始海报设计图；独立于理解模型配置。',value:image,set:setImage}];
  return <><Heading eyebrow="MODEL CONNECTIONS" title="模型与接口配置" description="接入你自己的 AI Gateway。两类模型分别配置 Base URL、Model ID 与 API Key，密钥仅保存于本机服务端。"/><div className="two-col">{cards.map(({kind,title,icon:Icon,desc,value,set})=><Panel key={kind} title={title}><div className="chips"><span className="chip"><Icon size={14}/> {kind==='vision'?'Vision / Chat Completions':'Image Generation'}</span></div><p className="muted small" style={{lineHeight:1.8}}>{desc}</p><label className="label">API Base URL</label><input className="input" placeholder="https://your-gateway.com/v1" value={value.baseURL} onChange={e=>set({...value,baseURL:e.target.value})}/><label className="label">Model ID</label><input className="input" placeholder={kind==='vision'?'your-vision-model':'your-image-model'} value={value.modelId} onChange={e=>set({...value,modelId:e.target.value})}/><label className="label">API Key {value.hasKey&&<span className="muted">（已设置，留空表示不修改）</span>}</label><input className="input" type="password" placeholder="sk-…" autoComplete="off" value={value.apiKey} onChange={e=>set({...value,apiKey:e.target.value})}/><div className="actions"><button className="btn primary" disabled={!!busy} onClick={()=>perform(kind,'save')}><Save size={16}/>保存配置</button><button className="btn" disabled={!!busy} onClick={()=>perform(kind,'test')}><PlugZap size={16}/>测试真实能力</button></div>{busy.startsWith(kind)&&<div style={{marginTop:15}}><Loading text="正在请求模型…"/></div>}{status[kind]&&<p className="notice" style={{marginBottom:0}}>{status[kind]}</p>}</Panel>)}</div><div className="notice" style={{marginTop:22}}><CheckCircle2 size={17} style={{verticalAlign:'middle',marginRight:7}}/>模型 API 需要真实支持对应能力。测试会产生实际模型调用及相应费用；页面不会展示已保存的密钥。</div>{status.global&&<p className="notice error">{status.global}</p>}</>;
}
