// Weekly Goals Tracker — all data lives in localStorage under STORAGE_KEY.
// Shape: { weeks: { "YYYY-MM-DD" (Monday): { goals: [...], days: { 0..6: note }, reflection } } }
// Goal:  { id, title, done, ratings: { 0..6: 1..5 }, notes: { 0..6: string } }

const STORAGE_KEY = "weekly-goals-tracker:v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const $ = (sel) => document.querySelector(sel);

// ---------- dates ----------
function pad(n) { return String(n).padStart(2, "0"); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromKey(k) { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); }
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmt(d, opts) { return d.toLocaleDateString(undefined, opts); }
function weekRangeLabel(key) {
  const start = fromKey(key), end = addDays(start, 6);
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${fmt(start, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" })} – ${fmt(end, { month: "short", day: "numeric", year: "numeric" })}`;
}
function todayIndex(key) {
  const now = new Date();
  return toKey(mondayOf(now)) === key ? (now.getDay() + 6) % 7 : -1;
}

// ---------- storage ----------
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && data.weeks) return data;
  } catch { /* fall through */ }
  return { weeks: {} };
}
let state = load();
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getWeek(key, create = false) {
  let w = state.weeks[key];
  if (!w && create) w = state.weeks[key] = { goals: [], days: {}, reflection: "" };
  return w || { goals: [], days: {}, reflection: "" };
}
function pruneWeek(key) {
  const w = state.weeks[key];
  if (w && !w.goals.length && !w.reflection && !Object.values(w.days).some(Boolean)) delete state.weeks[key];
}
function uid() { return Math.random().toString(36).slice(2, 10); }

