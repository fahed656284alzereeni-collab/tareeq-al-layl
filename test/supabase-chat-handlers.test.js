"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createSupabaseChatHandlers } = require("../supabase-chat-handlers");

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    set(name,value) { this.headers[name]=value; return this; },
    json(value) { this.body=value; return this; }
  };
}

function setup(overrides = {}) {
  const calls=[];
  const repository = {
    listConversations: async()=>[{id:"conversation-1"}],
    getConversationDetails: async id=>({id}),
    getConversationMessages: async(id,options)=>[{id,options}],
    createDirectConversation: async id=>{calls.push(["direct",id]);return "conversation-2";},
    createGroupConversation: async(title,ids)=>{calls.push(["group",title,ids]);return "group-1";},
    sendMessage: async input=>{calls.push(["send",input]);return {id:"message-1"};},
    markMessageRead: async id=>calls.push(["read",id]),
    markMessageDelivered: async id=>calls.push(["delivered",id]),
    hideConversationForMe: async id=>calls.push(["hide",id]),
    clearConversationForMe: async id=>calls.push(["clear-me",id]),
    clearConversationForEveryone: async id=>calls.push(["clear-all",id]),
    deleteDirectConversation: async id=>calls.push(["delete",id]),
    editMessage: async(id,body)=>calls.push(["edit",id,body]),
    deleteMessageForEveryone: async id=>calls.push(["delete-message",id]),
    sendFriendRequest: async id=>{calls.push(["friend-request",id]);return "request-1";},
    acceptFriendRequest: async id=>calls.push(["accept",id]),
    declineFriendRequest: async id=>calls.push(["decline",id]),
    blockUser: async id=>calls.push(["block",id]),
    unblockUser: async id=>calls.push(["unblock",id]),
    ...overrides.repository
  };
  const verifier={verifyRequest:async req=>{calls.push(["verify",req]);return {uid:"verified-user"};}};
  const handlers=createSupabaseChatHandlers({
    verifier,
    createUserClient: token=>{calls.push(["client",token]);return {token};},
    createRepository:(client,uid)=>{calls.push(["repository",client.token,uid]);return repository;}
  });
  return {handlers,calls};
}

test("chat handler verifies the bearer token and scopes repository to verified identity", async()=>{
  const {handlers,calls}=setup();
  const res=response();
  await handlers.listConversations({headers:{authorization:"Bearer access-token"}},res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(res.body,{success:true,conversations:[{id:"conversation-1"}]});
  assert.deepEqual(calls.filter(x=>["client","repository"].includes(x[0])),[
    ["client","access-token"],["repository","access-token","verified-user"]
  ]);
});

test("chat handler forwards validated conversation and message operations", async()=>{
  const {handlers,calls}=setup();
  const createRes=response();
  await handlers.createDirectConversation({headers:{authorization:"Bearer token"},body:{otherUserId:"other-user"}},createRes);
  assert.deepEqual(createRes.body,{success:true,conversationId:"conversation-2"});
  const sendRes=response();
  await handlers.sendMessage({headers:{authorization:"Bearer token"},body:{conversationId:"conversation-1",body:"Hello"}},sendRes);
  assert.deepEqual(sendRes.body,{success:true,message:{id:"message-1"}});
  assert.deepEqual(calls.filter(x=>x[0]==="direct"||x[0]==="send"),[
    ["direct","other-user"],["send",{conversationId:"conversation-1",body:"Hello"}]
  ]);
});

test("chat handler returns 401 when Supabase authentication fails", async()=>{
  const handlers=createSupabaseChatHandlers({
    verifier:{verifyRequest:async()=>{const e=new Error("bad token");e.code="AUTH_INVALID";throw e;}},
    createUserClient:()=>{throw new Error("must not create a client");}
  });
  const res=response();
  await handlers.listConversations({headers:{authorization:"Bearer invalid"}},res);
  assert.equal(res.statusCode,401);
  assert.equal(res.body.success,false);
  assert.equal(res.body.code,"AUTH_INVALID");
});

test("chat handler maps invalid message input to a client error", async()=>{
  const {handlers}=setup({repository:{sendMessage:async()=>{const e=new Error("Message is too long.");e.code="MESSAGE_TOO_LONG";throw e;}}});
  const res=response();
  await handlers.sendMessage({headers:{authorization:"Bearer token"},body:{}},res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.code,"MESSAGE_TOO_LONG");
});
