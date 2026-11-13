import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { join } from 'node:path';
import { configuredModel } from '@/lib/model-provider';
import { dataDir } from '@/lib/storage';

let activeConfig = '';
let activeMemory: Memory;

export function studioMemory() {
  const {config,provider}=configuredModel('vision');
  const fingerprint=`${config.baseURL}|${config.modelId}|${config.apiKey}`;
  if(fingerprint!==activeConfig){
    activeMemory=new Memory({
      storage:new LibSQLStore({id:'ai-design-memory',url:`file:${join(dataDir,'ai-design.sqlite')}`}),
      options:{
        observationalMemory:{
          model:provider.chatModel(config.modelId),
          observation:{messageTokens:32000,bufferTokens:false},
        },
      },
    });
    activeConfig=fingerprint;
  }
  return activeMemory;
}
