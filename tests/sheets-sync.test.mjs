import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const transpile = source => ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const load = source => import(`data:text/javascript;base64,${Buffer.from(transpile(source)).toString("base64")}`);
const pagination = await readFile(new URL("../lib/pagination.ts",import.meta.url),"utf8");

test("pagination includes full and partial final pages and stops on errors",async()=>{
  const {readAllPages} = await load(pagination);
  for (const size of [0,500,1001]) {
    const values = Array.from({length:size},(_,i)=>i);
    const rows = await readAllPages(async(page,batch)=>({data:values.slice(page*batch,(page+1)*batch),error:null}));
    assert.deepEqual(rows,values);
  }
  await assert.rejects(readAllPages(async()=>({data:null,error:new Error("failed page")})),/failed page/);
});

test("sheet sync includes over 1000 students and quizzes, preserves zero scores and expands detail rows",async()=>{
  const originalId = process.env.MYGURU_GOOGLE_SHEET_ID;
  const originalCredentials = process.env.MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON;
  process.env.MYGURU_GOOGLE_SHEET_ID = "test-workbook";
  process.env.MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({client_email:"test@example.test",private_key:"test-placeholder"});
  try {
    const source = (await readFile(new URL("../lib/google-sheets-sync.ts",import.meta.url),"utf8")).replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,"");
    const stub = `
      export const writes = [];
      const malaysiaDate = () => "2026-11-02";
      const profiles = Array.from({length:1500},(_,i)=>({id:String(i),nickname:"Student "+i,school_name:"其他",role:"student",streak_days:1}));
      const quizzes = profiles.map((profile,i)=>({id:String(i),user_id:profile.id,subject:"Biologi",correct_count:i===0?0:20,completed_at:"2026-11-02T03:00:00Z",quiz_items:Array.from({length:20},(_,index)=>({ordinal:index+1,selected_option:i===0?"B":"A",questions:{prompt:"Question",correct_option:"A"}}))}));
      const getAdminClient = () => ({
        from(table) { const data = table === "profiles" ? profiles : table === "daily_quizzes" ? quizzes : [];
          const query = {select:()=>query,eq:()=>query,order:()=>query,range:async(from,to)=>({data:data.slice(from,to+1),error:null})}; return query;
        }, auth:{admin:{listUsers:async({page,perPage})=>({data:{users:profiles.slice((page-1)*perPage,page*perPage).map(p=>({id:p.id,email:p.id+"@example.test"}))},error:null})}}
      });
      const sheetsApi = {spreadsheets:{
        get:async()=>({data:{sheets:[{properties:{sheetId:1,title:"学生记录",gridProperties:{rowCount:1000}}},{properties:{sheetId:2,title:"作答明细",gridProperties:{rowCount:10000}}},{properties:{sheetId:3,title:"每日历史",gridProperties:{rowCount:1000}}}]}}),
        batchUpdate:async request=>writes.push({kind:"resize",request}),
        values:{get:async()=>({data:{values:[]}}),batchClear:async request=>writes.push({kind:"clear",request}),batchUpdate:async request=>writes.push({kind:"values",request})}
      }};
      const google = {auth:{GoogleAuth:class {}},sheets:()=>sheetsApi};
    `;
    const {writeGoogleSheetSnapshot,writes} = await load(pagination+stub+source);
    const result = await writeGoogleSheetSnapshot();
    assert.equal(result.students,1500);
    assert.equal(result.attempts,30000);
    const resize = writes.find(w=>w.kind==="resize").request.requestBody.requests;
    assert.ok(resize.some(r=>r.updateSheetProperties.properties.gridProperties.rowCount===30001));
    const ranges = writes.find(w=>w.kind==="clear").request.requestBody.ranges;
    assert.deepEqual(ranges,["学生记录!A2:K","作答明细!A2:J"]);
    const values = writes.find(w=>w.kind==="values").request.requestBody.data;
    const students = values.find(v=>v.range==="学生记录!A2").values;
    assert.equal(students[0][6],0);
    assert.equal(students.at(-1)[3],"1499@example.test");
    assert.equal(values.find(v=>v.range==="作答明细!A2").values.length,30000);
  } finally {
    if (originalId===undefined) delete process.env.MYGURU_GOOGLE_SHEET_ID; else process.env.MYGURU_GOOGLE_SHEET_ID=originalId;
    if (originalCredentials===undefined) delete process.env.MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON; else process.env.MYGURU_GOOGLE_SERVICE_ACCOUNT_JSON=originalCredentials;
  }
});
