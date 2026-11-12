'use client';
import { NumberInput, SimpleGrid, Stack, Table, Text, TextInput } from '@mantine/core';
import { ActionButton } from '@/components/ui';
import { useEffect,useState } from 'react';
import { Eye,Image as ImageIcon,PlugZap,Save,CheckCircle2,Info,KeyRound,Link2,ShieldCheck } from 'lucide-react';
import { Heading,Panel,Loading,readJSON } from '@/components/ui';
import type { ModelPrices, ModelUsageRecord } from '@/types';
type Config={baseURL:string;modelId:string;apiKey:string;hasKey?:boolean};
const blank={baseURL:'',modelId:'',apiKey:''};
const noPrices:ModelPrices={inputPerMillion:null,outputPerMillion:null,cachedInputPerMillion:null,perImage:null};
type UsageView={records:ModelUsageRecord[];summary:{knownCostCny:number;unpricedCalls:number;callCount:number;inputTokens:number;outputTokens:number;imageCount:number};prices:{vision:ModelPrices;image:ModelPrices}};
const initialUsage:UsageView={records:[],summary:{knownCostCny:0,unpricedCalls:0,callCount:0,inputTokens:0,outputTokens:0,imageCount:0},prices:{vision:noPrices,image:noPrices}};
const usageName:Record<string,string>={'agent-routing':'Agent 对话/路由','template-create':'首次生成 HTML','template-patch':'局部修改','template-redesign':'整体重构','image-generate':'生成参考图','capability-image-test':'生图能力测试','capability-vision-test':'多模态能力测试'};

