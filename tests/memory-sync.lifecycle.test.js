const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const workspace = path.resolve(__dirname, '..');
const recordsByScope = new Map();
let writeCount = 0;

function send(response, status, body, type = 'application/json; charset=utf-8') {
    response.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' });
    response.end(body === null ? '' : (type.startsWith('application/json') ? JSON.stringify(body) : body));
}
function cloudRecords(scope) { if (!recordsByScope.has(scope)) recordsByScope.set(scope, new Map()); return recordsByScope.get(scope); }

const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === '/memory-sync-test.html') return send(response, 200, `<!doctype html><meta charset="utf-8"><script>
        window.testRecords=[]; window.mergedRecords=[];
        window.MemoryApp={
            getSyncSnapshot:(bindingId)=>window.testRecords.filter((record)=>!bindingId||record.bindingId===bindingId),
            mergeSyncRecords:async(records)=>{ window.mergedRecords.push(...records); records.forEach((record)=>{ const index=window.testRecords.findIndex((item)=>item.id===record.id); if(index>=0) window.testRecords[index]={...window.testRecords[index],...record}; else window.testRecords.push(record); }); return records.length; }
        };
        const open=indexedDB.open('iOSDesktopDB',1);
        open.onupgradeneeded=()=>open.result.createObjectStore('layoutStore',{keyPath:'id'});
        window.dbReady=new Promise((resolve,reject)=>{ open.onsuccess=()=>{open.result.close();resolve();}; open.onerror=()=>reject(open.error); });
    <\/script><script src="/js/memory-sync.js"><\/script>`, 'text/html; charset=utf-8');
    if (request.method === 'OPTIONS') return send(response, 204, null);
    if (url.pathname === '/cloud/health') return send(response, 200, { ok: true });
    if (url.pathname === '/cloud/list') return send(response, 200, { records: [...cloudRecords(url.searchParams.get('scope') || '').values()] });
    if (url.pathname === '/cloud/search' && request.method === 'POST') { const chunks=[]; for await (const chunk of request) chunks.push(chunk); const body=JSON.parse(Buffer.concat(chunks)); const scope=body.scope?.namespace||body.scope||''; return send(response,200,{records:[...cloudRecords(scope).values()].filter((item)=>String(item.content||'').includes(String(body.query||''))).slice(0,body.limit||6)}); }
    const match = url.pathname.match(/^\/cloud\/records\/([^/]+)$/);
    if (match && request.method === 'PUT') { const chunks=[]; for await (const chunk of request) chunks.push(chunk); const body=JSON.parse(Buffer.concat(chunks)); const id=decodeURIComponent(match[1]); const stored={...body,id,remoteId:id}; cloudRecords(body.scope).set(id,stored); writeCount+=1; return send(response,200,stored); }
    if (match && request.method === 'DELETE') { cloudRecords(url.searchParams.get('scope')||'').delete(decodeURIComponent(match[1])); return send(response,204,null); }
    const relative=decodeURIComponent(url.pathname).replace(/^\/+/, ''); const filePath=path.resolve(workspace,relative);
    if (!filePath.startsWith(workspace)||!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()) return send(response,404,{error:'Not found'});
    send(response,200,fs.readFileSync(filePath),path.extname(filePath)==='.js'?'text/javascript; charset=utf-8':'application/octet-stream');
});

