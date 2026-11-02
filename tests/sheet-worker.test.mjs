import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(new URL("../lib/google-sheets-queue.ts",import.meta.url),"utf8")).replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,"");
let contextId = 0;
async function worker({claimed=true,fail=false,configured=true}={}) {
  const stub = `
    const contextId = ${++contextId};
    export const calls = [];
    export let writes = 0;
    const randomUUID = () => "test-lease";
    const isGoogleSheetSyncConfigured = () => ${configured};
    const writeGoogleSheetSnapshot = async () => {writes++; ${fail ? 'throw Object.assign(new Error("PRIVATE_PROVIDER_PAYLOAD"),{response:{status:429}});' : 'return {configured:true,students:12,attempts:240};'}};
    const getAdminClient = () => ({rpc: async(name,args) => {calls.push({name,args}); return {error:null,data:name==="claim_sheet_sync"?{claimed:${claimed}}:true};}});
  `;
  const compiled = ts.transpileModule(stub+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
test("busy workers do not write the provider and successful workers acknowledge their lease",async()=>{
  const busy = await worker({claimed:false});
  assert.equal((await busy.drainGoogleSheetQueue()).queued,true);
  assert.equal(busy.writes,0);
  const ready = await worker();
  assert.equal((await ready.drainGoogleSheetQueue()).students,12);
  assert.equal(ready.writes,1);
  assert.deepEqual(ready.calls.at(-1),{name:"finish_sheet_sync",args:{p_token:"test-lease",p_success:true,p_error:null}});
});
test("provider failures release for retry without storing private request contents",async()=>{
  const failed = await worker({fail:true});
  await assert.rejects(failed.drainGoogleSheetQueue(),/自动重试/);
  assert.deepEqual(failed.calls.at(-1),{name:"finish_sheet_sync",args:{p_token:"test-lease",p_success:false,p_error:"Provider HTTP 429"}});
  assert.doesNotMatch(JSON.stringify(failed.calls),/PRIVATE_PROVIDER_PAYLOAD/);
});
test("manual sync persists a request while unconfigured workers make no calls",async()=>{
  const ready = await worker();
  await ready.syncGoogleSheetSnapshot();
  assert.equal(ready.calls[0].name,"request_sheet_sync");
  const missing = await worker({configured:false});
  assert.equal((await missing.syncGoogleSheetSnapshot()).configured,false);
  assert.equal(missing.calls.length,0);
});
