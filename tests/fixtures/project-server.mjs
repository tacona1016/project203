// HTTP protocol simulation only; this does NOT validate PostgreSQL/RLS/locks.
export function projectFixture({ posts, active, now }) {
  let mode="missing", entries=[], revisions=[], seq=0, homeRequests=0;
  const pollOptions=[{slug:"land-priority",title:"Fixture poll",is_hidden:false},{slug:"hidden",title:"Hidden fixture",is_hidden:true}];
  const copy=x=>JSON.parse(JSON.stringify(x));
  function configure(body){if(body.projectMode)mode=body.projectMode;if(body.projectReset||body.reset){entries=[];revisions=[];seq=0;}if(body.reset)mode="missing";}
  function admin(){return{configured:true,entries:copy(entries),revisions:copy(revisions.slice().reverse()),notices:posts().filter(p=>p.post_type==="notice"&&!p.deleted_at).map(p=>({id:String(p.id),title:p.title})),polls:pollOptions};}
  function handle({action,body,json,fail}){
    if(!["get_project_home","get_project_admin","change_project_entry"].includes(action))return false;
    if(action==="get_project_home")homeRequests++;
    if(mode==="missing"){json({code:"PGRST202",message:`Could not find public.${action}`},404);return true;}
    if(mode==="outage"){json({code:"XX000",message:"fixture-private-project-outage"},503);return true;}
    if(action==="get_project_admin"){json(admin());return true;}
    if(action==="get_project_home"){
      const decisions=entries.filter(e=>e.kind==="decision");const notice=p=>({id:String(p.id),title:p.title,is_pinned:p.is_pinned,created_at:p.created_at});
      const all=posts().filter(p=>p.post_type==="notice"&&!p.deleted_at).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id);
      const status=entries.find(e=>e.kind==="status");
      json({statusConfigured:!!status,status:status?.data??null,events:entries.filter(e=>e.kind==="event"&&!e.deleted_at&&e.is_visible&&Date.parse(e.data.startsAt)>=Date.now()).sort((a,b)=>Date.parse(a.data.startsAt)-Date.parse(b.data.startsAt)).slice(0,3).map(e=>({...e.data,id:e.key})),
        decisions:all.filter(p=>decisions.some(e=>e.key===String(p.id)&&e.is_visible&&!e.superseded_by)).slice(0,3).map(p=>{const e=decisions.find(e=>e.key===String(p.id));return{...notice(p),decidedOn:e.data.decidedOn,pollsUnavailable:false,polls:pollOptions.filter(p=>e.related_poll_slugs.includes(p.slug)&&!p.is_hidden).map(({slug,title})=>({slug,title}))};}),
        notices:all.filter(p=>!decisions.some(e=>e.key===String(p.id))).slice(0,3).map(notice)});return true;
    }
    if(!active(body.p_actor_id)){fail("P4030",403);return true;}
    const kind=body.p_kind,key=body.p_key,old=entries.find(e=>e.kind===kind&&e.key===key),version=old?.version??0;
    if(version!==body.p_version){fail("P4090",409);return true;}
    let data=body.p_data,visible=true,slugs=[],successor=null,deleted=null;
    if(body.p_action==="restore"){
      const h=revisions.find(r=>r.id===body.p_history_id&&r.kind===kind&&r.key===key);if(!h){fail("P4040",404);return true;}
      data=copy(h.after_data.data);visible=h.after_data.is_visible;slugs=h.after_data.related_poll_slugs;successor=h.after_data.superseded_by;deleted=h.after_data.deleted_at;
    }else if(body.p_action==="delete"){
      if(kind!=="event"||!old){fail("22023");return true;}data=copy(old.data);visible=false;deleted=now();
    }else if(kind!=="status"){
      visible=data.isVisible;slugs=data.relatedPollSlugs??[];successor=data.supersededBy??null;data={...data};delete data.isVisible;delete data.relatedPollSlugs;delete data.supersededBy;
    }
    if(kind==="decision"){
      if(!posts().some(p=>String(p.id)===key&&p.post_type==="notice"&&!p.deleted_at)){fail("P4040",404);return true;}
      if(slugs.some(s=>!pollOptions.some(p=>p.slug===s))||successor===key){fail("22023");return true;}
      let link=successor,seen=new Set([key]);while(link){if(seen.has(link)){fail("22023");return true;}seen.add(link);const next=entries.find(e=>e.kind==="decision"&&e.key===link);if(!next){fail("22023");return true;}link=next.superseded_by;}
    }
    const entry={kind,key,data,board_post_id:kind==="decision"?key:null,superseded_by:successor,related_poll_slugs:slugs,is_visible:visible,deleted_at:deleted,version:version+1,updated_by:body.p_actor_id,updated_at:now()};
    const revision={id:String(++seq),kind,key,created_at:now(),before_data:old?copy(old):null,after_data:copy(entry)};
    entries=entries.filter(e=>e!==old);entries.push(entry);revisions.push(revision);json({key,version:entry.version});return true;
  }
  return{configure,handle,stats:()=>({projectHomeRequests:homeRequests})};
}
