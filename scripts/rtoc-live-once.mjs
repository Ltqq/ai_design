// One-shot real upstream diagnostics. No retries, no saved image payloads, no secrets in logs.
const base='https://api.rtoc.cc/v1';
const chatModel='gpt-6.1-terra';
const imageModel='gpt-image-2.6-sunburst';
const chatKey=process.env.CHATKEY||'';
const imageKey=process.env.IMAGEKEY||'';
const result={};
function sanitize(message,key){
  return String(message||'').replaceAll(key||'THIS_IS_NOT_A_KEY','[REDACTED]')
    .replace(/sk-[A-Za-z0-9_\-]{12,}/g,'[REDACTED]').slice(0,350);
}
async function call(endpoint,key,body,timeoutMs){
  const started=Date.now();
  try{
    const response=await fetch(base+endpoint,{
      method:'POST',
      headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(timeoutMs),
    });
    const contentType=response.headers.get('content-type')||'';
    const raw=await response.text();
    let data;
    try{data=JSON.parse(raw)}catch{data={};}
    return {
      status:response.status,
      ok:response.ok,
      data,
      contentType,
      elapsedMs:Date.now()-started,
      error:response.ok?null:{
        type:String(data?.error?.type||''),
        code:String(data?.error?.code||''),
        message:sanitize(data?.error?.message||'non-JSON response',key),
      },
    };
  }catch(error){
    return {status:0,ok:false,data:{},elapsedMs:Date.now()-started,
      error:{type:'network',code:'request_failed',message:sanitize(error instanceof Error?error.message:String(error),key)}};
  }
}
let failed=false;
if(!chatKey){result.chat={error:'CHATKEY secret is missing'};failed=true;}
else {
  const tools=[{type:'function',function:{
    name:'confirm_ready',description:'Confirm model supports tools',
    parameters:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}
  }}];
  const chat=await call('/chat/completions',chatKey,{
    model:chatModel,messages:[{role:'user',content:'请调用 confirm_ready 工具，参数 ok=true，不要输出普通文本。'}],
    tools,tool_choice:'auto',max_completion_tokens:256
  },90000);
  const calls=chat.data?.choices?.[0]?.message?.tool_calls;
  result.chatCompletions={status:chat.status,elapsedMs:chat.elapsedMs,
    toolCalls:Array.isArray(calls)?calls.length:0,error:chat.error};
  // One separate Responses API comparison only if the current chat protocol cannot call tools.
  // Not a retry of the same request.
  if(chat.status!==401&&chat.status!==403&&chat.status!==429&&chat.status<500&&(!chat.ok||!Array.isArray(calls)||calls.length===0)){
    const responses=await call('/responses',chatKey,{
      model:chatModel,input:'请调用 confirm_ready 工具，参数 ok=true，不要输出普通文本。',
      tools:[{type:'function',name:'confirm_ready',description:'Confirm model supports tools',
        parameters:{type:'object',properties:{ok:{type:'boolean'}},required:['ok'],additionalProperties:false}}],
      tool_choice:'auto',max_output_tokens:256
    },90000);
    result.responses={status:responses.status,elapsedMs:responses.elapsedMs,
      functionCalls:Array.isArray(responses.data?.output)?responses.data.output.filter(x=>x.type==='function_call').length:0,
      error:responses.error};
    if(!responses.ok||!result.responses.functionCalls)failed=true;
  }else if(!chat.ok||!Array.isArray(calls)||calls.length===0)failed=true;
}
if(!imageKey){result.image={error:'IMAGEKEY secret is missing'};failed=true;}
else {
  const image=await call('/images/generations',imageKey,{
    model:imageModel,prompt:'A single cobalt-blue sphere on a clean white studio background, no text.',
    size:'1024x1024',quality:'low',n:1
  },180000);
  const item=image.data?.data?.[0]||{};
  result.image={status:image.status,elapsedMs:image.elapsedMs,
    returnedImages:Array.isArray(image.data?.data)?image.data.data.length:0,
    format:item.b64_json?'b64_json':item.url?'url':'none',
    error:image.error};
  if(!image.ok||result.image.returnedImages===0||result.image.format==='none')failed=true;
}
console.log('Live RToc diagnostics (one request per endpoint, no retries):');
console.log(JSON.stringify(result,null,2));
process.exitCode=failed?1:0;
