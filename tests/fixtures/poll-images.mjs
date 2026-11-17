// Synthetic Supabase protocol fixture, not PostgreSQL/Storage verification.
import { randomUUID } from "node:crypto";
export function pollImageFixture({ polls, options, active }) {
  const rows = new Map(), objects = new Map(), failures = {};
  let missing = false;
  const consume = key => failures[key] ? (failures[key]--, true) : false;
  return {
    configure(body) { Object.assign(failures, body.pollImageFailures); if (Object.hasOwn(body,"pollImagesMissing")) missing=body.pollImagesMissing; if(body.agePollImages) for(const row of rows.values()) row.updated_at=new Date(Date.now()-310000).toISOString(); },
    reset() { rows.clear();objects.clear();missing=false;for(const k of Object.keys(failures))delete failures[k]; },
    stats() { return { pollImages:[...rows.values()],pollStorageCount:objects.size }; },
    handle({ req,res,url,raw,body,json }) {
      const table=url.pathname==='/rest/v1/poll_images', rpc=url.pathname==='/rest/v1/rpc/manage_poll_image',storage=url.pathname.startsWith('/storage/v1/')&&url.pathname.includes('poll-attachments');
      if(!table&&!rpc&&!storage)return false;
      const reject=(code,status=400)=>{json({code,message:code==='PGRST205'?'poll_images missing':'fixture image rejection'},status);return true;};
      const reply=value=>{json(value);return true;};
      if(req.headers.apikey!=='fixture-only-backend-key')return reject('42501',403);
      if(missing)return reject('PGRST205',404);
      if(table){
        if(consume('query'))return reject('XX000',503);
        let data=[...rows.values()];
        for(const [k,v]of url.searchParams){if(v.startsWith('eq.'))data=data.filter(r=>String(r[k])===v.slice(3));if(v.startsWith('neq.'))data=data.filter(r=>String(r[k])!==v.slice(4));if(v.startsWith('lt.'))data=data.filter(r=>r[k]<v.slice(3));}
        data.sort((a,b)=>a.sort_order-b.sort_order);data=data.slice(0,Number(url.searchParams.get('limit')||1000));
        const fields=url.searchParams.get('select');if(fields&&fields!=='*')data=data.map(row=>Object.fromEntries(fields.split(',').map(k=>[k,row[k]])));
        return reply(req.headers.accept?.includes('vnd.pgrst.object')?data[0]??null:data);
      }
      if(storage){
        if(url.pathname.includes('/bucket/'))return reply({id:'poll-attachments',name:'poll-attachments',public:!!failures.publicBucket,file_size_limit:500000,allowed_mime_types:['image/webp']});
        const path=decodeURIComponent(url.pathname).replace(/^.*\/object\/(authenticated\/)?poll-attachments\//,'');
        if(req.method==='POST'){if(consume('upload'))return reject('upload',503);if(objects.has(path)){json({statusCode:'409',message:'Duplicate'},409);return true;}objects.set(path,raw);if(consume('lostUpload'))return reject('lostACK',503);return reply({Key:'poll-attachments/'+path,Id:randomUUID()});}
        if(req.method==='DELETE'){if(consume('remove'))return reject('remove',503);for(const key of body.prefixes??[])objects.delete(key);return reply([]);}
        if(consume('download'))return reject('download',503);
        if(!objects.has(path))return reject('404',404);
        res.writeHead(200,{'Content-Type':'image/webp'}).end(consume('corrupt')?Buffer.from('corrupt'):objects.get(path));return true;
      }
      const {p_poll_id:pollId,p_actor_id:actor,p_action:action,p_data:d}=body;
      if(!active(actor))return reject('42501',403);
      const poll=polls().find(p=>String(p.id)===String(pollId));if(!poll)return reject('P0002');
      let item=rows.get(d.id);
      const own=()=>[...rows.values()].filter(r=>String(r.poll_id)===String(pollId));
      const old=rows.get(d.replaces_id);
      if(action==='reserve'){
        if(item){if(String(item.poll_id)!==String(pollId)||String(item.option_id)!==String(d.option_id)||item.sha256!==d.sha256||item.replaces_id!==d.replaces_id)return reject('40001');if(item.state==='ready')return reply(item);if(item.state!=='pending'||Date.now()-Date.parse(item.updated_at)<120000)return reject('40001');item.upload_token=d.token;item.updated_at=new Date().toISOString();return reply(item);}
        if(d.option_id!==null&&!options().some(o=>String(o.id)===String(d.option_id)&&String(o.poll_id)===String(pollId)))return reject('23503');
        if(d.replaces_id&&(!old||old.state!=='ready'||String(old.poll_id)!==String(pollId)||String(old.option_id)!==String(d.option_id)))return reject('40001');
        const matching=own().filter(r=>String(r.option_id)===String(d.option_id)&&['pending','ready'].includes(r.state));
        let slot=d.option_id===null?[0,1,2].find(n=>!matching.some(r=>r.sort_order===n)):0;
        if(old)slot=old.sort_order;
        if(slot===undefined||matching.some(r=>r.state==='pending'&&r.sort_order===slot)||!old&&d.option_id!==null&&matching.length)return reject('23514');
        item={id:d.id,poll_id:pollId,option_id:d.option_id,storage_path:`polls/${pollId}/${d.option_id===null?'questions':`options/${d.option_id}`}/${d.id}.webp`,content_type:'image/webp',byte_size:d.byte_size,width:d.width,height:d.height,sha256:d.sha256,sort_order:slot,state:'pending',upload_token:d.token,replaces_id:d.replaces_id,uploaded_by:actor,updated_at:new Date().toISOString()};rows.set(item.id,item);return reply(item);
      }
      if(action==='reorder'){const ready=own().filter(r=>r.option_id===null&&r.state==='ready');if(d.ids.length!==ready.length||new Set(d.ids).size!==ready.length||d.ids.some(id=>!ready.some(r=>r.id===id))||own().some(r=>r.option_id===null&&r.state==='pending'))return reject('40001');d.ids.forEach((id,i)=>rows.get(id).sort_order=i);return reply({reordered:true});}
      if(action==='finish'){if(consume('finish'))return reject('finish',503);if(!item||item.upload_token!==d.token||item.state!=='pending')return reject('40001');if(item.replaces_id){const previous=rows.get(item.replaces_id);if(previous?.state!=='ready')return reject('40001');previous.state='deleting';previous.upload_token=randomUUID();}item.state='ready';if(consume('lostFinish'))return reject('lostACK',503);return reply(item);}
      if(action==='delete'){if(!item)return reply(null);if(item.state!=='ready'&&Date.now()-Date.parse(item.updated_at)<120000)return reject('40001');item.state='deleting';item.upload_token=d.token;item.updated_at=new Date().toISOString();return reply(item);}
      if(action==='purge'){const deleted=!!item&&item.state==='deleting'&&item.upload_token===d.token;if(deleted)rows.delete(item.id);return reply({deleted});}
      return reject('22023');
    }
  };
}
