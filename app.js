firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const USER_ID = "mae";

let medicines = [];
let log = [];

const $ = (id) => document.getElementById(id);

async function save() {
  await db.collection("usuarios").doc(USER_ID).set({
    medicines,
    log,
    updatedAt: new Date().toISOString()
  });
}

function todayKey() {
  return toDateKey(new Date());
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dateFromKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function monthsDiff(start, current) {
  return (current.getFullYear() - start.getFullYear()) * 12 + (current.getMonth() - start.getMonth());
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function normalizeTimes(text) {
  return text
    .split(",")
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => {
      const match = t.match(/^(\d{1,2}):?(\d{2})?$/);
      if (!match) return t;
      const hh = String(match[1]).padStart(2, "0");
      const mm = String(match[2] || "00").padStart(2, "0");
      return `${hh}:${mm}`;
    });
}

function frequencyLabel(med) {
  if (med.frequencyType === "daily") return "Diário";
  if (med.frequencyType === "custom_days") return `A cada ${med.intervalDays || 1} dia(s)`;
  if (med.frequencyType === "weekly") return "Semanal";
  if (med.frequencyType === "biweekly") return "Quinzenal";
  if (med.frequencyType === "monthly") return "Mensal";
  if (med.frequencyType === "once") return "Somente uma vez";
  return "Diário";
}

function isMedicineDueOn(med, dateKey) {
  const startKey = med.startDate || todayKey();
  const start = dateFromKey(startKey);
  const current = dateFromKey(dateKey);

  if (current < start) return false;

  const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
  const type = med.frequencyType || "daily";

  if (type === "daily") return true;
  if (type === "custom_days") return diffDays % Number(med.intervalDays || 1) === 0;
  if (type === "weekly") return diffDays % 7 === 0;
  if (type === "biweekly") return diffDays % 15 === 0;
  if (type === "once") return diffDays === 0;

  if (type === "monthly") {
    const mdiff = monthsDiff(start, current);
    return mdiff >= 0 && current.getDate() === start.getDate();
  }

  return true;
}

function getNextDoseDate(med, fromKey = todayKey()) {
  const from = dateFromKey(fromKey);
  for (let i = 0; i <= 370; i++) {
    const key = toDateKey(addDays(from, i));
    if (isMedicineDueOn(med, key)) return key;
  }
  return null;
}

function getLog(date, medicineId, time) {
  return log.find(x => x.date === date && x.medicineId === medicineId && x.time === time);
}

async function setTaken(medicineId, time, note) {
  const date = todayKey();
  const existing = getLog(date, medicineId, time);
  if (existing) {
    existing.taken = true;
    existing.note = note || existing.note || "";
    existing.takenAt = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } else {
    log.push({
      date,
      medicineId,
      time,
      taken: true,
      note: note || "",
      takenAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    });
  }
  await save();
  render();
}

async function undoTaken(medicineId, time) {
  const date = todayKey();
  log = log.filter(x => !(x.date === date && x.medicineId === medicineId && x.time === time));
  await save();
  render();
}

function renderToday() {
  const container = $("todayList");
  const date = todayKey();

  const tasks = medicines
    .filter(med => isMedicineDueOn(med, date))
    .flatMap(med => med.times.map(time => ({ med, time })))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (!tasks.length) {
    container.innerHTML = `<p>Nenhum remédio para hoje.</p>`;
    return;
  }

  container.innerHTML = tasks.map(({med, time}) => {
    const record = getLog(date, med.id, time);
    const done = record?.taken;
    const nextDate = getNextDoseDate(med, toDateKey(addDays(new Date(), 1)));
    return `
      <div class="item">
        <h3>${time} — ${escapeHtml(med.name)}</h3>
        <p class="meta"><strong>Instrução:</strong> ${escapeHtml(med.dose || "Sem instrução cadastrada")}</p>
        <p class="meta"><strong>Frequência:</strong> ${frequencyLabel(med)}</p>
        ${nextDate ? `<span class="status next">Próxima dose: ${formatDate(nextDate)}</span>` : ""}
        ${med.obs ? `<p class="meta"><strong>Obs. fixa:</strong> ${escapeHtml(med.obs)}</p>` : ""}
        <br>
        <span class="status ${done ? "done" : "pending"}">${done ? "Tomado" : "Pendente"}</span>
        ${done ? `<p class="meta">Marcado às ${record.takenAt || ""}${record.note ? " — " + escapeHtml(record.note) : ""}</p>` : ""}
        <div class="obs-row">
          <input id="note-${med.id}-${time.replace(':','')}" placeholder="Observação de hoje, se precisar">
          ${done
            ? `<button class="warn" onclick="undoTaken('${med.id}', '${time}')">Desmarcar</button>`
            : `<button class="ok" onclick="setTaken('${med.id}', '${time}', document.getElementById('note-${med.id}-${time.replace(':','')}').value)">Tomei</button>`
          }
        </div>
      </div>
    `;
  }).join("");
}

function renderCalendar() {
  const container = $("calendarList");
  const today = new Date();

  let html = "";
  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const key = toDateKey(date);
    const due = medicines.filter(med => isMedicineDueOn(med, key));

    html += `
      <div class="day ${i === 0 ? "today" : ""}">
        <h3>${i === 0 ? "Hoje" : formatDateShort(key)}</h3>
        ${due.length ? due.map(med => `
          <span class="pill">${escapeHtml(med.name)} — ${med.times.join(", ")}</span>
        `).join("") : `<p class="meta">Sem remédio</p>`}
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderMedicines() {
  const container = $("medicineList");
  if (!medicines.length) {
    container.innerHTML = `<p>Nenhum remédio cadastrado.</p>`;
    return;
  }

  container.innerHTML = medicines.map(med => {
    const nextDate = getNextDoseDate(med);
    return `
      <div class="item">
        <h3>${escapeHtml(med.name)}</h3>
        <p class="meta"><strong>Horários:</strong> ${med.times.join(", ")}</p>
        <p class="meta"><strong>Instrução:</strong> ${escapeHtml(med.dose || "Sem instrução")}</p>
        <p class="meta"><strong>Frequência:</strong> ${frequencyLabel(med)}</p>
        <p class="meta"><strong>Data inicial:</strong> ${formatDate(med.startDate || todayKey())}</p>
        ${nextDate ? `<span class="status next">Próxima dose: ${formatDate(nextDate)}</span>` : ""}
        ${med.obs ? `<p class="meta"><strong>Observação:</strong> ${escapeHtml(med.obs)}</p>` : ""}
        <br>
        <button class="danger" onclick="deleteMedicine('${med.id}')">Excluir</button>
      </div>
    `;
  }).join("");
}

function renderHistory() {
  const container = $("historyList");
  if (!log.length) {
    container.innerHTML = `<p>Nenhum registro ainda.</p>`;
    return;
  }

  const sorted = [...log].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  container.innerHTML = sorted.map(item => {
    const med = medicines.find(m => m.id === item.medicineId);
    return `
      <div class="item">
        <h3>${formatDate(item.date)} — ${item.time}</h3>
        <p class="meta"><strong>Remédio:</strong> ${escapeHtml(med?.name || "Remédio removido")}</p>
        <p class="meta"><strong>Status:</strong> ${item.taken ? "Tomado" : "Pendente"} ${item.takenAt ? "às " + item.takenAt : ""}</p>
        ${item.note ? `<p class="meta"><strong>Obs.:</strong> ${escapeHtml(item.note)}</p>` : ""}
      </div>
    `;
  }).join("");
}

function render() {
  renderToday();
  renderCalendar();
  renderMedicines();
  renderHistory();
}

async function deleteMedicine(id) {
  if (!confirm("Excluir este remédio?")) return;
  medicines = medicines.filter(m => m.id !== id);
  await save();
  render();
}

function formatDate(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function formatDateShort(date) {
  const [y, m, d] = date.split("-");
  return `${d}/${m}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[s]));
}