// ---------- stats ----------
function goalAvg(goal) {
  const vals = Object.values(goal.ratings || {}).filter(Boolean);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function weekAvg(week) {
  const vals = week.goals.flatMap((g) => Object.values(g.ratings || {}).filter(Boolean));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function fmtAvg(v) { return v == null ? "—" : v.toFixed(1); }
function ratingClass(v) { return v ? `r${Math.round(v)}` : ""; }

// ---------- view state ----------
let currentKey = toKey(mondayOf(new Date()));
let currentView = "week";

function setView(view) {
  currentView = view;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $("#weekView").hidden = view !== "week";
  $("#historyView").hidden = view !== "history";
  render();
}

function render() {
  if (currentView === "week") renderWeek();
  else renderHistory();
}

// ---------- week view ----------
function renderWeek() {
  const week = getWeek(currentKey);
  const thisWeekKey = toKey(mondayOf(new Date()));
  const tIdx = todayIndex(currentKey);

  $("#weekTitle").textContent = weekRangeLabel(currentKey);
  $("#weekBadge").textContent =
    currentKey === thisWeekKey ? "This week" : currentKey < thisWeekKey ? "Past week" : "Upcoming";

  // empty state / copy-from-previous
  const prevKey = toKey(addDays(fromKey(currentKey), -7));
  const prev = state.weeks[prevKey];
  $("#emptyHint").hidden = week.goals.length > 0;
  $("#copyLastWeek").hidden = !(prev && prev.goals.length);

  // grid
  const grid = $("#grid");
  grid.innerHTML = "";
  if (week.goals.length) {
    const start = fromKey(currentKey);
    const head = document.createElement("tr");
    head.innerHTML =
      `<th class="goalcell">Goal</th>` +
      DAYS.map((d, i) => `<th class="${i === tIdx ? "today" : ""}">${d}<br><span>${addDays(start, i).getDate()}</span></th>`).join("") +
      `<th>Avg</th><th></th>`;
    grid.appendChild(head);

    week.goals.forEach((goal, gi) => {
      const tr = document.createElement("tr");

      const nameTd = document.createElement("td");
      nameTd.className = "goalcell";
      const name = document.createElement("input");
      name.type = "text";
      name.className = "goaltitle" + (goal.done ? " done" : "");
      name.value = goal.title;
      name.addEventListener("change", () => {
        const v = name.value.trim();
        if (v) { goal.title = v; save(); } else name.value = goal.title;
      });
      nameTd.appendChild(name);
      tr.appendChild(nameTd);

      DAYS.forEach((_, di) => {
        const td = document.createElement("td");
        if (di === tIdx) td.className = "today";
        const r = goal.ratings?.[di];
        const note = goal.notes?.[di];
        const btn = document.createElement("button");
        btn.className = `cell ${r ? "rated " + ratingClass(r) : ""} ${note ? "hasnote" : ""}`;
        btn.textContent = r || "+";
        btn.title = note ? `${DAYS[di]}: ${note}` : `Rate ${DAYS[di]}`;
        btn.addEventListener("click", () => openCell(gi, di));
        td.appendChild(btn);
        tr.appendChild(td);
      });

      const avg = goalAvg(goal);
      const avgTd = document.createElement("td");
      avgTd.className = "avg";
      avgTd.textContent = fmtAvg(avg);
      tr.appendChild(avgTd);

      const actTd = document.createElement("td");
      actTd.innerHTML = `<div class="goalrow-actions">
        <button class="iconbtn" data-act="done" title="${goal.done ? "Mark not done" : "Mark achieved"}">${goal.done ? "↺" : "✓"}</button>
        <button class="iconbtn" data-act="up" title="Move up">↑</button>
        <button class="iconbtn" data-act="del" title="Delete goal">✕</button></div>`;
      actTd.addEventListener("click", (e) => {
        const act = e.target.dataset.act;
        if (!act) return;
        const w = getWeek(currentKey, true);
        if (act === "done") goal.done = !goal.done;
        if (act === "up" && gi > 0) [w.goals[gi - 1], w.goals[gi]] = [w.goals[gi], w.goals[gi - 1]];
        if (act === "del") {
          if (!confirm(`Delete goal "${goal.title}" and its ratings?`)) return;
          w.goals.splice(gi, 1);
          pruneWeek(currentKey);
        }
        save(); render();
      });
      tr.appendChild(actTd);
      grid.appendChild(tr);
    });
  }

  // daily notes
  const notes = $("#dailyNotes");
  notes.innerHTML = "";
  const start = fromKey(currentKey);
  DAYS.forEach((d, i) => {
    const row = document.createElement("div");
    row.className = "dayrow" + (i === tIdx ? " today" : "");
    const id = `daynote-${i}`;
    row.innerHTML = `<label for="${id}">${d} ${addDays(start, i).getDate()}</label>`;
    const ta = document.createElement("textarea");
    ta.id = id;
    ta.rows = 1;
    ta.placeholder = i === tIdx ? "How did today go?" : "";
    ta.value = week.days?.[i] || "";
    ta.addEventListener("input", () => {
      const w = getWeek(currentKey, true);
      w.days[i] = ta.value;
      pruneWeek(currentKey);
      save();
    });
    row.appendChild(ta);
    notes.appendChild(row);
  });

  $("#reflection").value = week.reflection || "";

  const done = week.goals.filter((g) => g.done).length;
  const avg = weekAvg(week);
  $("#weekSummary").textContent = week.goals.length
    ? `${done}/${week.goals.length} goals achieved · average rating ${fmtAvg(avg)}`
    : "";
}

// ---------- cell dialog ----------
let editing = null; // { gi, di, rating }
const dialog = $("#cellDialog");

function openCell(gi, di) {
  const goal = getWeek(currentKey).goals[gi];
  editing = { gi, di, rating: goal.ratings?.[di] || 0 };
  $("#cellTitle").textContent = goal.title;
  $("#cellSub").textContent = fmt(addDays(fromKey(currentKey), di), { weekday: "long", month: "long", day: "numeric" });
  $("#cellNote").value = goal.notes?.[di] || "";
  renderRatingButtons();
  dialog.showModal();
}
function renderRatingButtons() {
  const wrap = $("#ratingButtons");
  wrap.innerHTML = "";
  const labels = ["", "Poor", "Weak", "OK", "Good", "Great"];
  for (let r = 1; r <= 5; r++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = r;
    b.title = labels[r];
    if (editing.rating === r) b.className = `selected r${r}`;
    b.addEventListener("click", () => { editing.rating = editing.rating === r ? 0 : r; renderRatingButtons(); });
    wrap.appendChild(b);
  }
}
$("#clearCell").addEventListener("click", () => {
  editing.rating = 0;
  $("#cellNote").value = "";
  renderRatingButtons();
});
$("#cellForm").addEventListener("submit", (e) => {
  if (e.submitter?.value === "save" && editing) {
    const goal = getWeek(currentKey, true).goals[editing.gi];
    goal.ratings ||= {};
    goal.notes ||= {};
    if (editing.rating) goal.ratings[editing.di] = editing.rating;
    else delete goal.ratings[editing.di];
    const note = $("#cellNote").value.trim();
    if (note) goal.notes[editing.di] = note;
    else delete goal.notes[editing.di];
    save();
    render();
  }
  editing = null;
});

// ---------- history view ----------
function renderHistory() {
  const list = $("#historyList");
  list.innerHTML = "";
  const keys = Object.keys(state.weeks).sort().reverse();
  if (!keys.length) {
    list.innerHTML = `<p class="empty">No weeks recorded yet. Add some goals on the "This week" tab.</p>`;
    return;
  }
  keys.forEach((key) => {
    const week = state.weeks[key];
    const avg = weekAvg(week);
    const done = week.goals.filter((g) => g.done).length;
    const card = document.createElement("article");
    card.className = "weekcard";
    card.innerHTML = `
      <header>
        <div><h3>${weekRangeLabel(key)}</h3>
        <span class="muted">${done}/${week.goals.length} goals achieved</span></div>
        <div class="score" title="Average rating">${fmtAvg(avg)}</div>
      </header>`;
    const ul = document.createElement("ul");
    week.goals.forEach((g) => {
      const li = document.createElement("li");
      const nm = document.createElement("span");
      nm.className = "name";
      nm.textContent = (g.done ? "✓ " : "") + g.title;
      const dots = document.createElement("span");
      dots.className = "dots";
      DAYS.forEach((d, i) => {
        const r = g.ratings?.[i];
        const dot = document.createElement("span");
        dot.className = "dot " + ratingClass(r);
        dot.title = `${d}: ${r || "not rated"}`;
        dots.appendChild(dot);
      });
      const a = document.createElement("span");
      a.className = "avg";
      a.textContent = fmtAvg(goalAvg(g));
      li.append(nm, dots, a);
      ul.appendChild(li);
    });
    card.appendChild(ul);
    if (week.reflection) {
      const p = document.createElement("p");
      p.className = "refl";
      p.textContent = week.reflection;
      card.appendChild(p);
    }
    card.addEventListener("click", () => { currentKey = key; setView("week"); });
    list.appendChild(card);
  });
}

// ---------- wiring ----------
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => setView(t.dataset.view)));
$("#prevWeek").addEventListener("click", () => { currentKey = toKey(addDays(fromKey(currentKey), -7)); render(); });
$("#nextWeek").addEventListener("click", () => { currentKey = toKey(addDays(fromKey(currentKey), 7)); render(); });
$("#todayBtn").addEventListener("click", () => { currentKey = toKey(mondayOf(new Date())); render(); });

