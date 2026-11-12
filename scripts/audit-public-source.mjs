import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Findings contain paths/rules/object IDs only. Never print matched contents.
export function inspectPublicSource(file,source){
  const findings=[];
  const add=(rule,severity)=>findings.push({path:file,rule,severity});
  if(/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.example'))add('environment_file','high');
  if((/(^|\/)(backups?|\.verification)\//i.test(file)&&!/^scripts\/backup\//.test(file))||/\.(dump|backup|sql\.gz|dump\.enc)$/.test(file))add('backup_or_qa_content','high');
  if(/^private-assets\/.*\.(jpg|jpeg|png|webp|heic)$/i.test(file))add('personal_photo_in_git','high');
  if(/sb_secret_[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source))add('credential_pattern','critical');
  for(const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g))try{
    if(JSON.parse(Buffer.from(match[0].split('.')[1],'base64url').toString()).role==='service_role')add('service_role_jwt','critical');
  }catch{}
  if(file.endsWith('.env.example')&&/BOARD_PARTICIPANT_PASSWORDS/.test(source)){
    const raw=source.split(/\r?\n/).find(s=>/^BOARD_PARTICIPANT_PASSWORDS=/.test(s))?.split('=').slice(1).join('=');
    try{const parsed=JSON.parse(raw?.replace(/^['"]|['"]$/g,''));if(Object.entries(parsed).some(([id,pw])=>!/^(00000000|11111111)-/.test(id)&&typeof pw==='string'&&!/[<>]/.test(pw)))add('realistic_member_password_examples','high');}catch{}
  }
  if(/\.sql$/.test(file)&&/insert\s+into\s+(?:public\.)?participants/i.test(source)&&/[가-힣]/.test(source))add('participant_seed_is_public','medium');
  return findings;
}
export function auditRepository(directory){
  const git=args=>execFileSync('git',['-C',directory,...args],{encoding:'utf8',maxBuffer:32*1024*1024});
  const tracked=git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean),current=[];
  for(const p of tracked){try{current.push(...inspectPublicSource(p,readFileSync(path.join(directory,p),'utf8')));}catch{}}
  const objects=git(['rev-list','--objects','--all']).trim().split('\n').map(line=>{const i=line.indexOf(' ');return{sha:line.slice(0,i),path:line.slice(i+1)};})
    .filter(o=>/\.(?:ts|tsx|js|mjs|md|mdx|sql|json|ya?ml|example|ps1|sh)$/.test(o.path)||/(^|\/)\.env/.test(o.path));
  const history=[];let inspected=0;
  for(const o of objects){try{if(git(['cat-file','-t',o.sha]).trim()!=='blob')continue;const s=git(['cat-file','blob',o.sha]);inspected++;for(const f of inspectPublicSource(o.path,s))history.push({...f,blob:o.sha});}catch{}}
  return{current,history,files:tracked.length,historicalBlobs:inspected,limitations:['Pattern scan only; not a proof of absence','Remote unreachable/unfetched objects are not included','No credentials printed or rotated']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=auditRepository(path.resolve(process.argv[2]??'.'));mkdirSync('.verification',{recursive:true});writeFileSync('.verification/phase2-public-audit.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify({files:result.files,historicalBlobs:result.historicalBlobs,current:result.current,history:result.history,valuesPrinted:false}));
}