async function run() {
    const stage=(name)=>console.log('[memory-sync-test] '+name);
    const withTimeout=(promise,name,timeoutMs=15000)=>Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(name+' timed out')),timeoutMs))]);
    let browser;
    try {
        stage('start server'); await new Promise((resolve)=>server.listen(8877,'127.0.0.1',resolve));
        stage('launch browser'); browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'});
        const page=await browser.newPage(); const pageErrors=[]; page.on('pageerror',(error)=>pageErrors.push(error.message));
        stage('open harness'); await withTimeout(page.goto('http://127.0.0.1:8877/memory-sync-test.html',{waitUntil:'load'}),'open harness');
        await withTimeout(page.waitForFunction(()=>window.MemorySync&&window.dbReady),'initialize harness');
        stage('seed records');
        const seed=await withTimeout(page.evaluate(async()=>{ await window.dbReady; const now=new Date().toISOString(); window.testRecords=[
            {id:'memory_one',bindingId:'role_one',kind:'memory',tier:'L1',status:'active',content:'likes rain',revision:1,updatedAt:now,recordType:'memory'},
            {id:'summary_one',bindingId:'role_one',kind:'summary',tier:'L2',status:'active',content:'planning trip',sections:[{title:'recent',content:'planning trip',sourceMessageIds:['m1']}],revision:1,updatedAt:now,recordType:'summary'},
            {id:'chat_role_one_chat_1',localMessageId:'chat_1',bindingId:'role_one',kind:'chat',tier:'L3',status:'active',type:'sent',content:'hike weekend',updatedAt:now,recordType:'chat'}];
            await window.MemorySync.saveConfig({enabled:true,provider:'http',baseUrl:'http://127.0.0.1:8877/cloud',namespace:'test-user',autoSync:false,scope:{roles:'current',tiers:['L1','L2','L3'],includeChat:true,includeArchived:false}},{token:'test-token'}); return window.testRecords.length; }),'seed records');
        assert.strictEqual(seed,3);
        stage('first upload'); const first=await withTimeout(page.evaluate(()=>window.MemorySync.syncNow('role_one')),'first upload'); assert.strictEqual(first.uploaded,3); assert.strictEqual(cloudRecords('test-user:role_one').size,3);
        const firstWrites=writeCount; stage('idempotent upload'); await withTimeout(page.evaluate(()=>window.MemorySync.syncNow('role_one')),'idempotent upload'); assert.strictEqual(writeCount,firstWrites);
        stage('update'); await page.evaluate(()=>{const item=window.testRecords.find((record)=>record.id==='memory_one'); item.content='walks in rain'; item.revision+=1; item.updatedAt=new Date().toISOString();}); await withTimeout(page.evaluate(()=>window.MemorySync.syncNow('role_one')),'update'); assert.strictEqual(cloudRecords('test-user:role_one').get('memory_one').content,'walks in rain');
        stage('conflict merge');
        await page.evaluate(()=>{const item=window.testRecords.find((record)=>record.id==='memory_one'); item.content='local conflict wins'; item.revision+=1; item.updatedAt=new Date(Date.now()+2000).toISOString();});
        const remoteConflict={...cloudRecords('test-user:role_one').get('memory_one'),content:'remote conflict',revision:99,updatedAt:new Date(Date.now()+1000).toISOString()};
        cloudRecords('test-user:role_one').set('memory_one',remoteConflict);
        const conflictResult=await withTimeout(page.evaluate(()=>window.MemorySync.syncNow('role_one')),'conflict merge');
        assert.ok(conflictResult.conflicts>=1);
        assert.strictEqual(cloudRecords('test-user:role_one').get('memory_one').content,'local conflict wins');
        stage('restore'); cloudRecords('test-user:role_one').set('remote_only',{id:'remote_only',remoteId:'remote_only',bindingId:'role_one',kind:'memory',tier:'L1',status:'active',content:'remote restore',revision:1,updatedAt:new Date().toISOString(),recordType:'memory'}); const restored=await withTimeout(page.evaluate(()=>window.MemorySync.restoreNow('role_one')),'restore'); assert.ok(restored.restored>=1); assert.ok(await page.evaluate(()=>window.testRecords.some((record)=>record.content==='remote restore')));
        stage('delete'); await page.evaluate(()=>{const item=window.testRecords.find((record)=>record.id==='memory_one'); item.status='archived'; item.archiveReason='user_deleted'; item.updatedAt=new Date().toISOString();}); await withTimeout(page.evaluate(()=>window.MemorySync.syncNow('role_one')),'delete'); assert.ok(!cloudRecords('test-user:role_one').has('memory_one'));
        assert.deepStrictEqual(pageErrors,[]); stage('complete'); console.log(JSON.stringify({ok:true,uploaded:first.uploaded,restored:restored.restored,writes:writeCount}));
    } finally { if(browser) await browser.close().catch(()=>null); if(server.listening) await new Promise((resolve)=>server.close(resolve)); }
}
run().catch((error)=>{console.error(error);process.exitCode=1;});
