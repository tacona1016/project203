import assert from "node:assert/strict";

// Actual Next HTTP boundary; only fake fixture rows, never production writes.
export async function runBoardListLikeChecks({ a, b, id }) {
  const control=async body=>(await fetch("http://127.0.0.1:3103/_test",{method:"POST",body:JSON.stringify(body??{})})).json();
  const input={title:"List likes fixture",content:"Synthetic list only",post_type:"general",is_pinned:false};
  const r=await a.call("/api/board/posts","POST",input);assert.equal(r.status,200);const post=(await r.json()).id;
  const list=async route=>{const before=await control();const response=await a.call(route);assert.equal(response.status,200);const data=await response.json();const after=await control();
    assert.equal(after.listLikesRequests-before.listLikesRequests,data.pinned.length+data.posts.length?1:0);
    if(data.pinned.length+data.posts.length){assert.equal(after.lastListLikesQuery.select,"post_id");assert(after.lastListLikesQuery.exact);assert.deepEqual(new Set(after.lastListLikesQuery.ids),new Set([...data.pinned,...data.posts].map(p=>String(p.id))));}
    return data;};
  const find=(p,postId)=>[...p.posts,...p.pinned].find(p=>String(p.id)===String(postId));
  const route=`/api/board/posts?q=${encodeURIComponent(input.title)}`;
  assert.equal(find(await list(route),post).like_count,0);
  assert.equal((await a.call(`/api/board/posts/${post}/like`,"PUT")).status,200);
  assert.equal(find(await list(route),post).like_count,1);
  assert.equal((await b.call(`/api/board/posts/${post}/like`,"PUT")).status,200);
  assert.equal(find(await list(route),post).like_count,2);
  assert.equal((await a.call(`/api/board/posts/90/like`,"PUT")).status,200);
  const mixed=await list("/api/board/posts");assert.equal(find(mixed,90).like_count,1);assert(mixed.posts.some(p=>p.like_count===0));
  for(let i=0;i<11;i++)assert.equal((await a.call("/api/board/posts","POST",{...input,title:`Paged likes fixture ${i}`})).status,200);
  const second=await list("/api/board/posts?q=Paged&page=2");assert.equal(second.posts.length,1);assert.equal(second.posts[0].like_count,0);
  for(const failure of ["listLikes","listLikesTruncated"]){await control({extraFailures:{[failure]:1}});const unknown=await list(route);assert.equal(find(unknown,post).like_count,null);}
  assert.equal((await a.call(`/api/board/posts/${post}/like`,"DELETE")).status,200);assert.equal(find(await list(route),post).like_count,1);
  assert(!JSON.stringify(await list(route)).includes(id(2)),"No liker identities in list payload");
  await list("/api/board/posts?q=definitely-no-matching-fixture-post");
  // Restore the existing pinned notice's state for other suites.
  await a.call("/api/board/posts/90/like","DELETE");
  return ["Board list likes batch only current page + pinned post IDs once, preserve zero/unknown and search/page metadata; no liker identities; existing likes add/cancel stay consistent"];
}
