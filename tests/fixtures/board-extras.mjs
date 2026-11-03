// Synthetic protocol fixture only. This is not a PostgreSQL or Storage emulator.
import { randomUUID } from "node:crypto";
export function boardExtras({ posts, comments, active, now }) {
  const likes = new Map(), commentLikes = new Map(), images = new Map(), objects = new Map(), failures = {};
  const consume = key => { if (!failures[key]) return false; failures[key]--; return true; };
  const visible = row => Object.fromEntries(Object.entries(row).filter(([k]) => !["storage_path", "uploaded_by", "sha256", "state", "upload_token", "updated_at"].includes(k)));
  const state = (map, id, actor) => ({ count: map.get(String(id))?.size ?? 0, liked: map.get(String(id))?.has(actor) ?? false });
  return {
    configure(body) { Object.assign(failures, body.extraFailures ?? {}); if (body.ageImages) for (const image of images.values()) image.updated_at = new Date(Date.now() - 125_000).toISOString(); },
    stats() { return { images: [...images.values()], storageCount: objects.size, postLikes: [...likes.values()].reduce((n,s) => n+s.size,0), commentLikes: [...commentLikes.values()].reduce((n,s) => n+s.size,0) }; },
    reset() { likes.clear(); commentLikes.clear(); images.clear(); objects.clear(); },
    handle({ req, res, url, raw, body, json, fail }) {
      const action = url.pathname.split("/").at(-1);
      const methods = ["get_board_engagement", "set_board_like", "reserve_board_image", "finish_board_image", "get_board_image", "begin_board_image_delete", "abort_board_image", "purge_board_image"];
      const storage = url.pathname.startsWith("/storage/v1/");
      if (!storage && !methods.includes(action)) return false;
      if (req.headers.apikey !== "fixture-only-backend-key") { fail("42501",403); return true; }
      const reply = value => { json(value); return true; }, reject = (code, status=400) => { fail(code,status); return true; };
      if (storage) {
        if (url.pathname === '/storage/v1/bucket/board-attachments' && req.method === 'GET') return reply({ id:'board-attachments',name:'board-attachments',public:!!failures.publicBucket,file_size_limit:3145728,allowed_mime_types:['image/webp'] });
        const prefix = "/storage/v1/object/", pathname = decodeURIComponent(url.pathname.slice(prefix.length));
        const key = pathname.replace(/^authenticated\//, "").replace(/^board-attachments\//, "");
        if (req.method === "POST") {
          if (consume("upload")) return reject("fixture-upload",503);
          if (objects.has(key)) return json({ statusCode:"409", error:"Duplicate", message:"The resource already exists" },409),true;
          objects.set(key,raw); return reply({ Key:`board-attachments/${key}`,Id:randomUUID() });
        }
        if (req.method === "DELETE") {
          if (consume("remove")) return reject("fixture-remove",503);
          for (const p of body.prefixes ?? []) objects.delete(p); return reply([]);
        }
        if (req.method === "GET") {
          if (consume("download")) return reject("fixture-download",503);
          if (!objects.has(key)) return reject("404",404);
          res.writeHead(200,{"Content-Type":"image/webp"});res.end(objects.get(key));return true;
        }
        return reject("404",404);
      }
      const post = posts().find(p => String(p.id) === String(body.p_post_id) && !p.deleted_at), actor = body.p_actor_id;
      if (action === "get_board_image") return reply(post ? images.get(body.p_id)?.state === "ready" && String(images.get(body.p_id).post_id) === String(post.id) ? images.get(body.p_id) : null : null);
      if (action === "abort_board_image") {
        const item=images.get(body.p_id);if(!item||item.upload_token!==body.p_token||item.state!=="pending")return reply(null);
        item.state="deleting";item.updated_at=now();return reply(item);
      }
      if (action === "purge_board_image") {
        if(consume("purge"))return reject("fixture-purge",503);
        const item=images.get(body.p_id);if(item&&item.upload_token===body.p_token&&["pending","deleting"].includes(item.state))images.delete(item.id);
        return reply({deleted:!images.has(body.p_id)});
      }
      if (!active(actor)) return reject("P4030");
      if (!post) return reject("P4040");
      const comment = body.p_comment_id == null ? null : comments().find(c=>String(c.id)===String(body.p_comment_id)&&c.post_id===post.id&&!c.deleted_at);
      if (action === "get_board_engagement") {
        if (consume("engagement"))return reject("PGRST202",404);
        const ids=body.p_comment_ids??[];if(ids.length>30)return reject("22023");
        if(ids.some(id=>!comments().some(c=>String(c.id)===String(id)&&c.post_id===post.id&&!c.deleted_at)))return reject("P4040");
        return reply({post:state(likes,post.id,actor),comments:Object.fromEntries(ids.map(id=>[id,state(commentLikes,id,actor)])),images:[...images.values()].filter(i=>i.post_id===post.id&&i.state==='ready').sort((a,b)=>a.sort_order-b.sort_order).map(visible)});
      }
      if (action === "set_board_like") {
        if (typeof body.p_liked!=="boolean") return reject("22023");
        if(body.p_comment_id!=null&&!comment)return reject("P4040");
        if(consume("like"))return reject("fixture-like",503);
        const target=comment?commentLikes:likes, key=String(comment?.id??post.id);
        const values=target.get(key)??new Set();if(body.p_liked)values.add(actor);else values.delete(actor);target.set(key,values);
        if(consume("likeLostAck"))return reject("fixture-lost-ack",503);
        return reply(state(target,key,actor));
      }
      if(post.author_id!==actor||(post.post_type==='notice'&&!body.p_is_admin))return reject("P4030");
      const image=images.get(body.p_id);
      if(action==='reserve_board_image'){
        if(consume("reserve"))return reject("fixture-reserve",503);
        if(image){
          if(image.post_id!==post.id||image.uploaded_by!==actor||image.sha256!==body.p_hash)return reject("P4090");
          if(image.state==='ready')return reply(image);
          if(Date.parse(image.updated_at)>Date.now()-120_000)return reject("P4090");
          Object.assign(image,{state:'pending',upload_token:body.p_token,updated_at:now()});return reply(image);
        }
        const slot=[0,1,2].find(n=>![...images.values()].some(i=>i.post_id===post.id&&i.sort_order===n));
        if(slot===undefined)return reject('P4090');
        const item={id:body.p_id,post_id:post.id,uploaded_by:actor,storage_path:`posts/${post.id}/${body.p_id}.webp`,content_type:'image/webp',byte_size:body.p_bytes,width:body.p_width,height:body.p_height,sort_order:slot,sha256:body.p_hash,state:'pending',upload_token:body.p_token,created_at:now(),updated_at:now()};images.set(item.id,item);return reply(item);
      }
      if(action==='finish_board_image'){
        if(!image||image.upload_token!==body.p_token||image.state!=='pending')return reject('P4090');
        if(consume('finish'))return reject('fixture-finish',503);
        image.state='ready';image.updated_at=now();
        if(consume('finishLostAck'))return reject('fixture-finish-lost-ack',503);
        return reply(image);
      }
      if(action==='begin_board_image_delete'){
        if(!image)return reply(null);if(image.post_id!==post.id)return reject('P4040');
        if(image.state==='pending'&&Date.parse(image.updated_at)>Date.now()-120_000)return reject('P4090');
        Object.assign(image,{state:'deleting',upload_token:body.p_token,updated_at:now()});return reply(image);
      }
      return reject('PGRST202');
    },
  };
}
