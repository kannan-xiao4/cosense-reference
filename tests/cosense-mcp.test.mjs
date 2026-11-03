import test from 'node:test';
import assert from 'node:assert/strict';
import {handleMcp, runTool} from '../src/cosense-mcp.ts';
const env={COSENSE_PAT:'test-only-secret',COSENSE_PROJECT:'example-project',COSENSE_ENABLE_WRITES:'true'};
const pageId='0123456789abcdef01234567';
const snapshotId='abcdef0123456789abcdef01';
let seen=[];
let respond=()=>({});
globalThis.fetch=async(url,init)=>{seen.push({url,init});return Response.json(respond(url,init));};
const call=(name,args={},identity=true)=>handleMcp(new Request('https://site.test/mcp',{method:'POST',headers:identity?{'oai-authenticated-user-id':'test-user'}:{},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),env);
test('MCP authentication, discovery and operation annotations',async()=>{
  assert.equal((await call('cosense_status',{},false)).status,401);
  const r=await handleMcp(new Request('https://site.test/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),env);
  const tools=(await r.json()).result.tools;assert.equal(tools.length,13);assert.equal(tools.filter(t=>t.annotations.readOnlyHint).length,10);assert.equal(tools.find(t=>t.name==='cosense_submit_edit').annotations.destructiveHint,true);
  assert.equal((await (await call('cosense_submit_edit')).json()).result.isError,true);
});
test('strict validation rejects escaped scope, invalid IDs, unknown fields and oversized input',async()=>{
  for(const [name,args] of [['cosense_get_page',{title:'..'}],['cosense_page_changes',{pageId:'../x'}],['cosense_page_changes',{pageId,since:pageId,before:pageId}],['cosense_search',{query:'x',project:'other'}],['cosense_related_pages',{title:'x',hop:3}]]) await assert.rejects(runTool(name,args,env),/INVALID_ARGUMENTS/);
  const r=await handleMcp(new Request('https://site.test/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'test'},body:'x'.repeat(140000)}),env);assert.equal(r.status,413);
});
test('richer page data and markdown retain IDs and source links',async()=>{
  respond=()=>({id:pageId,commitId:snapshotId,title:'Book',persistent:true,lines:[{id:'line',text:'Reference',userId:'writer',updated:10}],links:['Other'],infobox:{author:'example'}});
  const r=await runTool('cosense_get_page',{title:'Book',format:'markdown'},env);assert.equal(r.commitId,snapshotId);assert.equal(r.lines[0].userId,'writer');assert.match(r.markdown,/#line/);assert.equal(r.untrustedContent,true);
});
test('full-text OR and vector search use distinct endpoints and flag truncation',async()=>{
  seen=[];respond=()=>({count:2,pages:[{title:'A'},{title:'B'}]});
  const r=await runTool('cosense_search',{query:'A B',op:'or',sort:'pageRank',limit:1},env);assert.equal(r.responseTruncated,true);assert.match(seen[0].url,/op=or/);assert.match(seen[0].url,/sort=pageRank/);
  await runTool('cosense_search_vector',{query:'Book'},env);assert.match(seen[1].url,/search\/vector\/titles/);
});
test('listing exposes metadata, filters and next offset',async()=>{
  seen=[];respond=()=>({count:3,pages:[{id:pageId,title:'A'}]});const r=await runTool('cosense_list_pages',{skip:1,limit:1,sort:'title',filter:'reader'},env);assert.equal(r.nextSkip,2);assert.equal(r.pages[0].id,pageId);assert.match(seen[0].url,/filterType=icon/);
});
test('related pages classify outgoing, incoming and bidirectional links, 2-hop search',async()=>{
  respond=url=>url.includes('links1hop')?{links1hop:[{title:'A',titleLc:'a',linksLc:['book']},{title:'B',titleLc:'b',linksLc:[]},{title:'C',titleLc:'c',linksLc:['book']}]}:url.includes('links2hop')?{links2hop:[{title:'D'}]}:{title:'Book',linksLc:['a','b']};
  const r=await runTool('cosense_related_pages',{title:'Book'},env);assert.deepEqual(r.pages.map(p=>p.relation),['bidirectional','outgoing','incoming']);
  seen=[];await runTool('cosense_related_pages',{title:'Book',hop:2,query:'test',op:'or'},env);assert.match(seen[0].url,/links2hop\?search=test&op=or/);
});
test('change history exposes typed events and correct cursor direction',async()=>{
  respond=()=>({hasMore:true,commits:[{id:snapshotId,changes:[{title:'New title'},{_update:'line',lines:{text:'new',origText:'old'}}]}]});
  const r=await runTool('cosense_page_changes',{pageId},env);assert.equal(r.nextBefore,snapshotId);assert.equal(r.events[0].kind,'title');assert.equal(r.events[1].originalText,'old');
  seen=[];const newer=await runTool('cosense_page_changes',{pageId,since:pageId},env);assert.equal(newer.nextSince,snapshotId);assert.match(seen[0].url,/head=/);
});
test('snapshot list and content preserve historical lines',async()=>{
  respond=url=>url.endsWith(snapshotId)?{page:{id:pageId,title:'Current'},snapshot:{title:'Old',lines:[{id:'old-line',text:'old text'}]}}:{timestamps:[{id:snapshotId,created:10}]};
  const r=await runTool('cosense_list_snapshots',{pageId},env);assert.equal(r.timestamps[0].id,snapshotId);
  const snap=await runTool('cosense_get_snapshot',{pageId,snapshotId},env);assert.equal(snap.snapshot.lines[0].text,'old text');
});
test('file info enforces project ownership and prevents arbitrary URL fetching',async()=>{
  respond=()=>({id:pageId,projectName:'other-project',text:'not permitted'});await assert.rejects(runTool('cosense_file_info',{fileId:pageId},env),/FILE_PROJECT_NOT_ALLOWED/);
  await assert.rejects(runTool('cosense_file_info',{fileId:'https://evil.example/files/'+pageId},env),/INVALID_ARGUMENTS/);
  respond=()=>({id:pageId,projectName:'example-project',text:'x'.repeat(10001)});const r=await runTool('cosense_file_info',{fileId:'https://scrapbox.io/files/'+pageId+'.pdf'},env);assert.equal(r.text.length,10000);
});
test('status verifies private access and every upstream request is a no-redirect GET',async()=>{
  seen=[];respond=()=>({pages:[]});const r=await runTool('cosense_status',{},env);assert.equal(r.privateAccessVerified,true);assert.equal(r.toolCount,13);
  for(const req of seen){assert.equal(req.init.method,'GET');assert.equal(req.init.redirect,'manual');assert.ok(req.url.startsWith('https://scrapbox.io/api/'));}
});
test('creation preview translates body, signs caller-bound token, and makes no submit request',async()=>{
  seen=[];respond=()=>({previewId:'preview-1',expireAt:new Date(Date.now()+300000).toISOString(),pagePreview:{persistent:false,title:'New',lines:[]},changedLinks:[]});
  const r=await runTool('cosense_preview_edit',{body:'New\nbody\n'},env,'owner');
  assert.equal(r.operation,'create');assert.equal(r.requiresSubmit,true);assert.ok(r.previewToken);assert.equal(seen.length,1);assert.match(seen[0].url,/preview$/);assert.equal(seen[0].init.method,'POST');
  const sent=JSON.parse(seen[0].init.body);assert.equal(sent.changes.length,2);assert.equal(sent.changes[1].lines.text,'body');assert.match(sent.changes[0].lines.id,/^[a-f0-9]{24}$/);
  await assert.rejects(runTool('cosense_submit_edit',{previewToken:r.previewToken},env,'other'),/INVALID_PREVIEW_TOKEN/);
  await assert.rejects(runTool('cosense_submit_edit',{previewToken:r.previewToken+'tampered'},env,'owner'),/INVALID_PREVIEW_TOKEN/);
  await assert.rejects(runTool('cosense_submit_edit',{previewToken:r.previewToken},{...env,COSENSE_PAT:'rotated-secret'},'owner'),/INVALID_PREVIEW_TOKEN/);
  assert.equal(seen.length,1);
  respond=()=>({commitId:snapshotId,page:{title:'New'}});
  const saved=await runTool('cosense_submit_edit',{previewToken:r.previewToken},env,'owner');assert.equal(saved.title,'New');assert.match(saved.url,/New$/);assert.equal(JSON.parse(seen[1].init.body).previewId,'preview-1');
});
test('existing page operations support append, replacement including blank text, deletion and rename',async()=>{
  seen=[];respond=()=>({previewId:'preview-2',expireAt:new Date(Date.now()+300000).toISOString(),pagePreview:{title:'Renamed',lines:[]}});
  const r=await runTool('cosense_preview_edit',{pageId,ops:[{insertBefore:'_end',text:'A\nB'},{replace:pageId,text:''},{delete:snapshotId}]},env,'owner');
  assert.equal(r.operation,'update');const sent=JSON.parse(seen[0].init.body);assert.equal(sent.pageId,pageId);assert.equal(sent.changes.length,4);assert.equal(sent.changes[2].lines.text,'');assert.equal(sent.changes[3]._delete,snapshotId);
  await assert.rejects(runTool('cosense_preview_edit',{pageId,ops:[{replace:pageId,text:'bad\nmultiline'}]},env,'owner'),/INVALID_ARGUMENTS/);
  await assert.rejects(runTool('cosense_preview_edit',{pageId,ops:[{replace:pageId,delete:pageId,text:'bad'}]},env,'owner'),/INVALID_ARGUMENTS/);
  await assert.rejects(runTool('cosense_preview_edit',{body:'New',pageId},env,'owner'),/INVALID_ARGUMENTS/);
  await assert.rejects(runTool('cosense_preview_edit',{body:'New'},env),/WRITE_IDENTITY_REQUIRED/);
});
test('deletion requires explicit server deletion marker, and expired receipts cannot submit',async()=>{
  respond=()=>({previewId:'delete-preview',expireAt:new Date(Date.now()+300000).toISOString(),pagePreview:{title:'Test',lines:[]}});
  await assert.rejects(runTool('cosense_preview_delete',{pageId},env,'owner'),/INVALID_UPSTREAM_RESPONSE/);
  respond=()=>({previewId:'delete-preview',pageDelete:true,expireAt:new Date(Date.now()+1000).toISOString(),pagePreview:{title:'Test',lines:[]}});
  const r=await runTool('cosense_preview_delete',{pageId},env,'owner');assert.equal(r.operation,'delete');
  const actualNow=Date.now;try{Date.now=()=>actualNow()+2000;await assert.rejects(runTool('cosense_submit_edit',{previewToken:r.previewToken},env,'owner'),/INVALID_PREVIEW_TOKEN/);}finally{Date.now=actualNow;}
  respond=()=>({commitId:snapshotId,pageDeleted:{title:'Test'}});const deleted=await runTool('cosense_submit_edit',{previewToken:r.previewToken},env,'owner');assert.equal(deleted.deleted,true);assert.equal(deleted.url,undefined);
});
test('upstream failures never echo token or response text',async()=>{
  globalThis.fetch=async()=>new Response('SECRET upstream body',{status:403});
  const r=await (await call('cosense_get_page',{title:'Book'})).json();assert.equal(r.result.isError,true);assert.match(r.result.content[0].text,/COSENSE_HTTP_403/);assert.ok(!JSON.stringify(r).includes('test-only-secret'));assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('ambiguous submits and conflicts are explicit and never automatically retried',async()=>{
  globalThis.fetch=async()=>Response.json({previewId:'outcome-preview',expireAt:new Date(Date.now()+300000).toISOString(),pagePreview:{title:'Test',lines:[]}});
  const p=await runTool('cosense_preview_edit',{body:'Test'},env,'owner');
  for(const [status,expected] of [[500,'WRITE_OUTCOME_UNKNOWN'],[409,'WRITE_CONFLICT'],[404,'PREVIEW_EXPIRED_OR_USED']]){
    let calls=0;globalThis.fetch=async()=>{calls++;return new Response('upstream',{status});};
    await assert.rejects(runTool('cosense_submit_edit',{previewToken:p.previewToken},env,'owner'),new RegExp(expected));assert.equal(calls,1);
  }
  globalThis.fetch=async()=>{throw new Error('network timeout');};
  await assert.rejects(runTool('cosense_submit_edit',{previewToken:p.previewToken},env,'owner'),/WRITE_OUTCOME_UNKNOWN/);
});
