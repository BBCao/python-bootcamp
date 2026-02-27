// Python Bootcamp v3 — tabs + practice preview + 5Q quiz + rich notes editor
const $ = (sel) => document.querySelector(sel);

const i18n = {
  en: {
    startToday: "Start today", today: "Today", reset: "Reset",
    progress: "Progress", streak: "Streak", modules: "Modules", days: "Days",
    tipTitle: "Study tip", tipBody: "Don’t rush. One small win per day is enough.",
    markDone: "Mark done", done: "Done",
    brief: "Brief", concept: "Concept", tryIt: "Try it (run Python)",
    run: "Run", resetCode: "Reset code", copy: "Copy", output: "Output",
    homework: "Homework", quiz: "Quiz", notes: "Notes",
    notesHintRich: "Notes are saved on this device (with formatting).",
    startedOn: (d) => `Started on: ${d}`,
    notStarted: "Not started yet. Click “Start today”.",
    loadingPy: "⏳ Loading Python…", readyPy: "✅ Python ready", running: "🏃 Running…",
    copied: "✅ Copied!", copyFail: "Copy failed. Please select & copy manually.",
    confirmReset: "Reset EVERYTHING (progress, notes, streak)?",
    footer1: "",
    footer2: "Progress is stored locally in your browser.",
    todayBadge: "Today",
    tabLearn: "Learn", tabPractice: "Practice", tabQuiz: "Quiz", tabNotes: "Notes",
    practiceHint: "Tip: change the code and run again. Errors are normal.",
    insertHello: "Insert Hello", preview: "Preview",
    codePreview: "Code preview", previewHint: "Click “Preview” to snapshot your current code.",
    submit: "Submit Answers", score: (c,w)=>`Score: ${c} correct · ${w} incorrect`,
    insertImage: "Image", importNote: "Import", save: "Save", clear: "Clear",
    aboutPythonTitle: "Python in 60 seconds",
  },
  zh: {
    startToday: "从今天开始", today: "今天", reset: "重置",
    progress: "进度", streak: "连续打卡", modules: "模块", days: "天数",
    tipTitle: "学习提示", tipBody: "别着急。每天一个小胜利就够了。",
    markDone: "标记完成", done: "已完成",
    brief: "本课简介", concept: "讲解", tryIt: "动手练习（运行 Python）",
    run: "运行", resetCode: "重置代码", copy: "复制", output: "输出",
    homework: "作业", quiz: "小测验", notes: "笔记",
    notesHintRich: "笔记（含格式）保存在本设备浏览器里。",
    startedOn: (d) => `开始日期：${d}`,
    notStarted: "你还没开始。点击「从今天开始」。",
    loadingPy: "⏳ 正在加载 Python…", readyPy: "✅ Python 已就绪", running: "🏃 正在运行…",
    copied: "✅ 已复制！", copyFail: "复制失败，请手动选中复制。",
    confirmReset: "确定要重置全部数据（进度/笔记/连续打卡）吗？",
    footer1: "把此文件夹上传到 GitHub Pages，即可随时学习。",
    footer2: "学习进度保存在浏览器本地。",
    todayBadge: "今天",
    tabLearn: "学习", tabPractice: "练习", tabQuiz: "测验", tabNotes: "笔记",
    practiceHint: "提示：改改代码再运行。报错很正常。",
    insertHello: "插入 Hello", preview: "预览",
    codePreview: "代码预览", previewHint: "点击「预览」生成当前代码快照。",
    submit: "提交答案", score: (c,w)=>`得分：正确 ${c} · 错误 ${w}`,
    insertImage: "图片", importNote: "导入", save: "保存", clear: "清空",
    aboutPythonTitle: "60 秒认识 Python",
  }
};

const STATE_KEY = "pybootcamp_state_v3";
const LANG_KEY  = "pybootcamp_lang_v3";
const THEME_KEY = "pybootcamp_theme_v3";

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
    return JSON.parse(localStorage.getItem(STATE_KEY)) || {
      started_on:null, completed:{}, hw_checks:{}, code:{}, quiz:{}, notes_html:{}, code_preview:{}
    };
  }catch{
    return { started_on:null, completed:{}, hw_checks:{}, code:{}, quiz:{}, notes_html:{}, code_preview:{} };
  }
}
function saveState(st){ localStorage.setItem(STATE_KEY, JSON.stringify(st)); }

function setTextI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    const v = i18n[lang][k];
    if(typeof v === "string") el.textContent = v;
  });
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
    const t = document.createElement("div"); t.className="t"; t.textContent = m.title[lang];
    const d = document.createElement("div"); d.className="d"; d.textContent = `Day ${m.days[0]}–${m.days[m.days.length-1]}`;
    box.appendChild(t); box.appendChild(d);
    el.appendChild(box);
  });
}

