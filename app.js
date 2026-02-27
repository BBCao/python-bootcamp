// Python Bootcamp v2 — modern UI + tabs + bilingual + progress tracking + Pyodide runner
const $ = (sel) => document.querySelector(sel);

const i18n = {
  en: {
    startToday: "Start today",
    today: "Today",
    reset: "Reset",
    progress: "Progress",
    streak: "Streak",
    modules: "Modules",
    days: "Days",
    mentorTipTitle: "Mentor tip",
    mentorTipBody: "Don’t rush. One small win per day is enough.",
    markDone: "Mark done",
    done: "Done",
    concept: "Concept",
    tryIt: "Try it (run Python)",
    run: "Run",
    resetCode: "Reset code",
    copy: "Copy",
    output: "Output",
    homework: "Homework",
    quiz: "Quiz",
    notes: "Notes",
    notesHint: "Your notes are saved on this device.",
    startedOn: (d) => `Started on: ${d}`,
    notStarted: "Not started yet. Click “Start today”.",
    loadingPy: "⏳ Loading Python…",
    readyPy: "✅ Python ready",
    running: "🏃 Running…",
    copied: "✅ Copied!",
    copyFail: "Copy failed. Please select & copy manually.",
    confirmReset: "Reset EVERYTHING (progress, notes, streak)?",
    quizCorrect: "✅ Correct",
    quizWrong: "❌ Try again",
    footer1: "Upload this folder to GitHub Pages to learn anywhere.",
    footer2: "Progress is stored locally in your browser.",
    todayBadge: "Today",
    tabLearn: "Learn",
    tabPractice: "Practice",
    tabQuiz: "Quiz",
    tabNotes: "Notes",
    practiceHint: "Tip: change the code and run again. Errors are normal."
  },
  zh: {
    startToday: "从今天开始",
    today: "今天",
    reset: "重置",
    progress: "进度",
    streak: "连续打卡",
    modules: "模块",
    days: "天数",
    mentorTipTitle: "教练提示",
    mentorTipBody: "别着急。每天一个小胜利就够了。",
    markDone: "标记完成",
    done: "已完成",
    concept: "讲解",
    tryIt: "动手练习（运行 Python）",
    run: "运行",
    resetCode: "重置代码",
    copy: "复制",
    output: "输出",
    homework: "作业",
    quiz: "小测验",
    notes: "笔记",
    notesHint: "笔记保存在本设备浏览器里。",
    startedOn: (d) => `开始日期：${d}`,
    notStarted: "你还没开始。点击「从今天开始」。",
    loadingPy: "⏳ 正在加载 Python…",
    readyPy: "✅ Python 已就绪",
    running: "🏃 正在运行…",
    copied: "✅ 已复制！",
    copyFail: "复制失败，请手动选中复制。",
    confirmReset: "确定要重置全部数据（进度/笔记/连续打卡）吗？",
    quizCorrect: "✅ 正确",
    quizWrong: "❌ 再试试",
    footer1: "把此文件夹上传到 GitHub Pages，即可随时学习。",
    footer2: "学习进度保存在浏览器本地。",
    todayBadge: "今天",
    tabLearn: "学习",
    tabPractice: "练习",
    tabQuiz: "测验",
    tabNotes: "笔记",
    practiceHint: "提示：改改代码再运行。报错很正常。"
  }
};

const STATE_KEY = "pybootcamp_state_v2";
const LANG_KEY  = "pybootcamp_lang_v2";
const THEME_KEY = "pybootcamp_theme_v2";

let lang = "en";
let course = null;
let currentDay = 1;
let pyodide = null;

function isoDate(d){ return d.toISOString().slice(0,10); }
function parseISO(s){ return new Date(s + "T00:00:00"); }
function daysBetween(a,b){
  const da = (a instanceof Date) ? a : parseISO(a);
  const db = (b instanceof Date) ? b : parseISO(b);
  return Math.floor((db - da) / (24*3600*1000));
}
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function loadState(){
  try{
    return JSON.parse(localStorage.getItem(STATE_KEY)) || { started_on:null, completed:{}, hw_checks:{}, notes:{}, code:{}, quiz:{} };
  }catch{
    return { started_on:null, completed:{}, hw_checks:{}, notes:{}, code:{}, quiz:{} };
  }
}
function saveState(st){ localStorage.setItem(STATE_KEY, JSON.stringify(st)); }