$("frequencyType").addEventListener("change", () => {
  $("customDaysBox").classList.toggle("hidden", $("frequencyType").value !== "custom_days");
});

$("startDate").value = todayKey();

$("medicineForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("medName").value.trim();
  const dose = $("medDose").value.trim();
  const times = normalizeTimes($("medTimes").value);
  const obs = $("medObs").value.trim();
  const frequencyType = $("frequencyType").value;
  const intervalDays = frequencyType === "custom_days" ? Number($("customDays").value || 1) : null;
  const startDate = $("startDate").value || todayKey();

  if (!name || !times.length) {
    alert("Preencha o nome e pelo menos um horário.");
    return;
  }

  medicines.push({
    id: uid(),
    name,
    dose,
    times,
    obs,
    frequencyType,
    intervalDays,
    startDate
  });

  await save();
  e.target.reset();
  $("startDate").value = todayKey();
  $("customDaysBox").classList.add("hidden");
  render();
});

$("clearToday").addEventListener("click", async () => {
  if (!confirm("Limpar as marcações de hoje?")) return;
  const date = todayKey();
  log = log.filter(x => x.date !== date);
  await save();
  render();
});

$("clearHistory").addEventListener("click", async () => {
  if (!confirm("Apagar todo o histórico?")) return;
  log = [];
  await save();
  render();
});

$("exportCsv").addEventListener("click", () => {
  const rows = [["data", "horario", "remedio", "instrucao", "frequencia", "tomado", "marcado_as", "observacao"]];
  log.forEach(item => {
    const med = medicines.find(m => m.id === item.medicineId);
    rows.push([
      item.date,
      item.time,
      med?.name || "Remédio removido",
      med?.dose || "",
      med ? frequencyLabel(med) : "",
      item.taken ? "sim" : "nao",
      item.takenAt || "",
      item.note || ""
    ]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `historico-remedios-${todayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

$("enableNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("Este navegador não suporta notificações.");
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    alert("Lembretes ativados. Importante: neste protótipo simples, a página precisa ficar aberta para disparar os avisos.");
  } else {
    alert("As notificações não foram permitidas.");
  }
});

function notificationLoop() {
  const now = new Date();
  const current = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const date = todayKey();

  medicines
    .filter(med => isMedicineDueOn(med, date))
    .forEach(med => {
      med.times.forEach(time => {
        if (time !== current) return;
        const alreadyTaken = getLog(date, med.id, time)?.taken;
        const key = `notified-${date}-${med.id}-${time}`;
        if (alreadyTaken || sessionStorage.getItem(key)) return;

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(`Hora do remédio: ${med.name}`, {
            body: `${time} — ${med.dose || "Verifique a orientação cadastrada."}`,
            icon: "icon-192.png"
          });
        } else {
          alert(`Hora do remédio: ${med.name}\n${time} — ${med.dose || ""}`);
        }
        sessionStorage.setItem(key, "1");
      });
    });
}

setInterval(notificationLoop, 30000);

db.collection("usuarios").doc(USER_ID).onSnapshot((doc) => {
  if (doc.exists) {
    const data = doc.data();
    medicines = data.medicines || [];
    log = data.log || [];
  } else {
    medicines = [];
    log = [];
  }

  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").catch(() => {});
}
