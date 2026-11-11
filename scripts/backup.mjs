import Database from 'better-sqlite3';
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';

const dataDir=path.resolve(process.env.AI_DESIGN_DATA_DIR||'./data');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const target=path.resolve(process.argv[2]||`./backups/${stamp}`);
await mkdir(target,{recursive:true});
const database=new Database(path.join(dataDir,'ai-design.sqlite'),{readonly:true,fileMustExist:true});
try{
  await database.backup(path.join(target,'ai-design.sqlite'));
}finally{
  database.close();
}
for(const name of ['templates','drafts','references','exports']){
  await cp(path.join(dataDir,name),path.join(target,name),{recursive:true,force:true,errorOnExist:false}).catch(err=>{
    if(err.code!=='ENOENT')throw err;
  });
}
console.log(`备份已保存：${target}`);