function renderModuleAccordion(){
  const st = loadState();
  const todayN = computeTodayDayNumber(st);
  const el = $("#moduleList");
  el.innerHTML = "";

  const expandedKey = "pybootcamp_modules_expanded_v3_1";
  let expanded = {};
  try{ expanded = JSON.parse(localStorage.getItem(expandedKey)) || {}; }catch{ expanded = {}; }
  if(Object.keys(expanded).length === 0){
    expanded = { "0": true, "1": false, "2": false, "3": false };
    localStorage.setItem(expandedKey, JSON.stringify(expanded));
  }

  course.modules.forEach((mod, mi)=>{
    const section = document.createElement("div");
    section.className = "moduleAcc";

    const header = document.createElement("button");
    header.className = "moduleHeader";
    const isOpen = !!expanded[String(mi)];
    header.setAttribute("aria-expanded", isOpen ? "true" : "false");

    const title = document.createElement("div");
    title.className = "moduleHeaderTitle";
    title.textContent = mod.title[lang];

    const arrow = document.createElement("div");
    arrow.className = "moduleArrow";
    arrow.textContent = isOpen ? "▾" : "▸";

    header.appendChild(title);
    header.appendChild(arrow);

    const list = document.createElement("div");
    list.className = "moduleDays";
    list.style.display = isOpen ? "flex" : "none";

    mod.days.forEach((n)=>{
      const day = course.days[n-1];
      const item = document.createElement("div");
      item.className = "dayItem";
      item.dataset.day = String(n);

      const left = document.createElement("div");
      left.className = "dayLeft";
      const name = document.createElement("div");
      name.className = "dayName";
      name.textContent = `${day.title[lang]}`;
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
      list.appendChild(item);
    });

    header.addEventListener("click", ()=>{
      expanded[String(mi)] = !expanded[String(mi)];
      localStorage.setItem(expandedKey, JSON.stringify(expanded));
      renderModuleAccordion();
      updateActiveDay();
    });

    section.appendChild(header);
    section.appendChild(list);
    el.appendChild(section);
  });

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
    const span = document.createElement("div"); span.textContent = t;
    row.appendChild(cb); row.appendChild(span);
    hwWrap.appendChild(row);
  });
  $("#homework").innerHTML = "";
  $("#homework").appendChild(hwWrap);
}

function renderBrief(n){
  const day = course.days[n-1];
  $("#briefText").textContent = day.brief?.[lang] || "";
}

function renderAboutPython(n){
  const box = $("#aboutPython");
  const body = $("#aboutPythonBody");
  if(n !== 1){ box.hidden = true; return; }
  box.hidden = false;
  const textEn = "Python is a beginner‑friendly programming language. Use it for automation, data analysis, web apps, AI/ML, scripting, and more.";
  const textZh = "Python 是一门对新手友好的编程语言，可用于自动化、数据分析、Web 应用、AI/机器学习、脚本开发等。";
  body.textContent = (lang === "zh") ? textZh : textEn;
}

