import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import * as XLSX from "xlsx";

globalThis.__myguruTestSheetJs = XLSX;
const source=(await readFile(new URL("../app/api/teacher/imports/route.ts",import.meta.url),"utf8")).replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,"");
let contextId=0;
async function handler(){
  const stub=`
    const contextId=${++contextId};
    const XLSX=globalThis.__myguruTestSheetJs;
    export const stored=[];
    const existing=new Set();
    const requireBankManager=async()=>({id:"owner"});
    const apiError=error=>{throw error};
    const QUESTION_IMAGE_BUCKET="question-images";
    const validQuestionImagePath=()=>true;
    const getAdminClient=()=>({
      storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null})})},
      from(table){const query={select:()=>query,in:async(_,hashes)=>({data:hashes.filter(hash=>existing.has(hash)).map(content_hash=>({content_hash})),error:null}),
        insert:rows=>{if(table==="questions"){stored.push(...rows);rows.forEach(row=>existing.add(row.content_hash));}return query},
        single:async()=>({data:{id:"upload"},error:null})};return query;
      }
    });
  `;
  const compiled=ts.transpileModule(stub+source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const question=i=>({"科目":"Sains","题干":`Apakah fungsi sel ${i}?`,A:"Sintesis protein",B:"Respirasi",C:"Pengangkutan",D:"Pencernaan","正确答案":"ABCD"[i%4],"解析":"Penjelasan ringkas.","图片文件名":""});
async function upload(api,rows,extension="csv"){
  const worksheet=XLSX.utils.json_to_sheet(rows);
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,worksheet,"Soalan");
  const bytes=extension==="csv"?"\uFEFF"+XLSX.utils.sheet_to_csv(worksheet):XLSX.write(book,{type:"buffer",bookType:"xlsx"});
  const form=new FormData();form.set("file",new File([bytes],`questions.${extension}`));
  return api.POST(new Request("https://example.test/api/teacher/imports",{method:"POST",body:form}));
}
test("UTF-8 CSV and Excel both import 40 answer-keyed questions as drafts",async()=>{
  for(const extension of ["csv","xlsx"]){
    const api=await handler();
    const response=await upload(api,Array.from({length:40},(_,i)=>question(i)),extension);
    assert.equal(response.status,201);
    assert.equal((await response.json()).imported,40);
    assert.equal(api.stored.length,40);
    assert.ok(api.stored.every(row=>row.status==="draft"&&row.answer_confirmed&&row.author_id==="owner"&&row.subject==="Sains"&&row.source_type==="teacher_submission"));
    assert.equal(api.stored[0].prompt,"Apakah fungsi sel 0?");
    assert.ok(api.stored.every(row=>/^[ABCD]$/.test(row.correct_option)));
  }
});
test("import errors retain real spreadsheet row numbers and invalid image rows do not suppress valid replacements",async()=>{
  const api=await handler();
  await upload(api,[question(1)]);
  const response=await upload(api,[{...question(2),A:""},question(1),{...question(3),"正确答案":"E"},{...question(4),"图片文件名":"missing.png"},question(4)]);
  const result=await response.json();
  assert.equal(result.imported,1);
  assert.deepEqual(result.rejected.map(row=>row.row).sort((a,b)=>a-b),[2,3,4,5]);
  assert.match(result.rejected.find(row=>row.row===3).reason,/已有相同题目/);
  assert.equal(api.stored.length,2);
  assert.equal(api.stored[1].prompt,question(4)["题干"]);
});
