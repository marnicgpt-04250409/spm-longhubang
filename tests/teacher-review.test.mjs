import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const strip = source=>source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,"");
const route = strip(await readFile(new URL("../app/api/teacher/questions/route.ts",import.meta.url),"utf8"));
const validator = await readFile(new URL("../lib/question-publication.ts",import.meta.url),"utf8");
let contextId=0;
async function handler(denied=false) {
  const stub = `
    const contextId=${++contextId};
    export const writes=[],filters=[],selections=[];
    export const current={id:"question",subject:"Biologi",status:"draft",prompt:"Apakah fungsi ribosom?",option_a:"Sintesis protein",option_b:"Respirasi",option_c:"Pengangkutan",option_d:"Pencernaan",correct_option:"A",answer_confirmed:true,image_path:null};
    const requireBankManager=async()=>{${denied?'throw new Response("Forbidden",{status:403});':'return {id:"owner"};'}};
    const apiError=error=>{if(error instanceof Response)return error;throw error};
    const signedQuestionImageUrls=async()=>new Map();
    const getAdminClient=()=>({from(){let values;
      const query={select:columns=>{selections.push(columns);return query},eq:(key,value)=>{filters.push([key,value]);return query},order:()=>query,
        range:async()=>({data:[current],error:null,count:1}),maybeSingle:async()=>({data:current,error:null}),
        update:update=>{values=update;return query},single:async()=>{writes.push(values);Object.assign(current,values);return {data:current,error:null}}};return query;
    }});
  `;
  const output=ts.transpileModule(stub+validator+route,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}
test("teacher review exposes the stored answer to its manager and saves answer with content",async()=>{
  const api=await handler();
  const listed=await api.GET(new Request("https://example.test/api/teacher/questions"));
  assert.equal((await listed.json()).questions[0].correct_option,"A");
  assert.ok(api.selections[0].split(",").includes("correct_option"));
  const response=await api.PATCH(new Request("https://example.test",{method:"PATCH",body:JSON.stringify({id:"question",prompt:"Updated question",correctOption:"B"})}));
  assert.equal(response.status,200);
  assert.deepEqual(api.writes[0],{prompt:"Updated question",correct_option:"B",answer_confirmed:true});
  assert.ok(api.filters.some(([key,value])=>key==="author_id"&&value==="owner"));
  const invalid=await api.PATCH(new Request("https://example.test",{method:"PATCH",body:JSON.stringify({id:"question",prompt:"No save",correctOption:"E"})}));
  assert.equal(invalid.status,400);
  assert.equal(api.writes.length,1);
});
test("editing published content retains publication checks and denied requests stop before data access",async()=>{
  const api=await handler();
  api.current.status="published";
  const invalid=await api.PATCH(new Request("https://example.test",{method:"PATCH",body:JSON.stringify({id:"question",prompt:"Rajah 1 menunjukkan sel.",correctOption:"A"})}));
  assert.equal(invalid.status,400);
  assert.equal(api.writes.length,0);
  const denied=await handler(true);
  for(const method of ["GET","POST","PATCH"]){
    const response=await denied[method](new Request("https://example.test",{method}));
    assert.equal(response.status,403);
  }
  assert.equal(denied.selections.length,0);
});