function setTextI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    const v = i18n[lang][k];
    if(typeof v === "string") el.textContent = v;
  });
  // Buttons that are not purely i18n-tagged
  $("#startToday").textContent = i18n[lang].startToday;
  $("#goToday").textContent = i18n[lang].today;
  $("#resetAll").textContent = i18n[lang].reset;
}

function mdToHtml(md){
  const esc = (s)=>s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, __, code)=>`<pre class="output"><code>${esc(code)}</code></pre>`);
  md = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  md = md.replace(/`([^`]+?)`/g, "<code>$1</code>");
  const parts = md.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
  return parts.map(p=>`<p>${p.replaceAll("\n","<br/>")}</p>`).join("\n");
}

function computeTodayDayNumber(st){
  if(!st.started_on) return 1;
  const diff = daysBetween(st.started_on, isoDate(new Date()));
  return clamp(diff + 1, 1, 30);
}

function computeStreak(st){
  let s = 0;
  for(let back=0; back<365; back++){
    const d = new Date(); d.setDate(d.getDate()-back);
    const ds = isoDate(d);
    const has = Object.values(st.completed).some(x => x && x.date === ds);
    if(!has) break;
    s++;
  }
  return s;
}

function renderDashboard(){
  const st = loadState();
  const doneCount = Object.keys(st.completed).length;
  $("#progressValue").textContent = `${doneCount}/30`;
  $("#progressBar").style.width = `${Math.round((doneCount/30)*100)}%`;
  $("#streakValue").textContent = String(computeStreak(st));
  $("#startedOnText").textContent = st.started_on ? i18n[lang].startedOn(st.started_on) : i18n[lang].notStarted;
}

function renderModules(){
  const el = $("#moduleList");
  el.innerHTML = "";
  course.modules.forEach(m=>{
    const box = document.createElement("div");
    box.className = "moduleItem";
    const t = document.createElement("div");
    t.className = "t";
    t.textContent = m.title[lang];
    const d = document.createElement("div");
    d.className = "d";
    d.textContent = `Day ${m.days[0]}–${m.days[m.days.length-1]}`;
    box.appendChild(t); box.appendChild(d);
    el.appendChild(box);
  });
}

function renderDayList(){
  const st = loadState();
  const todayN = computeTodayDayNumber(st);
  const el = $("#dayList");
  el.innerHTML = "";
  for(let n=1; n<=30; n++){
    const day = course.days[n-1];
    const item = document.createElement("div");
    item.className = "dayItem";
    item.dataset.day = String(n);

    const left = document.createElement("div");
    left.className = "dayLeft";
    const name = document.createElement("div");
    name.className = "dayName";
    name.textContent = `${n}. ${day.title[lang]}`;
    const desc = document.createElement("div");
    desc.className = "dayDesc";
    desc.textContent = day.time[lang];
    left.appendChild(name); left.appendChild(desc);

    const badge = document.createElement("div");
    badge.className = "badge";
    const done = !!st.completed[String(n)];
    if(done){
      badge.textContent = i18n[lang].done;
      badge.classList.add("done");
    }else if(n === todayN){
      badge.textContent = i18n[lang].todayBadge;
      badge.classList.add("today");
    }else{
      badge.textContent = `Day ${n}`;
    }

    item.appendChild(left);
    item.appendChild(badge);
    item.addEventListener("click", ()=>openDay(n));
    el.appendChild(item);
  }
  updateActiveDay();
}

function updateActiveDay(){
  document.querySelectorAll(".dayItem").forEach(el=>{
    el.classList.toggle("active", Number(el.dataset.day) === currentDay);
  });
}

function renderHomework(n){
  const day = course.days[n-1];
  const st = loadState();
  const hw = day.homework[lang];
  const checks = st.hw_checks[String(n)] ?? Array(hw.length).fill(false);

  const hwWrap = document.createElement("div");
  hwWrap.className = "hwList";
  hw.forEach((t, idx)=>{
    const row = document.createElement("label");
    row.className = "hwItem";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checks[idx];
    cb.addEventListener("change", ()=>{
      const st2 = loadState();
      const arr = st2.hw_checks[String(n)] ?? Array(hw.length).fill(false);
      arr[idx] = cb.checked;
      st2.hw_checks[String(n)] = arr;
      saveState(st2);
    });
    const span = document.createElement("div");
    span.textContent = t;
    row.appendChild(cb); row.appendChild(span);
    hwWrap.appendChild(row);
  });
  $("#homework").innerHTML = "";
  $("#homework").appendChild(hwWrap);
}

function renderQuiz(n){
  const day = course.days[n-1];
  const st = loadState();
  const wrap = document.createElement("div");
  wrap.className = "quizBox";

  const q = document.createElement("div");
  q.className = "quizQ";
  q.textContent = day.quiz.q[lang];
  wrap.appendChild(q);

  const saved = st.quiz[String(n)];
  const result = document.createElement("div");
  result.className = "quizResult";

  day.quiz.options[lang].forEach((opt, idx)=>{
    const row = document.createElement("div");
    row.className = "quizOpt";
    row.textContent = opt;

    if(saved?.answered){
      if(idx === day.quiz.answer) row.classList.add("correct");
      if(!saved.correct && idx === saved.chosen) row.classList.add("wrong");
    }

    row.addEventListener("click", ()=>{
      const st2 = loadState();
      const correct = idx === day.quiz.answer;
      st2.quiz[String(n)] = { answered:true, correct, chosen: idx };
      saveState(st2);
      openDay(n);
    });

    wrap.appendChild(row);
  });

  if(saved?.answered){
    result.textContent = saved.correct ? i18n[lang].quizCorrect : i18n[lang].quizWrong;
    result.classList.add(saved.correct ? "good" : "bad");
    wrap.appendChild(result);
  }

  $("#quiz").innerHTML = "";
  $("#quiz").appendChild(wrap);
}

function openDay(n){
  currentDay = n;
  const st = loadState();
  const day = course.days[n-1];

  $("#dayKicker").textContent = `Day ${n}`;
  $("#dayTitle").textContent = day.title[lang];
  $("#dayMeta").textContent = day.time[lang];

  $("#concept").innerHTML = mdToHtml(day.concept[lang]);

  $("#code").value = st.code[String(n)] ?? day.starter[lang];
  $("#output").textContent = "";
  $("#notes").value = st.notes[String(n)] ?? "";

  renderHomework(n);
  renderQuiz(n);

  const done = !!st.completed[String(n)];
  $("#markDone").classList.toggle("done", done);
  $("#markDone span").textContent = done ? i18n[lang].done : i18n[lang].markDone;

  updateActiveDay();
}

function setTab(tab){
  document.querySelectorAll(".tab").forEach(btn=>{
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll(".tabPanel").forEach(p=>p.classList.remove("active"));
  const panel = document.getElementById("tab-" + tab);
  if(panel) panel.classList.add("active");
}

async function initPyodide(){
  $("#pyStatus").textContent = i18n[lang].loadingPy;
  pyodide = await loadPyodide();
  $("#pyStatus").textContent = i18n[lang].readyPy;
}

async function runCode(){
  if(!pyodide) return;
  $("#pyStatus").textContent = i18n[lang].running;
  $("#output").textContent = "";

  const code = $("#code").value;
  const st = loadState();
  st.code[String(currentDay)] = code;
  saveState(st);

  let out = "";
  const write = (s)=>{ out += s; };
  pyodide.setStdout({ batched: write });
  pyodide.setStderr({ batched: write });

  try{
    await pyodide.runPythonAsync(code);
  }catch(err){
    out += "\n" + String(err);
  }finally{
    $("#output").textContent = out.trimEnd();
    $("#pyStatus").textContent = i18n[lang].readyPy;
  }
}

async function copyCode(){
  try{
    await navigator.clipboard.writeText($("#code").value);
    const old = $("#copyCode").innerHTML;
    $("#copyCode").innerHTML = "✅ " + i18n[lang].copied;
    setTimeout(()=> $("#copyCode").innerHTML = old, 900);
  }catch{
    alert(i18n[lang].copyFail);
  }
}

function resetCode(){
  const day = course.days[currentDay-1];
  $("#code").value = day.starter[lang];
  const st = loadState();
  st.code[String(currentDay)] = $("#code").value;
  saveState(st);
  $("#output").textContent = "";
}

function markDone(){
  const st = loadState();
  const key = String(currentDay);
  if(st.completed[key]) delete st.completed[key];
  else st.completed[key] = { done:true, date: isoDate(new Date()) };
  saveState(st);
  renderDashboard();
  renderDayList();
  openDay(currentDay);
}

function startToday(){
  const st = loadState();
  if(!st.started_on){
    st.started_on = isoDate(new Date());
    saveState(st);
  }
  renderDashboard();
  renderDayList();
  goToday();
}

function goToday(){
  const st = loadState();
  openDay(computeTodayDayNumber(st));
  window.scrollTo({top:0, behavior:"smooth"});
}

function resetAll(){
  if(!confirm(i18n[lang].confirmReset)) return;
  localStorage.removeItem(STATE_KEY);
  renderDashboard();
  renderDayList();
  openDay(1);
}

function applyLang(){
  document.documentElement.lang = lang;
  $("#lang").value = lang;
  setTextI18n();
  $("#appTitle").textContent = course.meta.name[lang];
  $("#appSubtitle").textContent = `${course.meta.mode[lang]} · ${course.meta.daily_time[lang]}`;
  // placeholders
  $("#notes").placeholder = (lang === "zh") ? "在这里写你的笔记…" : "Write your notes here...";
  // refresh visible day list & content
  renderModules(); renderDashboard(); renderDayList(); openDay(currentDay);
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function loadCourse(){
  course = JSON.parse(document.getElementById("course-data").textContent);
}

async function main(){
  loadCourse();

  lang = localStorage.getItem(LANG_KEY) || "en";
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(theme);

  applyLang();

  const st = loadState();
  openDay(st.started_on ? computeTodayDayNumber(st) : 1);

  // Tabs
  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
  });

  $("#run").addEventListener("click", ()=>{ setTab("practice"); runCode(); });
  $("#resetCode").addEventListener("click", resetCode);
  $("#copyCode").addEventListener("click", copyCode);
  $("#markDone").addEventListener("click", markDone);
  $("#startToday").addEventListener("click", startToday);
  $("#goToday").addEventListener("click", goToday);
  $("#resetAll").addEventListener("click", resetAll);

  $("#lang").addEventListener("change", ()=>{
    lang = $("#lang").value;
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  });

  $("#toggleTheme").addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // Notes autosave
  $("#notes").addEventListener("input", ()=>{
    const st2 = loadState();
    st2.notes[String(currentDay)] = $("#notes").value;
    saveState(st2);
  });

  // Code autosave
  $("#code").addEventListener("input", ()=>{
    const st2 = loadState();
    st2.code[String(currentDay)] = $("#code").value;
    saveState(st2);
  });

  // Mobile nav
  $("#toggleNav").addEventListener("click", ()=>{
    $("#nav").classList.toggle("open");
  });
  document.addEventListener("click", (e)=>{
    // close nav when tapping outside on mobile
    if(window.matchMedia("(max-width: 980px)").matches){
      const nav = $("#nav");
      const btn = $("#toggleNav");
      if(nav.classList.contains("open") && !nav.contains(e.target) && !btn.contains(e.target)){
        nav.classList.remove("open");
      }
    }
  });

  await initPyodide();
}
main();
