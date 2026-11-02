import assert from "node:assert/strict";
import crypto from "node:crypto";
import {createClient} from "@supabase/supabase-js";

assert.equal(new URL(process.env.SUPABASE_URL).hostname,"yntycoemqtkawiuyplvz.supabase.co");
const admin = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const checked = result=>{if(result.error) throw result.error; return result.data;};
let userId,token;
async function api(path,method="GET",body) {
  const response = await fetch(`https://spm-longhubang.vercel.app${path}`,{method,headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  return {status:response.status,body:await response.json()};
}
async function prepare(kind) {
  const started = await api(`/api/${kind}`,"POST",{subject:"Matematik"});
  assert.equal(started.status,201);
  const loaded = await api(kind==="daily"?"/api/daily?subject=Matematik":`/api/practice?quizId=${started.body.id}`);
  assert.equal(loaded.status,200);
  const quiz = loaded.body.quiz;
  const questions = checked(await admin.from("questions").select("id,correct_option").in("id",quiz.items.map(item=>item.question.id)));
  const correct = new Map(questions.map(row=>[row.id,row.correct_option]));
  return {id:quiz.id,answers:quiz.items.map((item,index)=>({itemId:item.id,option:index<13?correct.get(item.question.id):correct.get(item.question.id)==="A"?"B":"A"}))};
}
try {
  const email = `http-submit-${crypto.randomUUID()}@example.test`;
  const password = crypto.randomBytes(32).toString("base64url");
  userId = checked(await admin.auth.admin.createUser({email,password,email_confirm:true})).user.id;
  checked(await admin.from("profiles").update({nickname:"同步流程测试",school_name:"其他"}).eq("id",userId));
  const auth = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  token = checked(await auth.auth.signInWithPassword({email,password})).session.access_token;
  const daily = await prepare("daily");
  const pendingBefore = checked(await admin.from("sheet_sync_state").select("requested_version").single()).requested_version;
  const began = performance.now();
  const results = await Promise.all(Array.from({length:20},()=>api("/api/daily","PATCH",{quizId:daily.id,answers:daily.answers})));
  const elapsedMs = Math.round(performance.now()-began);
  assert.equal(results.filter(result=>result.status===200).length,1);
  assert.equal(results.filter(result=>result.status===409).length,19);
  assert.equal(results.find(result=>result.status===200).body.correct,13);
  assert.equal(results.find(result=>result.status===200).body.streak,1);
  const pendingAfter = checked(await admin.from("sheet_sync_state").select("requested_version").single()).requested_version;
  assert.ok(pendingAfter>=pendingBefore+1,"Daily submission must durably request synchronization");
  const practice = await prepare("practice");
  const submitted = await api("/api/practice","PATCH",{quizId:practice.id,answers:practice.answers});
  assert.equal(submitted.status,200);
  assert.equal(submitted.body.correct,13);
  const result = (await api("/api/daily?subject=Matematik")).body.quiz;
  assert.equal(result.correct_count,13);
  assert.equal(result.status,"submitted");
  assert.equal(result.items.filter(item=>item.selectedOption===item.question.correctOption).length,13);
  console.log(JSON.stringify({dailyHTTPSubmissions:20,successful:1,duplicatesRejected:19,elapsedMs,score:13,practiceHTTPScore:13,practiceDoesNotChangeDaily:true,durableSyncRequested:true}));
} finally {
  if(userId) checked(await admin.auth.admin.deleteUser(userId));
  console.log(JSON.stringify({temporaryHTTPAccountRemoved:true}));
}