function openDay(n){
  currentDay = n;
  const st = loadState();
  const day = course.days[n-1];

  $("#dayKicker").textContent = `Day ${n}`;
  $("#dayTitle").textContent = day.title[lang];
  $("#dayMeta").textContent = day.time[lang];

  renderBrief(n);
  renderAboutPython(n);

  $("#concept").innerHTML = mdToHtml(day.concept[lang]);

  $("#code").value = st.code[String(n)] ?? day.starter[lang];
  $("#output").textContent = "";
  $("#codePreview").textContent = st.code_preview[String(n)] ?? "";

  $("#notesEditor").innerHTML = st.notes_html[String(n)] ?? "";

  renderHomework(n);
  renderQuiz(n);

  const done = !!st.completed[String(n)];
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

/* Pyodide */
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

  try{ await pyodide.runPythonAsync(code); }
  catch(err){ out += "\n" + String(err); }
  finally{
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
function insertHello(){
  const snippet = "print('Hello, World!')\n";
  const ta = $("#code");
  const start = ta.selectionStart ?? ta.value.length;
  const end = ta.selectionEnd ?? ta.value.length;
  ta.value = ta.value.slice(0,start) + snippet + ta.value.slice(end);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = start + snippet.length;
  const st = loadState(); st.code[String(currentDay)] = ta.value; saveState(st);
}
function previewCode(){
  const st = loadState();
  const code = $("#code").value;
  $("#codePreview").textContent = code;
  st.code_preview[String(currentDay)] = code;
  saveState(st);
}

/* Progress */
function markDone(){
  const st = loadState();
  const key = String(currentDay);
  if(st.completed[key]) delete st.completed[key];
  else st.completed[key] = { done:true, date: isoDate(new Date()) };
  saveState(st);
  renderDashboard(); renderModuleAccordion(); openDay(currentDay);
}
function startToday(){
  const st = loadState();
  if(!st.started_on){ st.started_on = isoDate(new Date()); saveState(st); }
  renderDashboard(); renderModuleAccordion(); goToday();
}
function goToday(){
  const st = loadState();
  openDay(computeTodayDayNumber(st));
  window.scrollTo({top:0, behavior:"smooth"});
}
function resetAll(){
  if(!confirm(i18n[lang].confirmReset)) return;
  localStorage.removeItem(STATE_KEY);
  renderDashboard(); renderModuleAccordion(); openDay(1);
}

/* Quiz: 5 questions + radio selection + submit + score */
function renderQuiz(n){
  const day = course.days[n-1];
  const st = loadState();
  const questions = day.quiz?.questions || [];
  const saved = st.quiz[String(n)] || { answers:{}, submitted:false, score:null };

  const wrap = document.createElement("div");
  wrap.className = "quizBox";

  const total = Math.min(5, questions.length);

  for(let qi=0; qi<total; qi++){
    const qq = questions[qi];

    const qBlock = document.createElement("div");
    qBlock.className = "quizQBlock";

    const qEl = document.createElement("div");
    qEl.className = "quizQ";
    qEl.textContent = `${qi+1}. ${qq.q[lang]}`;
    qBlock.appendChild(qEl);

    const groupName = `q_${n}_${qi}`;
    const chosen = saved.answers[String(qi)];

    const optWrap = document.createElement("div");
    optWrap.className = "quizRadioGroup";

    qq.options[lang].forEach((opt, oi)=>{
      const label = document.createElement("label");
      label.className = "quizRadio";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = groupName;
      input.value = String(oi);
      input.checked = chosen === oi;

      if(saved.submitted) input.disabled = true;

      input.addEventListener("change", ()=>{
        const st2 = loadState();
        const cur = st2.quiz[String(n)] || { answers:{}, submitted:false, score:null };
        if(cur.submitted) return;
        cur.answers[String(qi)] = oi;
        st2.quiz[String(n)] = cur;
        saveState(st2);
      });

      const span = document.createElement("span");
      span.className = "quizRadioText";
      span.textContent = opt;

      label.appendChild(input);
      label.appendChild(span);

      if(saved.submitted){
        if(oi === qq.answer) label.classList.add("correct");
        if(chosen === oi && chosen !== qq.answer) label.classList.add("wrong");
      }

      optWrap.appendChild(label);
    });

    qBlock.appendChild(optWrap);
    wrap.appendChild(qBlock);
  }

  const btnRow = document.createElement("div");
  btnRow.style.display = "flex";
  btnRow.style.gap = "10px";
  btnRow.style.marginTop = "12px";
  btnRow.style.alignItems = "center";

  const submitBtn = document.createElement("button");
  submitBtn.className = "primary";
  submitBtn.textContent = i18n[lang].submit;
  submitBtn.addEventListener("click", ()=>{
    const st2 = loadState();
    const cur = st2.quiz[String(n)] || { answers:{}, submitted:false, score:null };
    if(cur.submitted) return;
    let correct = 0;
    for(let qi=0; qi<total; qi++){
      const ans = cur.answers[String(qi)];
      if(ans === questions[qi].answer) correct++;
    }
    const wrong = total - correct;
    cur.submitted = true;
    cur.score = { correct, wrong, total };
    st2.quiz[String(n)] = cur;
    saveState(st2);
    renderQuiz(n);
  });

  const retryBtn = document.createElement("button");
  retryBtn.className = "btn";
  retryBtn.textContent = (lang === "zh") ? "重做" : "Retry";
  retryBtn.addEventListener("click", ()=>{
    const st2 = loadState();
    st2.quiz[String(n)] = { answers:{}, submitted:false, score:null };
    saveState(st2);
    renderQuiz(n);
  });

  btnRow.appendChild(submitBtn);
  btnRow.appendChild(retryBtn);
  wrap.appendChild(btnRow);

  if(saved.submitted && saved.score){
    const res = document.createElement("div");
    res.className = "quizResult";
    res.style.marginTop = "10px";
    res.classList.add(saved.score.wrong === 0 ? "good" : "bad");
    res.textContent = i18n[lang].score(saved.score.correct, saved.score.wrong);
    wrap.appendChild(res);
  }

  const quizEl = document.getElementById("quiz");
  quizEl.innerHTML = "";
  quizEl.appendChild(wrap);
}

/* Rich notes editor */
function execCmd(cmd, value=null){
  try{ document.execCommand(cmd, false, value); }catch{}
}
function escapeHtml(s){
  return s.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
function fileToDataURL(file){
  return new Promise((res, rej)=>{
    const r = new FileReader();
    r.onload = ()=>res(String(r.result));
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
function saveNotes(){
  const st = loadState();
  st.notes_html[String(currentDay)] = $("#notesEditor").innerHTML;
  saveState(st);
}
function hookNotesToolbar(){
  document.querySelectorAll(".toolBtn[data-cmd]").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      execCmd(btn.dataset.cmd);
      $("#notesEditor").focus();
    });
  });
  $("#fontSize").addEventListener("change", ()=>{
    execCmd("fontSize", $("#fontSize").value);
    $("#notesEditor").focus();
  });
  $("#fontColor").addEventListener("input", ()=>{
    execCmd("foreColor", $("#fontColor").value);
    $("#notesEditor").focus();
  });

  $("#noteImage").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const dataUrl = await fileToDataURL(file);
    execCmd("insertHTML", `<img src="${dataUrl}" alt="image" />`);
    saveNotes();
    e.target.value = "";
  });

  $("#noteImport").addEventListener("change", async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await file.text();
    if(file.name.toLowerCase().endsWith(".txt")){
      $("#notesEditor").innerHTML = `<pre>${escapeHtml(text)}</pre>`;
    }else{
      $("#notesEditor").innerHTML = text;
    }
    saveNotes();
    e.target.value = "";
  });

  $("#saveNotes").addEventListener("click", saveNotes);
  $("#clearNotes").addEventListener("click", ()=>{ $("#notesEditor").innerHTML=""; saveNotes(); });

  let t=null;
  $("#notesEditor").addEventListener("input", ()=>{
    clearTimeout(t);
    t=setTimeout(saveNotes, 400);
  });
}