$("#addGoalForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = $("#goalInput").value.trim();
  if (!title) return;
  getWeek(currentKey, true).goals.push({ id: uid(), title, done: false, ratings: {}, notes: {} });
  $("#goalInput").value = "";
  save(); render();
});

$("#copyLastWeek").addEventListener("click", () => {
  const prev = state.weeks[toKey(addDays(fromKey(currentKey), -7))];
  if (!prev) return;
  const w = getWeek(currentKey, true);
  prev.goals.filter((g) => !g.done).forEach((g) =>
    w.goals.push({ id: uid(), title: g.title, done: false, ratings: {}, notes: {} }));
  if (!w.goals.length) prev.goals.forEach((g) =>
    w.goals.push({ id: uid(), title: g.title, done: false, ratings: {}, notes: {} }));
  save(); render();
});

$("#reflection").addEventListener("input", (e) => {
  const w = getWeek(currentKey, true);
  w.reflection = e.target.value;
  pruneWeek(currentKey);
  save();
});

$("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `weekly-goals-${toKey(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$("#importInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || typeof data.weeks !== "object") throw new Error("Missing 'weeks'");
    if (!confirm("Replace all current data with this backup?")) return;
    state = data;
    save(); render();
  } catch (err) {
    alert("Could not import file: " + err.message);
  } finally {
    e.target.value = "";
  }
});

render();
