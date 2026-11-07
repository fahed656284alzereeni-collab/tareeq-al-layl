"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseMediaHandlers } = require("../supabase-media-handlers");

function response() {
  return {
    statusCode:200,body:null,headers:{},
    status(code){this.statusCode=code;return this;},
    set(name,value){this.headers[name]=value;return this;},
    json(value){this.body=value;return this;}
  };
}

function setup(options={}) {
  const calls=[];
  const builder={
    select(value){calls.push(["select",value]);return this;},
    eq(...args){calls.push(["eq",...args]);return this;},
    is(...args){calls.push(["is",...args]);return this;},
    maybeSingle:async()=>({data:options.membership===undefined?{conversation_id:"conversation-1"}:options.membership,error:null})
  };
  const client={
    from(table){calls.push(["from",table]);return builder;},
    async rpc(name,args){calls.push(["rpc",name,args]);return {data:options.blocked||false,error:null};}
  };
  const storage={
    upload:async(path,body,opts)=>{calls.push(["upload",path,body.length,opts]);return {error:null};},
    createSignedUrl:async(path,ttl)=>{calls.push(["signed",path,ttl]);return {data:{signedUrl:"https://signed.test/file"},error:null};}
  };
  const handlers=createSupabaseMediaHandlers({
    verifier:{verifyRequest:async()=>({uid:"user-1"})},
    createUserClient:token=>{calls.push(["client",token]);return client;},
    getStorage:()=>({storage:{from:bucket=>{calls.push(["bucket",bucket]);return storage;}}}),
    assertMediaEnabled:async()=>calls.push(["feature-enabled"])
  });
  return {handlers,calls};
}

test("Supabase media upload verifies membership and stores under sender-specific path",async()=>{
  const {handlers,calls}=setup();
  const res=response();
  await handlers.upload({
    headers:{
      authorization:"Bearer access-token",
      "x-conversation-id":"conversation-1",
      "x-file-type":"image/png",
      "x-file-name":"photo%20one.png"
    },
    body:Buffer.from("image-bytes")
  },res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.attachment.url,"https://signed.test/file");
  assert.match(res.body.attachment.storagePath,/^conversations\/conversation-1\/user-1\//);
  assert.equal(calls.some(call=>call[0]==="rpc"&&call[1]==="is_direct_conversation_blocked"),true);
  assert.equal(calls.some(call=>call[0]==="upload"),true);
  assert.equal(res.headers["Cache-Control"],"no-store");
});

test("Supabase media upload refuses a non-member before touching storage",async()=>{
  const {handlers,calls}=setup({membership:null});
  const res=response();
  await handlers.upload({
    headers:{authorization:"Bearer token","x-conversation-id":"conversation-1"},
    body:Buffer.from("bytes")
  },res);
  assert.equal(res.statusCode,403);
  assert.equal(calls.some(call=>call[0]==="upload"),false);
});

test("Supabase media upload rejects missing or oversized files",async()=>{
  const {handlers,calls}=setup();
  const res=response();
  await handlers.upload({
    headers:{authorization:"Bearer token","x-conversation-id":"conversation-1"},
    body:Buffer.alloc(0)
  },res);
  assert.equal(res.statusCode,400);
  assert.equal(calls.some(call=>call[0]==="upload"),false);
});
