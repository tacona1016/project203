import http from "node:http";
const now = () => new Date().toISOString(), person = n => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
let posts = [], comments = [], seq = 100;
const active = id => /^00000000-0000-4000-8000-00000000000[1-9]$/.test(id) || id === person(10);
const name = id => `친구${Number(id.slice(-2))}`;
const joined = p => ({ ...p, author_name: name(p.author_id), comment_count: comments.filter(c => c.post_id === p.id && !c.deleted_at).length });
const list = p => { const row=joined(p); return Object.fromEntries(Object.entries(row).filter(([key])=>key!=="content"&&key!=="deleted_at")); };
function reset() { posts = Array.from({length:13},(_,i)=>({id:i+1,author_id:person(1),title:`기존 이야기 ${i+1}`,content:`본문 검색 단어 ${i+1}`,post_type:"general",is_pinned:false,created_at:new Date(Date.now()-i*1000).toISOString(),updated_at:new Date(Date.now()-i*1000).toISOString(),deleted_at:null})); comments=[];seq=100; }
reset();
http.createServer(async (req,res)=>{
 const url=new URL(req.url,"http://127.0.0.1:3103"),chunks=[];for await(const chunk of req)chunks.push(chunk);const raw=Buffer.concat(chunks),body=raw.length?JSON.parse(raw.toString()):{};
 const json=(data,status=200)=>res.writeHead(status,{"Content-Type":"application/json"}).end(JSON.stringify(data));
 const fail=(code,status=400)=>json({code,message:"fixture rejection"},status);
 if(url.pathname==="/_test"){if(body.reset)reset();return json({posts,comments});}
 if(!url.pathname.startsWith("/rest/v1/rpc/")||!/(board_|_board_)/.test(url.pathname)){
  const headers=Object.fromEntries(Object.entries(req.headers).filter(([k])=>!['host','connection','content-length'].includes(k)));
  const upstream=await fetch("http://127.0.0.1:3102"+req.url,{method:req.method,headers,...(raw.length?{body:raw}:{} )});
  res.writeHead(upstream.status,Object.fromEntries(upstream.headers));return res.end(Buffer.from(await upstream.arrayBuffer()));
 }
 if(req.headers.apikey!=="fixture-only-backend-key")return fail("42501",403);
 const action=url.pathname.split('/').at(-1),id=Number(body.p_id),postId=Number(body.p_post_id), actor=body.p_actor_id, admin=body.p_is_admin;
 const target=posts.find(p=>p.id===id&&!p.deleted_at);
 if(action==='get_board_page'){
  const q=String(body.p_search||'').toLowerCase(),matches=posts.filter(p=>!p.deleted_at&&(!q||p.title.toLowerCase().includes(q)||p.content.toLowerCase().includes(q))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id),regular=matches.filter(p=>!p.is_pinned),page=body.p_page||1;
  return json({pinned:matches.filter(p=>p.is_pinned).map(list),posts:regular.slice((page-1)*10,page*10).map(list),total:regular.length,page,page_size:10});
 }
 if(action==='get_board_post')return json(target?joined(target):null);
 if(action==='get_board_comments'){
  if(!posts.some(p=>p.id===postId&&!p.deleted_at))return fail('P4040');
  const page=body.p_page||1;return json(comments.filter(c=>c.post_id===postId&&!c.deleted_at).slice((page-1)*30,page*30).map(c=>({...c,author_name:name(c.author_id)})));
 }
 if(!active(actor))return fail('P4030');
 if(action==='write_board_post'){
  if(!admin&&(body.p_post_type!=='general'||body.p_is_pinned))return fail('P4030');
  if(body.p_id!==null){if(!target)return fail('P4040');if(!admin&&(target.author_id!==actor||target.post_type==='notice'||body.p_post_type!==target.post_type||body.p_is_pinned!==target.is_pinned))return fail('P4030');
   Object.assign(target,{title:body.p_title,content:body.p_content,post_type:body.p_post_type,is_pinned:body.p_is_pinned,updated_at:now()});return json({id:target.id});}
  const post={id:++seq,author_id:actor,title:body.p_title,content:body.p_content,post_type:body.p_post_type,is_pinned:body.p_is_pinned,created_at:now(),updated_at:now(),deleted_at:null};posts.push(post);return json({id:post.id});
 }
 if(action==='delete_board_post'){if(!target)return fail('P4040');if(!admin&&(target.author_id!==actor||target.post_type==='notice'))return fail('P4030');target.deleted_at=now();return json({success:true});}
 const parent=posts.find(p=>p.id===postId&&!p.deleted_at);if(!parent)return fail('P4040');
 if(action==='create_board_comment'){const comment={id:++seq,post_id:postId,author_id:actor,content:body.p_content,created_at:now(),updated_at:now(),deleted_at:null};comments.push(comment);return json({id:comment.id});}
 if(action==='delete_board_comment'){const target=comments.find(c=>c.id===id&&c.post_id===postId&&!c.deleted_at);if(!target)return fail('P4040');if(!admin&&target.author_id!==actor)return fail('P4030');target.deleted_at=now();return json({success:true});}
 return fail('PGRST202');
}).listen(3103,'127.0.0.1',()=>console.log('Board local protocol fixture ready (no production data).'));
