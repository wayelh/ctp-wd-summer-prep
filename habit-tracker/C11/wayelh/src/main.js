import './style.css';

const LS_KEY = "habit-tracker:data";
const load = () => JSON.parse(localStorage.getItem(LS_KEY) || "[]");
const save = (data) => localStorage.setItem(LS_KEY, JSON.stringify(data));

const fmt = (d) => d.toISOString().slice(0, 10);
const todayStr = () => fmt(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

let habits = load(); // [{ id, name, targetFrequency, targetCount?, createdAt, entries: Record<date,bool> }]

function streaks(entries) {
  const days = Object.keys(entries).filter((d) => entries[d]).sort();
  if (!days.length) return { current: 0, longest: 0 };
  const set = new Set(days);
  let longest = 0;

  for (const d of days) {
    const prev = fmt(addDays(new Date(d), -1));
    if (!set.has(prev)) {
      let len = 1, cur = d;
      while (set.has(fmt(addDays(new Date(cur), 1)))) { cur = fmt(addDays(new Date(cur), 1)); len++; }
      if (len > longest) longest = len;
    }
  }
  let current = 0, cursor = new Date();
  while (set.has(fmt(cursor))) { current++; cursor = addDays(cursor, -1); }
  return { current, longest };
}

const form = document.getElementById("new-habit-form");
const nameInput = document.getElementById("habit-name");
const freqSelect = document.getElementById("habit-frequency");
const targetInput = document.getElementById("habit-target");
const list = document.getElementById("habits");
const cardTpl = document.getElementById("habit-card-template");

freqSelect.addEventListener("change", () => {
  targetInput.style.display = freqSelect.value === "custom" ? "inline-block" : "none";
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) return;
  const frequency = freqSelect.value;
  const targetCount = frequency === "custom" ? Math.max(1, Number(targetInput.value || 1)) : undefined;

  habits.push({
    id: crypto.randomUUID(),
    name,
    targetFrequency: frequency,
    targetCount,
    createdAt: todayStr(),
    entries: {}
  });
  save(habits);
  form.reset();
  targetInput.style.display = "none";
  render();
});

function toggleDate(habitId, dateStr) {
  const h = habits.find((x) => x.id === habitId);
  if (!h) return;
  h.entries[dateStr] = !h.entries[dateStr];
  save(habits);
  render();
}

function editHabit(habitId) {
  const h = habits.find((x) => x.id === habitId);
  if (!h) return;
  const next = prompt("Update habit name:", h.name);
  if (next && next.trim()) {
    h.name = next.trim();
    save(habits);
    render();
  }
}

function deleteHabit(habitId) {
  habits = habits.filter((x) => x.id !== habitId);
  save(habits);
  render();
}

function renderCalendar(container, habit) {
  container.innerHTML = "";
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay(); // 0=Sun ... 6=Sat
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // optional: weekday headers
  const weekdays = ["S","M","T","W","T","F","S"];
  weekdays.forEach(w => {
    const h = document.createElement("div");
    h.className = "cell";
    h.textContent = w;
    h.style.opacity = "0.6";
    h.style.borderStyle = "dashed";
    container.appendChild(h);
  });

  // leading blanks
  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement("div");
    blank.className = "cell";
    blank.style.visibility = "hidden";
    container.appendChild(blank);
  }

  // days 1..N
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = d.toISOString().slice(0,10);
    const done = !!habit.entries[key];

    const cell = document.createElement("button");
    cell.className = "cell" + (done ? " done" : "") + (key === todayStr() ? " today" : "");
    cell.setAttribute("aria-pressed", String(done));
    cell.title = key;
    cell.textContent = String(day);
    cell.addEventListener("click", () => toggleDate(habit.id, key));
    container.appendChild(cell);
  }
}

function freqLabel(h) {
  return h.targetFrequency === "custom" ? `Custom: ${h.targetCount}/week`
    : h.targetFrequency[0].toUpperCase() + h.targetFrequency.slice(1);
}

function render() {
  list.innerHTML = "";
  if (!habits.length) {
    const p = document.createElement("p");
    p.textContent = "No habits yet—add one above.";
    list.appendChild(p);
    return;
  }
  for (const h of habits) {
    const node = cardTpl.content.cloneNode(true);
    node.querySelector(".habit-title").textContent = h.name;

    const { current, longest } = streaks(h.entries);
    node.querySelector(".freq").textContent = freqLabel(h);
    node.querySelector(".streak").textContent = `Current: ${current}🔥`;
    node.querySelector(".longest").textContent = `Longest: ${longest}🏆`;

    renderCalendar(node.querySelector(".calendar"), h);
    node.querySelector("[data-edit]").addEventListener("click", () => editHabit(h.id));
    node.querySelector("[data-delete]").addEventListener("click", () => deleteHabit(h.id));

    list.appendChild(node);
  }
}

render();
