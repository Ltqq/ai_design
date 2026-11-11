'use client';
import { TextInput, Textarea } from '@mantine/core';
import { ActionButton } from '@/components/ui';
import { useEffect,useState } from 'react';
import { Eye,Image as ImageIcon,PlugZap,Save,CheckCircle2,Info,KeyRound,Link2,ShieldCheck } from 'lucide-react';
import { Heading,Panel,Loading,readJSON } from '@/components/ui';
type Config={baseURL:string;modelId:string;apiKey:string;hasKey?:boolean};
const blank={baseURL:'',modelId:'',apiKey:''};
export default function SettingsPage(){
  const [vision,setVision]=useState<Config>(blank),[image,setImage]=useState<Config>(blank),[busy,setBusy]=useState(''),[status,setStatus]=useState<Record<string,{text:string;ok:boolean}>>({});
  useEffect(()=>{fetch('/api/model-config').then(readJSON).then(data=>{setVision(data.vision?{...data.vision,apiKey:''}:blank);setImage(data.image?{...data.image,apiKey:''}:blank)}).catch(e=>setStatus({global:{text:e.message,ok:false}}))},[]);
  const perform=async(kind:'vision'|'image',action:'save'|'test')=>{
    setBusy(`${kind}-${action}`);setStatus(prev=>({...prev,[kind]:{text:'',ok:true}}));
    try{
      const config=kind==='vision'?vision:image;
      if(action==='save'){
        await readJSON(await fetch('/api/model-config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...config})}));
        (kind==='vision'?setVision:setImage)(prev=>({...prev,apiKey:'',hasKey:true}));
      }else{
        const result=await readJSON(await fetch('/api/model-config/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind})}));
        if(!result.success)throw new Error(result.message);
      }
      setStatus(prev=>({...prev,[kind]:{text:action==='save'?'配置已保存到本机数据库':'真实模型能力测试通过',ok:true}}));
    }catch(e){setStatus(prev=>({...prev,[kind]:{text:e instanceof Error?e.message:String(e),ok:false}}))}finally{setBusy('')}
  };
  const cards=[{kind:'vision' as const,title:'多模态理解模型',icon:Eye,desc:'图片理解、模板转换、自动校对、模型对话都使用这里配置的模型。',cap:'VISION + CHAT',value:vision,set:setVision},{kind:'image' as const,title:'图片生成模型',icon:ImageIcon,desc:'输入设计提示词生成参考海报；与多模态模型独立配置。',cap:'IMAGE GENERATION',value:image,set:setImage}];
  return <>
    <Heading eyebrow="MODEL CONNECTIONS" title="连接你的 AI 模型" description="自定义 API Base URL、Model ID 与 Key。通过你们的中转平台也可以直接连接；两种能力独立配置和测试。"/>
    <div className="hero-tip"><ShieldCheck size={22}/><div><strong>配置只保存在当前服务器</strong>API Key 不会回显给浏览器。重新打开页面仍可沿用已经保存的配置；修改模型地址后记得重新保存。</div></div>
    <div className="settings-grid">{cards.map(({kind,title,icon:Icon,desc,cap,value,set})=><Panel key={kind} title={title} description={desc} aside={<span className={`chip ${value.hasKey?'highlight':''}`}><Icon size={14}/>{cap}</span>}>
      <label className="label" htmlFor={`${kind}-url`}><Link2 size={14}/>API Base URL</label><TextInput id={`${kind}-url`}  placeholder="https://gateway.example.com/v1" value={value.baseURL} onChange={e=>set({...value,baseURL:e.target.value})}/>
      <label className="label" htmlFor={`${kind}-model`}>Model ID</label><TextInput id={`${kind}-model`}  placeholder={kind==='vision'?'your-multimodal-model':'your-image-model'} value={value.modelId} onChange={e=>set({...value,modelId:e.target.value})}/>
      <label className="label" htmlFor={`${kind}-key`}><KeyRound size={14}/>API Key {value.hasKey&&<span className="pill"><CheckCircle2 size={12}/>已保存</span>}</label><TextInput id={`${kind}-key`}  type="password" autoComplete="new-password" placeholder={value.hasKey?'已保存；如需更换请填写新的 Key':'输入 API Key'} value={value.apiKey} onChange={e=>set({...value,apiKey:e.target.value})}/>
      <div className="divider"/><div className="actions"><ActionButton className="btn primary" disabled={!!busy} onClick={()=>perform(kind,'save')}><Save size={16}/>保存连接</ActionButton><ActionButton className="btn" disabled={!!busy||!value.hasKey} onClick={()=>perform(kind,'test')}><PlugZap size={16}/>真实能力测试</ActionButton></div>
      {busy.startsWith(kind)&&<div style={{marginTop:15}}><Loading text={busy.endsWith('test')?'正在请求模型并验证能力…':'正在保存…'}/></div>}
      {status[kind]?.text&&<div className={`notice ${status[kind].ok?'success':'error'}`} style={{marginTop:17}}>{status[kind].ok?<CheckCircle2 size={16}/>:<Info size={16}/ >}{status[kind].text}</div>}
    </Panel>)}</div>
    <div className="notice" style={{marginTop:22}}><Info size={17}/>多模态模型需要支持图片输入；生图模型需要提供 OpenAI 兼容的图片生成接口。测试会真实调用上游并产生少量费用。</div>
    {status.global&&<div className="notice error" style={{marginTop:12}}>{status.global.text}</div>}
  </>;
}
