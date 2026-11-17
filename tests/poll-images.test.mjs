import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { encodePrivateImage, ImageInputError } from "../lib/images/codec.ts";
import { encodeBoardImage } from "../lib/board/image-codec.ts";
import { POLL_IMAGES, optionImage, publicPollImage, missingPollImageSchema } from "../lib/poll-images/model.ts";
import { choiceResultRows } from "../lib/poll-view.ts";

test("Poll policy is independent; shared encoder preserves exact Board behavior", async () => {
  const input=await sharp({create:{width:240,height:120,channels:4,background:'#2453df88'}}).png().withMetadata({orientation:6}).toBuffer();
  const encoded=await encodePrivateImage(input,'image/png',POLL_IMAGES), board=await encodeBoardImage(input,'image/png');
  assert.deepEqual(encoded.bytes,board.bytes);assert(encoded.bytes.length<=500000);
  assert.equal(encoded.width,120);assert.equal(encoded.height,240);
  const meta=await sharp(encoded.bytes).metadata();assert.equal(meta.format,'webp');assert(meta.hasAlpha);assert(!meta.exif&&!meta.xmp&&!meta.icc);
  assert.equal(encoded.sha256,createHash('sha256').update(encoded.bytes).digest('hex'));
});
test("Poll encoder verifies actual signature/MIME, decode, original size and pixel bounds",async()=>{
  const png=await sharp({create:{width:10,height:5,channels:3,background:'red'}}).png().toBuffer();
  for(const [bytes,type,status]of [[png,'image/jpeg',415],[png,'image/svg+xml',415],[new Uint8Array(3145729),'image/png',413],[new Uint8Array(),'image/png',413],[png.slice(0,16),'image/png',415]])await assert.rejects(encodePrivateImage(bytes,type,POLL_IMAGES),e=>e instanceof ImageInputError&&e.status===status);
  const large=await sharp({create:{width:4100,height:4100,channels:3,background:'red'}}).png().toBuffer();
  await assert.rejects(encodePrivateImage(large,'image/png',POLL_IMAGES),e=>e.status===415);
});
test("JPG PNG WebP all yield <=500000-byte WebP without enlargement",async()=>{
  for(const [format,type]of [['jpeg','image/jpeg'],['png','image/png'],['webp','image/webp']]){
    const input=await sharp({create:{width:600,height:400,channels:3,background:'#65785a'}}).toFormat(format).toBuffer();
    const encoded=await encodePrivateImage(input,type,POLL_IMAGES);assert(encoded.bytes.length>0&&encoded.bytes.length<=500000);assert.equal(encoded.width,600);assert.equal(encoded.height,400);
  }
});
test("Public poll image metadata excludes path, actor, hash and lease",()=>{
  const row={id:'image',poll_id:1,option_id:101,byte_size:400000,width:100,height:50,sort_order:0,storage_path:'private',uploaded_by:'actor',sha256:'hash',upload_token:'secret'};
  assert.deepEqual(Object.keys(publicPollImage(row)).sort(),['id','poll_id','option_id','byte_size','width','height','sort_order'].sort());
  assert(missingPollImageSchema({code:'PGRST205',message:'poll_images not found'}));assert(!missingPollImageSchema({code:'XX000',message:'poll_images timeout'}));assert(!missingPollImageSchema({code:'PGRST202',message:'get_poll_detail missing'}));
});
test("Option images use stable IDs through result sorting, never array index",()=>{
  const options=[{id:101,label:'A'},{id:102,label:'B'}],images=[{id:'B-photo',option_id:'102'},{id:'question',option_id:null}];
  const rows=choiceResultRows(options,{counts:{101:1,102:3},total_votes:4,participant_count:4},false,'votes');
  assert.equal(rows[0].option.id,102);assert.equal(optionImage(images,rows[0].option.id).id,'B-photo');assert.equal(optionImage(images,101),undefined);
});