/* Language + theme */
function applyLang(){
  document.documentElement.lang = lang;
  $("#lang").value = lang;
  setTextI18n();
  $("#appTitle").textContent = course.meta.name[lang];
  $("#appSubtitle").textContent = `${course.meta.mode[lang]} · ${course.meta.daily_time[lang]}`;
  renderDashboard(); renderModuleAccordion(); openDay(currentDay);
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
  // v3.14 sidebar default expansion: Week 1 open, Week 2-4 closed (on each load)
  try {
    localStorage.setItem("pybootcamp_modules_expanded_v3_1", JSON.stringify({"0": true, "1": false, "2": false, "3": false}));
  } catch (e) {}

  // v3.13 ensure week1 expanded default (first run only)
  const __expandedKey = "pybootcamp_modules_expanded_v3_1";
  try {
    const cur = JSON.parse(localStorage.getItem(__expandedKey) || "null");
    if(!cur || Object.keys(cur).length === 0){
      localStorage.setItem(__expandedKey, JSON.stringify({"0": true, "1": false, "2": false, "3": false}));
    }
  } catch {
    localStorage.setItem(__expandedKey, JSON.stringify({"0": true, "1": false, "2": false, "3": false}));
  }

  lang = localStorage.getItem(LANG_KEY) || "en";
  const theme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(theme);

  applyLang();

  const st = loadState();
  openDay(st.started_on ? computeTodayDayNumber(st) : 1);

  // Tabs
  document.querySelectorAll(".tab").forEach(btn=> btn.addEventListener("click", ()=> setTab(btn.dataset.tab)));

  $("#run").addEventListener("click", ()=>{ setTab("practice"); runCode(); });
  $("#resetCode").addEventListener("click", resetCode);
  $("#copyCode").addEventListener("click", copyCode);
  $("#markDone").addEventListener("click", markDone);
  $("#startToday").addEventListener("click", startToday);
  $("#goToday").addEventListener("click", goToday);
  $("#resetAll").addEventListener("click", resetAll);

  $("#promptHello").addEventListener("click", insertHello);
  $("#previewCode").addEventListener("click", previewCode);

  $("#lang").addEventListener("change", ()=>{
    lang = $("#lang").value;
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  });

  $("#toggleTheme").addEventListener("click", ()=>{
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(cur === "dark" ? "light" : "dark");
  });

  // Mobile nav
  $("#toggleNav").addEventListener("click", ()=> $("#nav").classList.toggle("open"));
  document.addEventListener("click", (e)=>{
    if(window.matchMedia("(max-width: 980px)").matches){
      const nav = $("#nav");
      const btn = $("#toggleNav");
      if(nav.classList.contains("open") && !nav.contains(e.target) && !btn.contains(e.target)){
        nav.classList.remove("open");
      }
    }
  });

  hookNotesToolbar();
  await initPyodide();
}
main();


// v3.4 mobile sidebar toggle
document.addEventListener("DOMContentLoaded", function () {
  const hamburger = document.querySelector(".hamburger");
  const sidebar = document.querySelector(".sidebar");
  if (hamburger && sidebar) {
    hamburger.addEventListener("click", function () {
      sidebar.classList.toggle("open");
    });
  }
});