export default function SettingsPage(){
  const [vision,setVision]=useState<Config>(blank),[image,setImage]=useState<Config>(blank),[busy,setBusy]=useState(''),[status,setStatus]=useState<Record<string,{text:string;ok:boolean}>>({});
  const [usage,setUsage]=useState<UsageView>(initialUsage);
  const [prices,setPrices]=useState(initialUsage.prices);
  useEffect(()=>{fetch('/api/model-config').then(readJSON).then(data=>{setVision(data.vision?{...data.vision,apiKey:''}:blank);setImage(data.image?{...data.image,apiKey:''}:blank)}).catch(e=>setStatus({global:{text:e.message,ok:false}}))},[]);
  const refreshUsage=async()=>{
    const result=await readJSON(await fetch('/api/model-usage',{cache:'no-store'})) as UsageView;
    setUsage(result);setPrices(result.prices);
  };
  useEffect(()=>{refreshUsage().catch(e=>setStatus(old=>({...old,pricing:{text:e.message,ok:false}})))},[]);
  const updatePrice=(kind:'vision'|'image',key:keyof ModelPrices,value:number|string)=>{
    setPrices(previous=>({...previous,[kind]:{...previous[kind],[key]:typeof value==='number'?value:null}}));
  };
  const savePrices=async(kind:'vision'|'image')=>{
    setBusy('pricing');setStatus(old=>({...old,pricing:{text:'',ok:true}}));
    try{
      await readJSON(await fetch('/api/model-usage',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind,...prices[kind]})}));
      await refreshUsage();
      setStatus(old=>({...old,pricing:{text:'参考单价已保存。仅对今后的调用计算估算费用，历史记录不会被重算。',ok:true}}));
    }catch(e){setStatus(old=>({...old,pricing:{text:e instanceof Error?e.message:String(e),ok:false}}))}
    finally{setBusy('')}
  };
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

    <Panel title="用量与成本统计" description="记录 Agent、模板生成、局部编辑、整体重构和图片生成的每次模型调用。费用仅在配置了对应模型单价、且上游返回必要用量时估算，未计价调用不会当作 0 元。" >
      <div className="chips">
        <span className="chip">累计 {usage.summary.callCount} 次模型调用</span>
        <span className="chip">输入 {usage.summary.inputTokens.toLocaleString('zh-CN')} Token</span>
        <span className="chip">输出 {usage.summary.outputTokens.toLocaleString('zh-CN')} Token</span>
        <span className="chip">生成 {usage.summary.imageCount} 张图片</span>
        <span className="chip highlight">已计价部分 ¥{usage.summary.knownCostCny.toFixed(4)}</span>
        {usage.summary.unpricedCalls>0&&<span className="chip">{usage.summary.unpricedCalls} 次未计价</span>}
      </div>
      <SimpleGrid cols={{base:1,md:2}} spacing="lg" mt="lg">
        <Stack gap="xs"><Text fw={700} size="sm">多模态理解模型单价 · 人民币 / 百万 Token</Text>
          <NumberInput label="输入价格" min={0} decimalScale={6} value={prices.vision.inputPerMillion??''} onChange={v=>updatePrice('vision','inputPerMillion',v)}/>
          <NumberInput label="输出价格" min={0} decimalScale={6} value={prices.vision.outputPerMillion??''} onChange={v=>updatePrice('vision','outputPerMillion',v)}/>
          <NumberInput label="缓存读取价格（可选）" min={0} decimalScale={6} value={prices.vision.cachedInputPerMillion??''} onChange={v=>updatePrice('vision','cachedInputPerMillion',v)}/>
          <ActionButton className="btn" disabled={!!busy} onClick={()=>savePrices('vision')}>保存多模态单价</ActionButton>
        </Stack>
        <Stack gap="xs"><Text fw={700} size="sm">图片生成模型单价 · 人民币 / 张</Text>
          <NumberInput label="每张图片实际成本" min={0} decimalScale={6} value={prices.image.perImage??''} onChange={v=>updatePrice('image','perImage',v)}/>
          <Text size="xs" c="dimmed">按供应商的实际生成规格填写。若模型按分辨率等另行计费，这里仅是当前配置的粗略估算。</Text>
          <ActionButton className="btn" disabled={!!busy} onClick={()=>savePrices('image')}>保存生图单价</ActionButton>
        </Stack>
      </SimpleGrid>
      {status.pricing?.text&&<div className={`notice ${status.pricing.ok?'success':'error'}`} style={{marginTop:14}}>{status.pricing.text}</div>}
      <Text size="sm" fw={700} mt="lg" mb="xs">最近 100 次模型请求</Text>
      <div style={{overflowX:'auto'}}>
        <Table striped highlightOnHover withTableBorder fz="xs">
          <Table.Thead><Table.Tr><Table.Th>操作 / 模型</Table.Th><Table.Th>输入</Table.Th><Table.Th>输出</Table.Th><Table.Th>缓存读</Table.Th><Table.Th>图片</Table.Th><Table.Th>估算费用</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{usage.records.length?usage.records.map(item=><Table.Tr key={item.id}>
            <Table.Td><Text size="xs" fw={600}>{usageName[item.operation]||item.operation}</Text><Text size="xs" c="dimmed">{item.modelId}</Text></Table.Td>
            <Table.Td>{item.inputTokens??'—'}</Table.Td><Table.Td>{item.outputTokens??'—'}</Table.Td><Table.Td>{item.cacheReadTokens??'未知'}</Table.Td><Table.Td>{item.imageCount||'—'}</Table.Td>
            <Table.Td>{item.estimatedCostCny===null?'未知':`¥${item.estimatedCostCny.toFixed(5)}`}</Table.Td>
          </Table.Tr>):<Table.Tr><Table.Td colSpan={6}>尚未产生模型调用记录</Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </div>
    </Panel>
    <div className="notice" style={{marginTop:22}}><Info size={17}/>多模态模型需要支持图片输入；生图模型需要提供 OpenAI 兼容的图片生成接口。测试会真实调用上游并产生少量费用。</div>
    {status.global&&<div className="notice error" style={{marginTop:12}}>{status.global.text}</div>}
  </>;
}
