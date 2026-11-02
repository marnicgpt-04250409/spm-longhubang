import assert from "node:assert/strict";
import crypto from "node:crypto";
import {mkdir, writeFile, unlink} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";

const count = Number(process.argv[2] || 100);
const httpSubmission = process.argv.includes("--http-submit");
assert.ok(Number.isInteger(count) && count >= 1 && count <= 300);
assert.equal(new URL(process.env.SUPABASE_URL).hostname, "yntycoemqtkawiuyplvz.supabase.co");
const base = "https://spm-longhubang.vercel.app";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
const run = `capacity-${Date.now()}`;
const recoveryPath = `tmp/${run}-cleanup.json`;
const users = [];
const stages = [];
let recoveryWrites = Promise.resolve();
let authQueue = Promise.resolve();
let nextLoginAt = 0;
let failure;
const sleep = milliseconds => new Promise(resolve=>setTimeout(resolve,milliseconds));
async function pacedLogin(auth, email, password) {
  const login = authQueue.then(async () => {
    await sleep(Math.max(0,nextLoginAt-Date.now()));
    nextLoginAt = Date.now()+2200;
    return auth.auth.signInWithPassword({email,password});
  });
  authQueue = login.then(()=>{},()=>{});
  return login;
}
const checked = result => {if (result.error) throw result.error; return result.data;};
async function pool(rows, parallel, fn) {
  let cursor = 0;
  const outcomes = await Promise.allSettled(Array.from({length: Math.min(parallel,rows.length)},async () => {
    while (cursor < rows.length) {const index = cursor++; await fn(rows[index],index);}
  }));
  const failed = outcomes.find(result=>result.status === "rejected");
  if (failed) throw failed.reason;
}
async function api(user, path, method = "GET", body, allowedStatus) {
  const response = await fetch(`${base}${path}`, {method,headers: {authorization: `Bearer ${user.token}`,"content-type":"application/json"},body: body ? JSON.stringify(body) : undefined,signal: AbortSignal.timeout(45000)});
  const data = await response.json();
  if (!response.ok && response.status !== allowedStatus) throw new Error(`${method} ${path}: HTTP ${response.status} ${data.error || ""}`);
  return data;
}
async function stage(name, fn) {
  const started = performance.now();
  const timings = [];
  const failures = [];
  await Promise.all(users.map(async (user,index) => {
    const start = performance.now();
    try {await fn(user,index);} catch(error) {failures.push({index,error: String(error)});}
    timings.push(performance.now()-start);
  }));
  timings.sort((a,b)=>a-b);
  const percentile = p => Math.round(timings[Math.min(timings.length-1,Math.ceil(p*timings.length)-1)]);
  const result = {name,concurrency: users.length,requests: users.length,failures: failures.length,p50Ms: percentile(.5),p95Ms: percentile(.95),maxMs: percentile(1),elapsedMs: Math.round(performance.now()-started),failureDetails: failures};
  stages.push(result);
  console.log(JSON.stringify(result));
  assert.equal(failures.length,0,`${name}: failures recorded`);
}
await mkdir("tmp",{recursive:true});
let cleanupFailures = [];
try {
  const subjects = (await (await fetch(`${base}/api/subjects`)).json()).subjects;
  assert.ok(subjects.length >= 12);
  await pool(Array.from({length:count}),5,async (_,index) => {
    const password = crypto.randomBytes(32).toString("base64url");
    const email = `${run}-${index}@example.test`;
    const created = checked(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
    const user = {id:created.id,email,subject:subjects[index%subjects.length]};
    users.push(user);
    // Recovery contains generated IDs only, never credentials or student data.
    recoveryWrites = recoveryWrites.then(()=>writeFile(recoveryPath,JSON.stringify(users.map(row=>row.id))));
    await recoveryWrites;
    checked(await admin.from("profiles").update({nickname:`容量测试${index}`,school_name:"其他"}).eq("id",user.id));
    const auth = createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false}});
    user.token = checked(await pacedLogin(auth,email,password)).session.access_token;
    if ((index+1)%10===0) console.log(JSON.stringify({preparingStudents:index+1,target:count}));
  });
  console.log(JSON.stringify({preparedStudents:users.length}));
  await stage("HTTP start daily",async user => {
    const data = await api(user,"/api/daily","POST",{subject:user.subject});
    user.quizId = data.id;
  });
  await stage("HTTP read active questions",async user => {
    const quiz = (await api(user,`/api/daily?subject=${encodeURIComponent(user.subject)}`)).quiz;
    assert.equal(quiz.id,user.quizId);
    assert.equal(quiz.items.length,20);
    assert.ok(quiz.items.every(item=>item.question.subject===user.subject && item.question.correctOption===undefined));
    user.answers = quiz.items.map(item=>({id:item.id,selected_option:"A"}));
  });
  // RPC mode isolates database scoring. HTTP mode covers the server submission
  // handler and its durable queue trigger; provider work stays asynchronous.
  await stage(httpSubmission ? "HTTP submit daily" : "Database RPC submit",async user => {
    const result = httpSubmission
      ? await api(user,"/api/daily","PATCH",{quizId:user.quizId,answers:user.answers.map(answer=>({itemId:answer.id,option:answer.selected_option}))})
      : checked(await admin.rpc("submit_quiz_attempt",{p_kind:"daily",p_user_id:user.id,p_quiz_id:user.quizId,p_answers:user.answers}));
    assert.equal(result.error,undefined);
    user.correct = result.correct;
    assert.equal(result.streak,1);
  });
  await stage("HTTP read scored results",async user => {
    const quiz = (await api(user,`/api/daily?subject=${encodeURIComponent(user.subject)}`)).quiz;
    assert.equal(quiz.status,"submitted");
    assert.equal(quiz.correct_count,user.correct);
    assert.equal(quiz.items.filter(item=>item.selectedOption===item.question.correctOption).length,user.correct);
  });
  await stage(httpSubmission ? "HTTP duplicate rejection" : "Database RPC duplicate rejection",async user => {
    if (httpSubmission) {
      const result = await api(user,"/api/daily","PATCH",{quizId:user.quizId,answers:user.answers.map(answer=>({itemId:answer.id,option:answer.selected_option}))},409);
      assert.equal(typeof result.error,"string");
    } else {
      const result = checked(await admin.rpc("submit_quiz_attempt",{p_kind:"daily",p_user_id:user.id,p_quiz_id:user.quizId,p_answers:user.answers}));
      assert.equal(result.status,409);
    }
  });
} catch(error) {
  failure = String(error);
  throw error;
} finally {
  await pool(users,5,async user=> {
    try {checked(await admin.auth.admin.deleteUser(user.id));} catch(error) {cleanupFailures.push({id:user.id,error:String(error)});}
  });
  if (!cleanupFailures.length) await unlink(recoveryPath).catch(()=>{});
  else await writeFile(recoveryPath,JSON.stringify(cleanupFailures));
  const report = {run,date:new Date().toISOString(),students:users.length,completed: !failure && stages.length===5,failure,scope:httpSubmission ? "HTTP start/read/submit/result/duplicate rejection, including durable Sheet queue triggers. Excludes OAuth UI, client rendering, sustained load and provider synchronization throughput." : "HTTP start/read/result; server-only database scoring RPC. Excludes OAuth UI, client rendering, Google Sheet sync and HTTP submission route.",stages,cleanup:{removed:users.length-cleanupFailures.length,failures:cleanupFailures}};
  await writeFile(`tmp/${run}-report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify({report:`tmp/${run}-report.json`,cleanup:report.cleanup}));
  assert.equal(cleanupFailures.length,0,"Some generated accounts need cleanup");
}
