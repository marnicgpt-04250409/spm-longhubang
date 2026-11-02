import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const stripImports = source=>source.replace(/import[\s\S]*?from\s+["'][^"']+["'];/g,"");
const compile = source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
async function load(source) {return import(`data:text/javascript;base64,${Buffer.from(compile(source)).toString("base64")}`);}

test("Malaysia midnight and expired streaks use the local calendar day",async()=>{
  const server = stripImports(await readFile(new URL("../lib/supabase-server.ts",import.meta.url),"utf8"));
  const {malaysiaDate,effectiveStreakDays} = await load(server);
  assert.equal(malaysiaDate(new Date("2026-11-01T15:59:59Z")),"2026-11-01");
  assert.equal(malaysiaDate(new Date("2026-11-01T16:00:00Z")),"2026-11-02");
  assert.equal(effectiveStreakDays(6,"2026-11-01",new Date("2026-11-02T04:00:00Z")),6);
  assert.equal(effectiveStreakDays(6,"2026-10-31",new Date("2026-11-02T04:00:00Z")),0);
});

test("leaderboards aggregate all pages and retain the viewer's rank beyond the displayed 100",async()=>{
  const pagination = await readFile(new URL("../lib/pagination.ts",import.meta.url),"utf8");
  const route = stripImports(await readFile(new URL("../app/api/leaderboard/route.ts",import.meta.url),"utf8"));
  const prelude = `
    const Date = class extends globalThis.Date {static now(){return globalThis.Date.parse("2026-11-02T04:00:00Z")}};
    const malaysiaDate = (date) => date ? new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur"}).format(date) : "2026-11-02";
    const effectiveStreakDays = (days,date) => ["2026-11-01","2026-11-02"].includes(date)?days:0;
    const requireUser = async()=>({id:"student1199"});
    const apiError = error=>{throw error};
    const scores = Array.from({length:1200},(_,i)=>({id:String(i),user_id:"student"+i,correct_count:i<100?20:i<600?0:18,completed_at:"2026-11-02T04:00:00Z",local_date:"2026-11-02",status:"submitted",subject:"Biologi",profiles:{nickname:"Student "+i,school_name:i<600?"SMK PB":"SMK PA",role:"student"}}));
    scores.push({...scores[0],id:"teacher",user_id:"teacher",profiles:{nickname:"Teacher",school_name:"Teacher school",role:"teacher"}});
    const profiles = Array.from({length:1200},(_,i)=>({id:"student"+i,nickname:"Student "+i,role:"student",streak_days:i<600?999:i<1199?2:1,last_checkin_date:i<600?"2026-10-30":"2026-11-02"}));
    export const ranges = [];
    const getAdminClient = ()=>({from(table){
      const filters = [],orders = [];
      const value = (row,key)=>key.split(".").reduce((v,k)=>v?.[k],row);
      const query = {select:()=>query,
        eq:(key,v)=>{filters.push(row=>value(row,key)===v);return query},
        gt:(key,v)=>{filters.push(row=>value(row,key)>v);return query},
        gte:(key,v)=>{filters.push(row=>value(row,key)>=v);return query},
        lte:(key,v)=>{filters.push(row=>value(row,key)<=v);return query},
        order:(key,options={})=>{orders.push({key,ascending:options.ascending!==false});return query},
        range:async(from,to)=>{ranges.push([table,from,to]);const rows=(table==="profiles"?profiles:scores).filter(row=>filters.every(filter=>filter(row))).sort((a,b)=>{for(const order of orders){const av=value(a,order.key),bv=value(b,order.key);const comparison=av<bv?-1:av>bv?1:0;if(comparison)return order.ascending?comparison:-comparison;}return 0});return {data:rows.slice(from,to+1),error:null}}
      };return query;
    }});
  `;
  const {GET,ranges} = await load(pagination+prelude+route);
  const request = kind=>new Request(`https://example.test/api/leaderboard?kind=${kind}&subject=Biologi`,{headers:{authorization:"Bearer test"}});
  const schools = await (await GET(request("school"))).json();
  assert.equal(schools.entries[0].name,"SMK PA");
  assert.equal(schools.entries[0].score,18);
  assert.equal(schools.entries[0].participants,600);
  assert.equal(schools.entries[1].score,3.33);
  assert.equal(schools.entries.length,2);
  assert.ok(ranges.some(([table,from])=>table==="daily_quizzes"&&from===1000));
  const dailyResponse = await GET(request("daily"));
  assert.equal(dailyResponse.headers.get("cache-control"),"private, no-store");
  const daily = await dailyResponse.json();
  assert.equal(daily.entries.length,100);
  assert.equal(daily.mine.rank,101);
  assert.equal(daily.mine.name,"Student 1199");
  assert.ok(daily.entries.every(row=>row.rank===1));
  const streak = await (await GET(request("streak"))).json();
  assert.equal(streak.entries.length,100);
  assert.ok(streak.entries.every(row=>row.streak_days===2));
  assert.equal(streak.mine.rank,600);
  assert.equal(streak.mine.streak_days,1);
});
