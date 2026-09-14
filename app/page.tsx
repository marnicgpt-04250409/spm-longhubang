"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { SCHOOL_OPTIONS, schoolSelectValue } from "@/lib/schools";
import { getBrowserClient } from "@/lib/supabase-browser";

type Question = {
  subject: string;
  topic?: string;
  text: string;
  options: string[];
  answer?: number;
  note: string;
  itemId?: string;
  imageUrl?: string;
  imageAlt?: string;
};
const Logo = () => (
  <div className="logo">
    <span>SPM</span>
    <b>龙虎榜</b>
  </div>
);

function QuestionPrompt({ text }: { text: string }) {
  const cloze = text.match(
    /^([^\n]+)\n\nRead the passage below\. Choose the best word for blank (\d+)\.\n\n([\s\S]+)$/i,
  );
  if (!cloze) return <h1>{text}</h1>;

  const [, title, blankNumber, passage] = cloze;
  const target = `___(${blankNumber})`;
  const passageParts = passage.split(target);

  return (
    <div className="cloze-prompt">
      <p className="cloze-title">{title}</p>
      <h1><span>本题作答</span><strong>BLANK {blankNumber}</strong></h1>
      <p className="cloze-instruction">Read the passage and choose the best answer for the highlighted blank.</p>
      <p className="cloze-passage">
        {passageParts.map((part, index) => (
          <span key={`${blankNumber}-${index}`}>
            {index > 0 && <mark>{target}</mark>}
            {part}
          </span>
        ))}
      </p>
    </div>
  );
}

function malaysiaDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "long",
    day: "2-digit",
    month: "long",
  })
    .format(date)
    .toUpperCase();
}

function malaysiaTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const [tab, setTab] = useState<
    "home" | "quiz" | "rank" | "history" | "teacher"
  >("home");
  const [n, setN] = useState(0);
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [done, setDone] = useState(false);
  const [isTeacher, setTeacher] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [quiz, setQuiz] = useState<Question[]>([]);
  const [rankMode, setRankMode] = useState<"daily" | "school" | "streak">("daily");
  const [session, setSession] = useState<any>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [serverScore, setServerScore] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [rankRows, setRankRows] = useState<string[][]>([]);
  const [teacherUploads, setTeacherUploads] = useState<any[]>([]);
  const [teacherQuestions, setTeacherQuestions] = useState<any[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [subjectList, setSubjectList] = useState<string[]>([]);
  const [quizMode, setQuizMode] = useState<"daily" | "practice">("daily");
  const [history, setHistory] = useState<any[]>([]);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [teacherDashboard, setTeacherDashboard] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [schoolDraft, setSchoolDraft] = useState("");
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [progress, setProgress] = useState<any>({ daily: [], summary: {} });
  const [personalRank, setPersonalRank] = useState<any>(null);
  const [teacherQuestionFilter, setTeacherQuestionFilter] = useState<"all" | "draft" | "published" | "unconfirmed">("all");
  const [teacherQuestionSubject, setTeacherQuestionSubject] = useState("all");
  const [teacherQuestionPage, setTeacherQuestionPage] = useState(1);
  const [teacherQuestionTotal, setTeacherQuestionTotal] = useState(0);
  const [teacherQuestionSubjects, setTeacherQuestionSubjects] = useState<string[]>([]);
  const [questionSheetFile, setQuestionSheetFile] = useState<File | null>(null);
  const [questionImageFiles, setQuestionImageFiles] = useState<File[]>([]);
  const [questionImporting, setQuestionImporting] = useState(false);
  const [learningInsights, setLearningInsights] = useState<any[]>([]);
  const [teacherInsights, setTeacherInsights] = useState<any>(null);
  const q = quiz[n];
  const localScore = useMemo(
    () =>
      answers.reduce<number>(
        (x, a, i) => x + (a === quiz[i]?.answer ? 1 : 0),
        0,
      ),
    [answers, quiz],
  );
  const score = serverScore ?? localScore;
  const shownRows = rankRows;
  const selectedDaily = useMemo(
    () => (progress.daily || []).find((item: any) => item.subject === selectedSubject),
    [progress.daily, selectedSubject],
  );
  const missionAnswered = selectedDaily?.status === "submitted" ? 20 : selectedDaily?.selectedCount || 0;
  const missionPercent = Math.round((missionAnswered / 20) * 100);
  const visibleTeacherQuestions = teacherQuestions;
  const visiblePendingIds = useMemo(
    () => visibleTeacherQuestions.filter((item) => item.status !== "published").map((item) => item.id),
    [visibleTeacherQuestions],
  );
  const selectedVisiblePendingCount = selectedQuestionIds.filter((id) => visiblePendingIds.includes(id)).length;
  useEffect(() => {
    const client = getBrowserClient();
    if (!client) return;
    client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  async function login() {
    const client = getBrowserClient();
    if (!client) {
      setMessage("登录配置尚未完成，请稍后再试。");
      return;
    }
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
  async function callApi(path: string, init?: RequestInit) {
    if (!session?.access_token) throw new Error("请先使用 Google 登录。");
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
        ...init?.headers,
      },
    });
    const text = await response.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { error: text };
    }
    if (!response.ok) throw new Error(body.error || "请求失败");
    return body;
  }
  async function loadAccount() {
    try {
      const data = await callApi("/api/me");
      setTeacher(data.profile?.role === "teacher");
      setProfile(data.profile ?? null);
      setNicknameDraft(data.profile?.nickname || "");
      setSchoolDraft(schoolSelectValue(data.profile?.school_name));
    } catch {
      /* Account data is optional until login is configured. */
    }
  }
  async function saveNickname() {
    try {
      const data = await callApi("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ nickname: nicknameDraft, schoolName: schoolDraft }),
      });
      setProfile(data.profile);
      setNicknameDialogOpen(false);
      setMessage("姓名已保存。欢迎开始今天的练习！");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "姓名保存失败");
    }
  }
  async function loadSubjects() {
    try {
      const data = await fetch("/api/subjects").then((response) =>
        response.ok ? response.json() : Promise.reject(),
      );
      if (Array.isArray(data.subjects) && data.subjects.length) {
        setSubjectList(data.subjects);
        setSelectedSubject((current) =>
          data.subjects.includes(current) ? current : data.subjects[0],
        );
      } else {
        setSubjectList([]);
        setSelectedSubject("");
      }
    } catch {
      /* A clean setup has no published subjects yet. */
    }
  }
  async function loadHistory() {
    try {
      const data = await callApi("/api/history");
      setHistory(data.entries || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取练习记录");
    }
  }
  async function loadProgress() {
    try {
      const data = await callApi("/api/progress");
      setProgress(data);
    } catch {
      /* Progress remains optional until a student finishes nickname setup. */
    }
  }
  async function loadMistakes() {
    try {
      const data = await callApi("/api/mistakes");
      setMistakes(data.mistakes || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取错题本");
    }
  }
  async function loadLearningInsights() {
    try {
      const data = await callApi("/api/learning-insights");
      setLearningInsights(data.topics || []);
    } catch {
      /* Insights become meaningful after students answer tagged questions. */
    }
  }
  async function loadTeacherDashboard() {
    try {
      const data = await callApi("/api/teacher/dashboard");
      setTeacherDashboard(data);
    } catch {
      /* Only the bank manager can view the school-wide dashboard. */
    }
  }
  async function loadTeacherInsights() {
    try {
      const data = await callApi("/api/teacher/insights");
      setTeacherInsights(data);
    } catch {
      /* This report is intentionally available only to the bank manager. */
    }
  }
  async function downloadTeacherDashboard() {
    try {
      if (!session?.access_token) throw new Error("请先使用 Google 登录。");
      const response = await fetch("/api/teacher/dashboard?format=csv", {
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const text = await response.text();
        let body: any = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          body = { error: text };
        }
        throw new Error(body.error || "无法导出资料。");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "myguru-today-students.csv";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("今日学生资料 CSV 已下载。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    }
  }
  async function syncTeacherSheet() {
    try {
      const data = await callApi("/api/teacher/sync-sheet", { method: "POST" });
      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google Sheet 同步失败");
    }
  }
  async function verifyTeacher() {
    try {
      const inviteCode = window.prompt("请输入教师邀请码");
      if (!inviteCode) return;
      await callApi("/api/teacher/verify", {
        method: "POST",
        body: JSON.stringify({ inviteCode }),
      });
      setTeacher(true);
      setMessage("教师权限已启用。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "验证失败");
    }
  }
  async function uploadPdf(file: File) {
    try {
      if (!session?.access_token) throw new Error("请先使用 Google 登录。");
      const subject =
        window.prompt("请输入这份试卷的科目，例如 Matematik") || "";
      if (!subject.trim()) throw new Error("请填写科目后再上传。");
      setMessage("正在安全上传 PDF，请勿关闭此页面…");
      const headers = {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      };
      const initiateResponse = await fetch("/api/teacher/uploads", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "initiate",
          filename: file.name,
          type: file.type,
          size: file.size,
          subject,
        }),
      });
      const initiate = await initiateResponse.json();
      if (!initiateResponse.ok)
        throw new Error(initiate.error || "无法建立安全上传通道。");
      const client = getBrowserClient();
      if (!client) throw new Error("上传服务尚未准备好，请重新登录后再试。");
      const { error: uploadError } = await client.storage
        .from("question-papers")
        .uploadToSignedUrl(initiate.storagePath, initiate.token, file, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      setMessage("PDF 已上传，正在提取 ABCD 题目…");
      const response = await fetch("/api/teacher/uploads", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "finalize",
          filename: file.name,
          subject,
          storagePath: initiate.storagePath,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法处理已上传的 PDF。");
      setMessage(`${data.upload.filename} 已上传，现为待审核状态。`);
      await loadTeacherData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    }
  }
  async function uploadQuestionImages(files: File[]) {
    if (!files.length) return [];
    if (!session?.access_token) throw new Error("请先使用 Google 登录。");
    const names = new Set<string>();
    for (const file of files) {
      const key = file.name.toLocaleLowerCase();
      if (names.has(key)) throw new Error(`图片文件名重复：${file.name}`);
      names.add(key);
    }
    const response = await fetch("/api/teacher/question-images", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.access_token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files: files.map(({ name, type, size }) => ({ name, type, size })),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "无法建立图片上传通道。");
    const client = getBrowserClient();
    if (!client) throw new Error("上传服务尚未准备好，请重新登录后再试。");
    const fileByName = new Map(
      files.map((file) => [file.name.toLocaleLowerCase(), file]),
    );
    const completed: Array<{ name: string; storagePath: string }> = [];
    for (let start = 0; start < data.uploads.length; start += 4) {
      const results = await Promise.all(
        data.uploads.slice(start, start + 4).map(async (upload: any) => {
          const file = fileByName.get(String(upload.name).toLocaleLowerCase());
          if (!file) throw new Error(`找不到图片：${upload.name}`);
          const { error } = await client.storage
            .from("question-images")
            .uploadToSignedUrl(upload.storagePath, upload.token, file, {
              contentType: file.type,
              upsert: false,
            });
          if (error) throw error;
          return { name: file.name, storagePath: upload.storagePath };
        }),
      );
      completed.push(...results);
    }
    return completed;
  }
  async function importQuestionSheet(file: File, images: File[] = []) {
    try {
      if (!session?.access_token) throw new Error("请先使用 Google 登录。");
      setQuestionImporting(true);
      setMessage(
        images.length
          ? `正在上传 ${images.length} 张题目图片…`
          : "正在检查并导入表格…",
      );
      const imageManifest = await uploadQuestionImages(images);
      if (imageManifest.length) setMessage("图片已上传，正在配对并导入题目…");
      const form = new FormData();
      form.append("file", file);
      form.append("imageManifest", JSON.stringify(imageManifest));
      const response = await fetch("/api/teacher/imports", {
        method: "POST",
        headers: { authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "无法导入表格。");
      const rejected = Array.isArray(data.rejected) && data.rejected.length
        ? ` ${data.rejected.length} 行未导入：${data.rejected.slice(0, 3).map((item: any) => `第${item.row}行${item.reason}`).join("；")}`
        : "";
      setMessage(`${data.message}${rejected}`);
      setQuestionSheetFile(null);
      setQuestionImageFiles([]);
      await loadTeacherData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "表格导入失败");
    } finally {
      setQuestionImporting(false);
    }
  }
  async function publishStarterBank() {
    try {
      const data = await callApi("/api/teacher/starter-bank", { method: "POST" });
      setMessage(data.message);
      await Promise.all([loadTeacherData(), loadSubjects()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "首批题库发布失败");
    }
  }
  async function loadRanking() {
    try {
      const response = await fetch(
        `/api/leaderboard?kind=${rankMode}${(rankMode === "daily" || rankMode === "school") && selectedSubject ? `&subject=${encodeURIComponent(selectedSubject)}` : ""}`,
        { headers: session?.access_token ? { authorization: `Bearer ${session.access_token}` } : undefined },
      );
      if (!response.ok) throw new Error("无法读取排行榜");
      const data = await response.json();
      setPersonalRank(data.mine || null);
      setRankRows(
        data.entries.map((item: any, index: number) => [
          String(item.rank ?? index + 1),
          item.name || item.display_name,
          String(item.score ?? item.streak_days),
          item.completedAt
            ? new Date(item.completedAt).toLocaleTimeString("en-MY", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : rankMode === "school"
              ? `${item.participants ?? 0} 位学生`
              : item.last_checkin_date || "—",
        ]),
      );
    } catch {
      /* Keep the lightweight preview rows until production data is available. */
    }
  }
  async function loadTeacherData() {
    try {
      const questionParams = new URLSearchParams({
        page: String(teacherQuestionPage),
        pageSize: "50",
        status: teacherQuestionFilter,
        subject: teacherQuestionSubject,
      });
      const [uploads, questions] = await Promise.all([
        callApi("/api/teacher/uploads"),
        callApi(`/api/teacher/questions?${questionParams.toString()}`),
      ]);
      setTeacherUploads(uploads.uploads || []);
      setTeacherQuestions(questions.questions || []);
      setTeacherQuestionTotal(questions.total || 0);
      setTeacherQuestionSubjects(questions.subjects || []);
      setSelectedQuestionIds((current) =>
        current.filter((id) =>
          (questions.questions || []).some(
            (item: any) => item.id === id && item.status !== "published",
          ),
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取教师资料");
    }
  }
  async function createManualQuestion() {
    try {
      const subject = window.prompt("科目")?.trim();
      const topic = window.prompt("章节／主题（可留空）")?.trim();
      const prompt = window.prompt("题干")?.trim();
      const optionA = window.prompt("A 选项")?.trim();
      const optionB = window.prompt("B 选项")?.trim();
      const optionC = window.prompt("C 选项")?.trim();
      const optionD = window.prompt("D 选项")?.trim();
      const correctOption = window
        .prompt("正确答案（A / B / C / D）")
        ?.trim()
        .toUpperCase();
      if (
        !subject ||
        !prompt ||
        !optionA ||
        !optionB ||
        !optionC ||
        !optionD ||
        !correctOption
      )
        return;
      await callApi("/api/teacher/questions", {
        method: "POST",
        body: JSON.stringify({
          subject,
          topic,
          prompt,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption,
        }),
      });
      setMessage("题目草稿已建立。审核后点击发布。 ");
      await loadTeacherData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法建立题目");
    }
  }
  async function confirmAnswer(id: string) {
    try {
      const correctOption = window
        .prompt("确认正确答案（A / B / C / D）")
        ?.trim()
        .toUpperCase();
      if (!correctOption) return;
      await callApi("/api/teacher/questions", {
        method: "PATCH",
        body: JSON.stringify({ id, correctOption }),
      });
      setMessage("正确答案已确认，现在可以发布。");
      await loadTeacherData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "答案确认失败");
    }
  }
  async function publishQuestion(id: string) {
    try {
      await callApi("/api/teacher/questions", {
        method: "PATCH",
        body: JSON.stringify({ id, publish: true }),
      });
      setMessage("题目已发布，会进入对应科目的学生题库。");
      await loadTeacherData();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "发布失败；请先确认正确答案。 ",
      );
    }
  }
  function toggleQuestionSelection(id: string) {
    setSelectedQuestionIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  async function batchReview(action: "batch-publish" | "batch-delete") {
    if (!selectedQuestionIds.length) return;
    const label = action === "batch-publish" ? "发布" : "删除";
    if (!window.confirm(`确定要${label}已选的 ${selectedQuestionIds.length} 道题目吗？`)) return;
    try {
      const data = await callApi("/api/teacher/questions", {
        method: "PATCH",
        body: JSON.stringify({ action, ids: selectedQuestionIds }),
      });
      setSelectedQuestionIds([]);
      setMessage(
        action === "batch-publish"
          ? `已批量发布 ${data.published} 道题目。`
          : `已删除 ${data.deleted} 道待审核题目。`,
      );
      await Promise.all([loadTeacherData(), loadSubjects()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `批量${label}失败`);
    }
  }
  async function editQuestion(item: any) {
    try {
      const subject = window.prompt("科目", item.subject);
      const topic = window.prompt("章节／主题（可留空）", item.topic || "");
      const prompt = window.prompt("题干", item.prompt);
      const optionA = window.prompt("A 选项", item.option_a || "");
      const optionB = window.prompt("B 选项", item.option_b || "");
      const optionC = window.prompt("C 选项", item.option_c || "");
      const optionD = window.prompt("D 选项", item.option_d || "");
      const explanation = window.prompt(
        "解析（可留空）",
        item.explanation || "",
      );
      if (
        [subject, prompt, optionA, optionB, optionC, optionD].some(
          (value) => !value?.trim(),
        )
      )
        return;
      await callApi("/api/teacher/questions", {
        method: "PATCH",
        body: JSON.stringify({
          id: item.id,
          subject,
          topic: topic || "",
          prompt,
          optionA,
          optionB,
          optionC,
          optionD,
          explanation: explanation || "",
        }),
      });
      setMessage("题目内容已更新。");
      await loadTeacherData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "题目编辑失败");
    }
  }
  useEffect(() => {
    loadSubjects();
  }, []);
  useEffect(() => {
    if (tab === "rank") loadRanking();
    if (tab === "history" && session) {
      loadHistory();
      loadMistakes();
      loadLearningInsights();
    }
  }, [tab, rankMode, selectedSubject, session]);
  useEffect(() => {
    if (isTeacher) {
      loadTeacherDashboard();
      loadTeacherInsights();
    }
  }, [isTeacher]);
  useEffect(() => {
    if (isTeacher) loadTeacherData();
  }, [isTeacher, teacherQuestionFilter, teacherQuestionSubject, teacherQuestionPage]);
  useEffect(() => {
    if (session) {
      loadAccount();
      loadDaily().catch(() => undefined);
      loadProgress();
    }
  }, [session]);
  async function loadDaily(subject?: string) {
    const data = await callApi(
      subject ? `/api/daily?subject=${encodeURIComponent(subject)}` : "/api/daily",
    );
    if (!data.quiz) return;
    setQuizId(data.quiz.id);
    setSelectedSubject(data.quiz.subject);
    setDone(data.quiz.status === "submitted");
    setServerScore(data.quiz.correct_count);
    setAnswers(
      data.quiz.items.map((item: any) =>
        item.selectedOption ? "ABCD".indexOf(item.selectedOption) : undefined,
      ),
    );
    setQuiz(
      data.quiz.items.map((item: any) => ({
        itemId: item.id,
        subject: item.question.subject,
        topic: item.question.topic,
        text: item.question.prompt,
        options: item.question.options,
        answer: item.question.correctOption
          ? "ABCD".indexOf(item.question.correctOption)
          : undefined,
        note: item.question.explanation || "",
        imageUrl: item.question.imageUrl,
        imageAlt: item.question.imageAlt,
      })),
    );
  }
  async function loadPractice(id: string) {
    const data = await callApi(
      `/api/practice?quizId=${encodeURIComponent(id)}`,
    );
    if (!data.quiz) return;
    setQuizId(data.quiz.id);
    setSelectedSubject(data.quiz.subject);
    setDone(data.quiz.status === "submitted");
    setServerScore(data.quiz.correct_count);
    setAnswers(
      data.quiz.items.map((item: any) =>
        item.selectedOption ? "ABCD".indexOf(item.selectedOption) : undefined,
      ),
    );
    setQuiz(
      data.quiz.items.map((item: any) => ({
        itemId: item.id,
        subject: item.question.subject,
        topic: item.question.topic,
        text: item.question.prompt,
        options: item.question.options,
        answer: item.question.correctOption
          ? "ABCD".indexOf(item.question.correctOption)
          : undefined,
        note: item.question.explanation || "",
        imageUrl: item.question.imageUrl,
        imageAlt: item.question.imageAlt,
      })),
    );
  }
  async function begin(
    subject = selectedSubject,
    mode: "daily" | "practice" = "daily",
  ) {
    try {
      if (!subject) {
        setMessage("目前没有可用科目，请等待教师发布至少 20 道题目。");
        return;
      }
      setMessage("");
      setQuizMode(mode);
      setSelectedSubject(subject);
      setN(0);
      setChoosing(false);
      if (session) {
        const data = await callApi(
          mode === "daily" ? "/api/daily" : "/api/practice",
          { method: "POST", body: JSON.stringify({ subject }) },
        );
        setQuizId(data.id);
        if (mode === "daily") await loadDaily(subject);
        else await loadPractice(data.id);
      } else {
        await login();
        return;
      }
      setTab("quiz");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法开始任务");
    }
  }
  function pick(a: number) {
    if (answers[n] !== undefined) return;
    const copy = [...answers];
    copy[n] = a;
    setAnswers(copy);
  }
  async function advance() {
    if (n !== quiz.length - 1) {
      setN(n + 1);
      return;
    }
    try {
      if (session && quizId) {
        const path = quizMode === "daily" ? "/api/daily" : "/api/practice";
        const data = await callApi(path, {
          method: "PATCH",
          body: JSON.stringify({
            quizId,
            answers: quiz.map((item, index) => ({
              itemId: item.itemId,
              option: "ABCD".charAt(answers[index] ?? -1),
            })),
          }),
        });
      setServerScore(data.correct);
        if (quizMode === "daily") await loadDaily(selectedSubject);
        else await loadPractice(quizId);
      }
      setDone(true);
      await Promise.all([loadProgress(), loadRanking()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "提交失败");
    }
  }
  return (
    <main>
      <header>
        <button className="brand" onClick={() => setTab("home")}>
          <Logo />
        </button>
        <div className="partner">
          <span>Powered by</span>
          <Image src="/myguru-logo.png" alt="My Guru Education" width={50} height={50} priority />
        </div>
        <nav>
          <button onClick={() => setTab("home")}>首页</button>
          <button onClick={() => setTab("rank")}>今日排行榜</button>
          <button onClick={() => setTab("history")}>我的记录</button>
          <button onClick={() => setTab("teacher")}>教师中心</button>
        </nav>
        <button className="home-mobile" onClick={() => setTab("home")}>首页</button>
        <button className="teacher-mobile" onClick={() => setTab("teacher")}>
          教师中心
        </button>
        <button
          className="user"
          onClick={
            session
              ? () => {
                  setNicknameDraft(profile?.nickname || "");
                  setSchoolDraft(schoolSelectValue(profile?.school_name));
                  setNicknameDialogOpen(true);
                }
              : login
          }
        >
          <i>{session ? "我" : "G"}</i>
          <span>
            <b>
              {profile?.nickname ||
                (session
                  ? "填写姓名"
                  : "Google 登录")}
            </b>
            <small>{session ? "点击填写或修改姓名" : "登录后保存成绩"}</small>
          </span>
        </button>
      </header>
      {session && profile && (!profile.nickname || (profile.role === "student" && !profile.school_name) || nicknameDialogOpen) && (
        <section className="nickname-overlay" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
          <form className="nickname-card" onSubmit={(event) => { event.preventDefault(); saveNickname(); }}>
            <p className="eyebrow">WELCOME TO MYGURU</p>
            <h1 id="nickname-title">{profile.nickname ? "更新你的学习资料" : "填写真实姓名和学校"}</h1>
            <p>{profile.role === "teacher" ? "请填写学校使用的真实姓名；不会公开你的 Gmail 名称。" : "真实姓名会显示在个人榜；学校只用于学校榜统计，不会公开 Gmail 名称。"}</p>
            <input value={nicknameDraft} onChange={(event) => setNicknameDraft(event.target.value)} maxLength={20} minLength={2} placeholder="例如：陈小明" required />
            {profile.role === "student" && (
              <label className="school-field">
                <span>学校</span>
                <select value={schoolDraft} onChange={(event) => setSchoolDraft(event.target.value)} required>
                  <option value="" disabled>请选择学校</option>
                  {SCHOOL_OPTIONS.map((school) => <option key={school} value={school}>{school}</option>)}
                </select>
              </label>
            )}
            <small>{profile.role === "student" ? "请填写真实姓名并从名单中选择学校；名单以外请选择“其他”。" : "请填写学校使用的真实姓名。"}</small>
            <button className="primary" type="submit">保存姓名，开始练习　→</button>
            {profile.nickname && <button className="link nickname-close" type="button" onClick={() => setNicknameDialogOpen(false)}>取消</button>}
          </form>
        </section>
      )}
      {message && (
        <div className="app-message" role="status">
          {message}
          <button onClick={() => setMessage("")}>×</button>
        </div>
      )}
      {tab === "home" && (
        <section className="wrap home">
          <div className="hero">
            <div>
              <p className="eyebrow">
                {now ? malaysiaDateLabel(now) : "MALAYSIA TIME"}
              </p>
              <h1>
                今天，也比昨天
                <br />
                更靠近 <em>A+</em>。
              </h1>
              <p>选择今天要冲刺的科目，完成 20 题点亮学习记录。</p>
              <button
                className="primary light"
                onClick={() => setChoosing(true)}
              >
                选择科目开始　→
              </button>
            </div>
            <aside>
              <p>本月学习足迹</p>
              <div className="week">
                {"MTWTFSS".split("").map((x, i) => (
                  <span
                    className={
                      i >= 7 - Math.min(profile?.streak_days ?? 0, 7)
                        ? "checked"
                        : ""
                    }
                    key={i}
                  >
                    <b>{x}</b>
                    <i>
                      {i >= 7 - Math.min(profile?.streak_days ?? 0, 7)
                        ? "✓"
                        : ""}
                    </i>
                  </span>
                ))}
              </div>
              <div className="streak">
                <strong>{profile?.streak_days ?? 0}</strong>
                <span>
                  天连续打卡
                  <br />
                  继续保持！
                </span>
              </div>
            </aside>
          </div>
          {choosing && (
            <section className="subject-picker">
              <div>
                <p className="eyebrow">CHOOSE YOUR SUBJECT</p>
                <h2>今天想挑战哪一科？</h2>
                <p>每日首轮选定后不可更换，完成该科 20 题将计入日榜。</p>
              </div>
              <div className="subject-grid">
                {subjectList.length === 0 && (
                  <p>
                    还没有可用科目。教师发布至少 20
                    道题目后，科目会自动显示在这里。
                  </p>
                )}
                {subjectList.map((subject) => (
                  <button
                    className={subject === selectedSubject ? "chosen" : ""}
                    onClick={() => setSelectedSubject(subject)}
                    key={subject}
                  >
                    <b>{subject}</b>
                    <small>20 题练习</small>
                  </button>
                ))}
              </div>
              <footer>
                <button
                  className="secondary"
                  onClick={() => setChoosing(false)}
                >
                  稍后再说
                </button>
                <button
                  className="primary"
                  disabled={subjectList.length === 0}
                  onClick={() => begin()}
                >
                  {selectedSubject
                    ? `开始 ${selectedSubject}　→`
                    : "等待题库发布"}
                </button>
              </footer>
            </section>
          )}
          <div className="cards">
            <article>
              <div className="title">
                <div>
                  <p className="eyebrow">DAILY MISSION</p>
                  <h2>今日任务</h2>
                </div>
                <b className="pill">{selectedSubject || "未选择科目"}</b>
              </div>
              <div className="mission">
                <div className="circle">
                  <b>{missionPercent}%</b>
                  <small>完成度</small>
                </div>
                <div>
                  <h3>
                    {selectedSubject
                      ? `${selectedSubject} · 20 题`
                      : "等待教师发布题目"}
                  </h3>
                  <p>
                    {selectedDaily?.status === "submitted"
                      ? `已完成 ${selectedDaily.correctCount ?? 0} / 20 · 已计入该科日榜`
                      : "自主选择科目 · 完成后计入全校日榜"}
                  </p>
                  <div className="bar">
                    <i style={{ width: `${missionPercent}%` }} />
                  </div>
                  <small>{missionAnswered} / 20 题</small>
                </div>
              </div>
              <button
                className="link"
                onClick={() =>
                  selectedDaily?.status === "submitted"
                    ? begin(selectedSubject, "practice")
                    : setChoosing(true)
                }
                disabled={subjectList.length === 0}
              >
                {selectedDaily?.status === "submitted"
                  ? "继续练习这科　→"
                  : "更换科目 / 开始答题　→"}
              </button>
            </article>
            <article>
              <div className="title">
                <div>
                  <p className="eyebrow">SCHOOL RANKING</p>
                  <h2>{rankMode === "daily" ? "今日龙虎榜" : rankMode === "school" ? "今日学校榜" : "连续打卡榜"}</h2>
                </div>
                <button className="link" onClick={() => setTab("rank")}>
                  查看全部　→
                </button>
              </div>
              <div className="mini">
                {shownRows.length === 0 && (
                  <p>今天还没有成绩，完成首轮任务即可上榜。</p>
                )}
                {shownRows.slice(0, 3).map(([r, name, points]) => (
                  <div key={r}>
                    <strong>{r}</strong>
                    <i>{name[0]}</i>
                    <b>{name}</b>
                    <em>
                      {points}{" "}
                      <small>
                        {rankMode === "daily" ? "题正确" : rankMode === "school" ? "平均分" : "天连续"}
                      </small>
                    </em>
                  </div>
                ))}
              </div>
              <button
                className="notice notice-button"
                onClick={() =>
                  setRankMode(rankMode === "daily" ? "school" : rankMode === "school" ? "streak" : "daily")
                }
              >
                {rankMode === "daily" ? "查看学校榜 🏫" : rankMode === "school" ? "查看连续打卡榜 🔥" : "返回每日答题榜"}
              </button>
            </article>
          </div>
        </section>
      )}
      {tab === "quiz" && (
        <section className="wrap quiz">
          {!done ? (
            <>
              <div className="quizhead">
                <button className="link" onClick={() => setTab("home")}>
                  ← 返回
                </button>
                <div>
                  <span>
                    {selectedSubject} ·{" "}
                    {quizMode === "daily" ? "每日任务" : "自由练习"} · 第{" "}
                    {n + 1} / 20 题
                  </span>
                  <div className="bar">
                    <i
                      style={{
                        width: `${((n + (answers[n] !== undefined ? 1 : 0)) / 20) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span>◷ {now ? malaysiaTimeLabel(now) : "马来西亚时间"}</span>
              </div>
              {!q ? (
                <article className="question">
                  <h1>正在读取题目…</h1>
                  <p>若一直没有题目，请返回首页重新开始。</p>
                </article>
              ) : (
                <article className="question">
                  <b className="subject">{q.subject}</b>
                  {q.topic && <p className="question-topic">课本章节 · {q.topic}</p>}
                  <QuestionPrompt text={q.text} />
                  {q.imageUrl && (
                    <Image
                      className="question-visual"
                      src={q.imageUrl}
                      alt={q.imageAlt || "题目插图"}
                      width={1200}
                      height={800}
                      sizes="(max-width: 800px) calc(100vw - 78px), 680px"
                      unoptimized
                    />
                  )}
                  <div className="options">
                    {q.options.map((v, i) => (
                      <button
                        key={v}
                        className={answers[n] === i ? "selected" : ""}
                        onClick={() => pick(i)}
                      >
                        <b>{"ABCD".charAt(i)}</b>
                        <span>{v}</span>
                      </button>
                    ))}
                  </div>
                  <footer>
                    <small>选择一个答案后继续</small>
                    <button
                      disabled={answers[n] === undefined}
                      className="primary"
                      onClick={advance}
                    >
                      {n === quiz.length - 1 ? "提交答案" : "下一题　→"}
                    </button>
                  </footer>
                </article>
              )}
            </>
          ) : (
            <article className="result">
              <div>✦　✧　✦</div>
              <p className="eyebrow">
                {selectedSubject.toUpperCase()} ·{" "}
                {quizMode === "daily"
                  ? "DAILY MISSION COMPLETE"
                  : "PRACTICE COMPLETE"}
              </p>
              <h1>
                {quizMode === "daily" ? "今日挑战完成！" : "本次练习完成！"}
              </h1>
              <strong>
                {score}
                <small>/ 20 题答对</small>
              </strong>
              <p>
                {quizMode === "daily"
                  ? "你的正式每日任务已提交。继续练习不会影响今日排名。"
                  : "这次成绩已保存到个人练习记录，不影响今日排名。"}
              </p>
              {quizMode === "daily" ? (
                <>
                  <button className="primary" onClick={() => setTab("rank")}>
                    查看今日排名
                  </button>
                  <button
                    className="secondary"
                    onClick={() => begin(selectedSubject, "practice")}
                  >
                    继续练习
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="primary"
                    onClick={() => begin(selectedSubject, "practice")}
                  >
                    再练一组
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setTab("history")}
                  >
                    查看我的记录
                  </button>
                </>
              )}
              <button className="secondary" onClick={() => setTab("home")}>
                返回首页
              </button>
              <section>
                {quiz.map((x, i) => (
                  <div key={`${x.subject}-${i}`}>
                    <b className={answers[i] === x.answer ? "ok" : "bad"}>
                      {answers[i] === x.answer ? "✓" : "×"}
                    </b>
                    <span>
                      {i + 1}. {x.subject}
                    </span>
                    <small>
                      {answers[i] === x.answer
                        ? "正确"
                        : `答案：${"ABCD".charAt(x.answer ?? -1)} · ${x.note}`}
                    </small>
                  </div>
                ))}
              </section>
            </article>
          )}
        </section>
      )}
      {tab === "rank" && (
        <section className="wrap page">
          <div className="heading">
            <div>
              <p className="eyebrow">MALAYSIA TIME</p>
              <h1>{rankMode === "daily" ? "今日龙虎榜" : rankMode === "school" ? "今日学校榜 🏫" : "连续打卡榜 🔥"}</h1>
              <p>
                {rankMode === "daily"
                  ? "按首轮 20 题正确数排列。相同成绩显示相同名次，并以完成时间排序。"
                  : rankMode === "school"
                    ? "按今天首轮任务的学校平均分排列；同分时以参与学生人数排序。"
                    : "按连续完成每日任务的天数排列，每天午夜后更新。"}
              </p>
            </div>
            <b>{rankMode === "daily" ? "♛" : rankMode === "school" ? "🏫" : "🔥"}</b>
          </div>
          <div className="rank-modes">
            <button
              className={rankMode === "daily" ? "active" : ""}
              onClick={() => setRankMode("daily")}
            >
              每日答题榜
            </button>
            <button
              className={rankMode === "streak" ? "active" : ""}
              onClick={() => setRankMode("streak")}
            >
              连续打卡榜
            </button>
            <button
              className={rankMode === "school" ? "active" : ""}
              onClick={() => setRankMode("school")}
            >
              学校榜
            </button>
          </div>
          {(rankMode === "daily" || rankMode === "school") && (
            <div className="rank-subjects">
              {subjectList.map((subject) => (
                <button
                  className={subject === selectedSubject ? "active" : ""}
                  onClick={() => setSelectedSubject(subject)}
                  key={subject}
                >
                  {subject}
                </button>
              ))}
            </div>
          )}
          <article className="table">
            <div className="thead">
              <span>排名</span>
              <span>{rankMode === "school" ? "学校" : "学生"}</span>
              <span>{rankMode === "daily" ? "正确题数" : rankMode === "school" ? "平均分" : "连续打卡"}</span>
              <span>{rankMode === "daily" ? "完成时间" : rankMode === "school" ? "参与人数" : "最近打卡"}</span>
            </div>
            {shownRows.length === 0 && (
              <div className="tr">
                <strong>—</strong>
                <span>
                  <b>暂时无人上榜</b>
                </span>
                <span>—</span>
                <small>完成首轮 20 题后会显示在这里</small>
              </div>
            )}
            {shownRows.map(([r, name, points, time]) => (
              <div className="tr" key={`${r}-${name}`}>
                <strong>{r}</strong>
                <span>
                  <i>{name[0]}</i>
                  <b>{name}</b>
                </span>
                <span>
                  <b>{points}</b> {rankMode === "daily" ? "/ 20" : rankMode === "school" ? "/ 20" : "天"}
                </span>
                <small>{time}</small>
              </div>
            ))}
            {rankMode !== "school" && <div className="tr mine">
              <strong>{personalRank?.rank ?? "—"}</strong>
              <span>
                <i>我</i>
                <b>{profile?.nickname || (profile?.role === "teacher" ? profile.display_name : "你")}</b>
              </span>
              <span>
                {personalRank
                  ? rankMode === "daily"
                    ? `${personalRank.score} / 20`
                    : `${personalRank.streak_days} 天`
                  : rankMode === "daily"
                    ? "尚未完成"
                    : "—"}
              </span>
              <small>
                {personalRank?.completedAt
                  ? new Date(personalRank.completedAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
                  : personalRank?.last_checkin_date || "—"}
              </small>
            </div>}
          </article>
        </section>
      )}
      {tab === "teacher" && (
        <section className="wrap page">
          <div className="teacherhero">
            <div>
              <p className="eyebrow">TEACHER STUDIO</p>
              <h1>
                让每一份练习，
                <br />
                成为学生的下一步。
              </h1>
              <p>导入老师表格或 PDF，审核题目后发布到全校练习题库。</p>
            </div>
            <b>
              A<small>B　C　D</small>
            </b>
          </div>
          {!isTeacher ? (
            <article className="invite">
              <i>⌁</i>
              <div>
                <h2>进入教师中心</h2>
                <p>
                  首次使用请输入教师邀请码。验证后，此 Google
                  帐号将获得题库管理权限。
                </p>
              </div>
              <button className="primary" onClick={verifyTeacher}>
                验证邀请码　→
              </button>
            </article>
          ) : (
            <>
              {teacherDashboard && (
                <article className="teacher-dashboard">
                  <div className="title">
                    <div>
                      <p className="eyebrow">SCHOOL DATA · {teacherDashboard.date}</p>
                      <h2>今日学生数据</h2>
                    </div>
                    <div className="dashboard-actions">
                      <button className="link" onClick={loadTeacherDashboard}>刷新　→</button>
                      <button className="secondary" onClick={syncTeacherSheet}>同步 Google Sheet</button>
                      <button className="secondary" onClick={downloadTeacherDashboard}>下载今日 CSV</button>
                    </div>
                  </div>
                  <div className="dashboard-stats">
                    <div><b>{teacherDashboard.summary.students}</b><span>已登录学生</span></div>
                    <div><b>{teacherDashboard.summary.activeStudents}</b><span>今日有答题</span></div>
                    <div><b>{teacherDashboard.summary.dailyCompleted}</b><span>每日任务完成</span></div>
                    <div><b>{teacherDashboard.summary.practiceCompleted}</b><span>自由练习完成</span></div>
                  </div>
                  <div className="dashboard-grid">
                    <div>
                      <h3>各科今日表现</h3>
                      {teacherDashboard.subjects.length ? teacherDashboard.subjects.map((item: any) => (
                        <p className="subject-stat" key={item.subject}><b>{item.subject}</b><span>{item.published} 题已发布 · {item.total} 次完成 · {item.averageScore ?? "—"}/20 平均分</span></p>
                      )) : <p className="muted-copy">今天还没有答题资料。</p>}
                    </div>
                    <div>
                      <h3>今日学生状态</h3>
                      <div className="student-list">
                        {teacherDashboard.students.slice(0, 8).map((student: any) => (
                          <p key={student.email || student.name}><b>{student.name}</b><span>{student.active ? `${student.attempts} 次答题 · ${student.subjects}` : "尚未答题"}</span></p>
                        ))}
                        {teacherDashboard.students.length > 8 && <small>下载 CSV 可查看全部 {teacherDashboard.students.length} 位学生。</small>}
                      </div>
                    </div>
                  </div>
                </article>
              )}
              {teacherInsights && (
                <article className="teacher-dashboard quality-dashboard">
                  <div className="title">
                    <div>
                      <p className="eyebrow">QUESTION QUALITY</p>
                      <h2>题目与章节质量</h2>
                    </div>
                    <button className="link" onClick={loadTeacherInsights}>刷新　→</button>
                  </div>
                  <p className="mistake-intro">正确率低不一定代表题目有问题，但可帮助你优先检查题干、答案或安排复习。</p>
                  <div className="dashboard-grid">
                    <div>
                      <h3>较弱章节</h3>
                      {teacherInsights.topics?.length ? teacherInsights.topics.map((item: any) => <p className="insight-row" key={item.topic}><b>{item.topic}</b><span>{item.accuracy}% 正确 · {item.attempts} 次作答</span></p>) : <p className="muted-copy">还没有已作答的章节资料。</p>}
                    </div>
                    <div>
                      <h3>建议优先检查的题目</h3>
                      {teacherInsights.questions?.length ? teacherInsights.questions.slice(0, 6).map((item: any) => <p className="quality-question" key={item.id}><b>{item.accuracy}% · {item.subject}</b><span>{item.prompt}</span><small>{item.topic} · {item.attempts} 次作答</small></p>) : <p className="muted-copy">还没有已作答的题目资料。</p>}
                    </div>
                  </div>
                </article>
              )}
              <article className="upload">
                <i>↑</i>
                <h2>上传新的试卷</h2>
                <p>
                  支持文字型 PDF ·
                  上传后会安全保存为待审核资料，题目必须人工审核、填写答案后才可发布。
                </p>
                <label className="secondary">
                  选择 PDF 文件
                  <input
                    type="file"
                    accept="application/pdf"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadPdf(file);
                    }}
                  />
                </label>
                <button className="primary" onClick={createManualQuestion}>
                  手动新增题目
                </button>
              </article>
              <article className="sheet-import">
                <div>
                  <p className="eyebrow">QUESTION BANK IMPORT</p>
                  <h2>批量导入老师供题</h2>
                  <p>选择 Excel／CSV；如题目包含图表，再同时选择对应 JPG、PNG 或 WebP 图片。系统会依照表格中的图片文件名自动配对，导入后成为待审核草稿。</p>
                </div>
                <div className="sheet-actions">
                  <a className="secondary" href="/api/teacher/question-template">下载 Excel 模板</a>
                  <label className="secondary">
                    {questionSheetFile ? `表格：${questionSheetFile.name}` : "选择 Excel / CSV"}
                    <input
                      type="file"
                      accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                      hidden
                      onChange={(event) => setQuestionSheetFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <label className="secondary">
                    {questionImageFiles.length ? `图片：${questionImageFiles.length} 张` : "选择题目图片（可选）"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      hidden
                      onChange={(event) => setQuestionImageFiles(Array.from(event.target.files || []))}
                    />
                  </label>
                  <button
                    className="primary"
                    disabled={!questionSheetFile || questionImporting}
                    onClick={() => questionSheetFile && importQuestionSheet(questionSheetFile, questionImageFiles)}
                  >
                    {questionImporting ? "正在导入…" : "导入题目"}
                  </button>
                  <button className="secondary" onClick={publishStarterBank}>发布首批 160 题</button>
                </div>
                <small>图片每张最多 5MB、一次最多 100 张。题库来源会标记为「老师供题」或「MyGuru 原创模拟练习题」。</small>
              </article>
              <article className="imports">
                <div className="title">
                  <div>
                    <p className="eyebrow">RECENT IMPORTS</p>
                    <h2>导入记录</h2>
                  </div>
                  <button className="link" onClick={loadTeacherData}>
                    刷新　→
                  </button>
                </div>
                {teacherUploads.length ? (
                  teacherUploads.map((item) => (
                    <Import
                      key={item.id}
                      name={item.filename}
                      details={`${item.subject || "未分类"} · ${new Date(item.created_at).toLocaleString("zh-CN")}`}
                      state={item.status === "published" ? "已发布" : "待审核"}
                    />
                  ))
                ) : (
                  <Import
                    name="尚未上传试卷"
                    details="上传后会显示在这里"
                    state="待审核"
                  />
                )}
              </article>
              <article className="imports">
                <div className="title">
                  <div>
                    <p className="eyebrow">QUESTION REVIEW</p>
                    <h2>批量审核</h2>
                  </div>
                  {visiblePendingIds.length > 0 && (
                    <div className="batch-actions">
                      <button
                        className="link"
                        onClick={() => {
                          setSelectedQuestionIds(
                            selectedVisiblePendingCount === visiblePendingIds.length
                              ? selectedQuestionIds.filter((id) => !visiblePendingIds.includes(id))
                              : [...new Set([...selectedQuestionIds, ...visiblePendingIds])],
                          );
                        }}
                      >
                        {selectedVisiblePendingCount === visiblePendingIds.length
                          ? "取消全选"
                          : "全选目前筛选"}
                      </button>
                      <button
                        className="secondary"
                        disabled={!selectedQuestionIds.length}
                        onClick={() => batchReview("batch-publish")}
                      >
                        批量发布（{selectedQuestionIds.length}）
                      </button>
                      <button
                        className="danger"
                        disabled={!selectedQuestionIds.length}
                        onClick={() => batchReview("batch-delete")}
                      >
                        删除已选
                      </button>
                    </div>
                  )}
                </div>
                <p className="batch-hint">先抽查与编辑少数题目；答案已确认的题目可一次发布。未确认答案的题目会被系统拦截。</p>
                <div className="review-filters">
                  <label>状态
                    <select value={teacherQuestionFilter} onChange={(event) => {
                      setTeacherQuestionFilter(event.target.value as typeof teacherQuestionFilter);
                      setTeacherQuestionPage(1);
                      setSelectedQuestionIds([]);
                    }}>
                      <option value="all">全部题目</option>
                      <option value="draft">待审核</option>
                      <option value="unconfirmed">待确认答案</option>
                      <option value="published">已发布</option>
                    </select>
                  </label>
                  <label>科目
                    <select value={teacherQuestionSubject} onChange={(event) => {
                      setTeacherQuestionSubject(event.target.value);
                      setTeacherQuestionPage(1);
                      setSelectedQuestionIds([]);
                    }}>
                      <option value="all">全部科目</option>
                      {teacherQuestionSubjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                    </select>
                  </label>
                  <small>第 {teacherQuestionPage} 页 · 显示 {visibleTeacherQuestions.length} / {teacherQuestionTotal} 道题目</small>
                </div>
                {visibleTeacherQuestions.length ? (
                  visibleTeacherQuestions.map((item) => (
                    <div className="import" key={item.id}>
                      {item.status !== "published" && (
                        <input
                          className="review-check"
                          type="checkbox"
                          checked={selectedQuestionIds.includes(item.id)}
                          onChange={() => toggleQuestionSelection(item.id)}
                          aria-label={`选择：${item.prompt}`}
                        />
                      )}
                      <i>{item.subject.slice(0, 3)}</i>
                      {item.image_url && (
                        <Image
                          className="review-question-image"
                          src={item.image_url}
                          alt={item.image_alt || "题目插图"}
                          width={160}
                          height={110}
                          sizes="160px"
                          unoptimized
                        />
                      )}
                      <span>
                        <b>{item.prompt}</b>
                        <small>
                          {item.source_label || item.uploads?.filename || "手动建立"} ·{" "}
                          {item.topic ? `${item.topic} · ` : ""}{item.answer_confirmed ? "答案已确认" : "需确认答案"}
                        </small>
                      </span>
                      <em
                        className={
                          item.status === "published" ? "published" : "review"
                        }
                      >
                        {item.status === "published" ? "已发布" : "待审核"}
                      </em>
                      <button onClick={() => editQuestion(item)}>编辑</button>
                      {item.status !== "published" &&
                        (!item.answer_confirmed ? (
                          <button onClick={() => confirmAnswer(item.id)}>
                            确认答案
                          </button>
                        ) : (
                          <button onClick={() => publishQuestion(item.id)}>
                            发布
                          </button>
                        ))}
                    </div>
                  ))
                ) : (
                  <div className="import">
                    <i>ABCD</i>
                    <span>
                      <b>{teacherQuestionTotal ? "这一页没有题目" : "尚无待审核题目"}</b>
                      <small>{teacherQuestionTotal ? "请返回上一页或更换筛选条件。" : "上传 PDF 或手动新增题目后会显示在这里。"}</small>
                    </span>
                  </div>
                )}
                {teacherQuestionTotal > 50 && (
                  <div className="review-pagination">
                    <button
                      className="secondary"
                      disabled={teacherQuestionPage === 1}
                      onClick={() => setTeacherQuestionPage((page) => Math.max(1, page - 1))}
                    >
                      上一页
                    </button>
                    <span>第 {teacherQuestionPage} / {Math.ceil(teacherQuestionTotal / 50)} 页</span>
                    <button
                      className="secondary"
                      disabled={teacherQuestionPage >= Math.ceil(teacherQuestionTotal / 50)}
                      onClick={() => setTeacherQuestionPage((page) => page + 1)}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </article>
            </>
          )}
        </section>
      )}
      {tab === "history" && (
        <section className="wrap page">
          <div className="heading">
            <div>
              <p className="eyebrow">MY LEARNING</p>
              <h1>我的练习记录</h1>
              <p>
                每日正式任务与自由练习都会保存在这里；只有每日首轮会进入排行榜。
              </p>
            </div>
            <b>✦</b>
          </div>
          <article className="table">
            <div className="thead">
              <span>类型</span>
              <span>科目</span>
              <span>成绩</span>
              <span>完成日期</span>
            </div>
            {history.length ? (
              history.map((item) => (
                <div className="tr" key={`${item.kind}-${item.id}`}>
                  <strong>{item.kind === "daily" ? "打卡" : "练习"}</strong>
                  <span>
                    <b>{item.subject}</b>
                  </span>
                  <span>
                    <b>{item.correct_count}</b> / 20
                  </span>
                  <small>
                    {item.completed_at
                      ? new Date(item.completed_at).toLocaleString("zh-CN")
                      : item.local_date}
                  </small>
                </div>
              ))
            ) : (
              <div className="tr">
                <strong>—</strong>
                <span>
                  <b>还没有完成记录</b>
                </span>
                <span>—</span>
                <small>完成第一轮后会显示在这里</small>
              </div>
            )}
          </article>
          <article className="learning-insights">
            <div className="title">
              <div>
                <p className="eyebrow">SMART REVISION</p>
                <h2>我的弱项章节</h2>
              </div>
              <b className="pill">按正确率排序</b>
            </div>
            <p className="mistake-intro">系统按各章节的答题正确率排列；正确率较低的章节会优先显示，帮助你决定先复习哪里。这个分析不会影响成绩或排行榜。</p>
            {learningInsights.length ? learningInsights.slice(0, 6).map((item) => (
              <p className="insight-row" key={item.topic}><b>{item.topic}</b><span>{item.accuracy}% 正确 · {item.attempts} 题</span></p>
            )) : <p className="muted-copy">完成更多带有章节标签的题目后，系统会在这里显示你的弱项章节。</p>}
          </article>
          <article className="mistake-book">
            <div className="title">
              <div>
                <p className="eyebrow">REVIEW TO IMPROVE</p>
                <h2>我的错题本</h2>
              </div>
              <b className="pill">{mistakes.length} 道待复习</b>
            </div>
            <p className="mistake-intro">系统保留你最近答错的不同题目；先看正确答案与解析，再回去练习同一科。</p>
            {mistakes.length ? mistakes.map((item) => (
              <div className="mistake-row" key={item.id}>
                <b>{item.subject}</b>
                <div><strong>{item.prompt}</strong><small>你的答案：{item.selectedOption}　正确答案：{item.correctOption}{item.explanation ? `　·　${item.explanation}` : ""}</small><button className="link mistake-practice" onClick={() => begin(item.subject, "practice")}>练习这科　→</button></div>
              </div>
            )) : <p className="muted-copy">还没有错题。完成练习后，答错的题目会自动保存在这里。</p>}
          </article>
        </section>
      )}
    </main>
  );
}
function Import({
  name,
  details,
  state,
}: {
  name: string;
  details: string;
  state: string;
}) {
  return (
    <div className="import">
      <i>PDF</i>
      <span>
        <b>{name}</b>
        <small>{details}</small>
      </span>
      <em className={state === "已发布" ? "published" : "review"}>{state}</em>
      <button>{state === "已发布" ? "查看" : "审核"}</button>
    </div>
  );
}
