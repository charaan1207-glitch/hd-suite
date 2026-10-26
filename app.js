/* HD Suite - web version of the Java Swing mini project (same rules as the Java code). */
"use strict";

// ------------------------------------------------------------------ helpers
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const r2 = v => Math.round(v * 100) / 100;
const money = v => "Rs. " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plain = v => v.toFixed(2);
const pad = (s, n) => String(s).padEnd(n).slice(0, Math.max(n, String(s).length));
const lpad = (s, n) => String(s).padStart(n);
class ValidationError extends Error {}

function store(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) || "null");
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) { return null; }
}

function toast(msg, isError) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.className = "toast"), 2800);
}

function modal(html) {
  $("#modalBox").innerHTML = html;
  $("#modal").classList.remove("hidden");
}
function closeModal() { $("#modal").classList.add("hidden"); }
$("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

// ------------------------------------------------------------------ validation (same as Validator.java)
const V = {
  text(raw, field, min) {
    const t = String(raw || "").trim().replace(/\s+/g, " ");
    if (!t) throw new ValidationError(field + " is required.");
    if (t.length < min) throw new ValidationError(field + " must be at least " + min + " characters long.");
    return t;
  },
  name(raw, field) {
    const n = V.text(raw, field, 2);
    if (n.length > 40) throw new ValidationError(field + " cannot be longer than 40 characters.");
    if (!/^[A-Za-z][A-Za-z .']*$/.test(n)) throw new ValidationError(field + " can contain only letters, spaces, dots and apostrophes.");
    return n;
  },
  int(raw, field, min, max) {
    const t = V.text(raw, field, 1);
    if (!/^-?\d+$/.test(t)) throw new ValidationError(field + ' must be a valid whole number (you entered "' + t + '").');
    const v = parseInt(t, 10);
    if (v < min || v > max) throw new ValidationError(field + " must be between " + min + " and " + max + ".");
    return v;
  },
  mobile(raw) {
    const m = V.text(raw, "Mobile number", 1);
    if (!/^[6-9]\d{9}$/.test(m)) throw new ValidationError("Mobile number must be exactly 10 digits and start with 6, 7, 8 or 9.");
    return m;
  },
  pin(raw) {
    const p = V.text(raw, "PIN code", 1);
    if (!/^[1-9]\d{5}$/.test(p)) throw new ValidationError("PIN code must be exactly 6 digits and cannot start with 0.");
    return p;
  }
};

const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dmy = s => { const [y, m, d] = s.split("-"); return d + "-" + m + "-" + y; };
const dayName = s => new Date(s + "T00:00").toLocaleDateString("en-US", { weekday: "short" });

// ================================================================== HD RAIL
const TRAINS = [
  ["12607", "Lalbagh Express", "Chennai Central", "KSR Bengaluru", "15:30", "21:40", 362],
  ["12608", "Lalbagh Express", "KSR Bengaluru", "Chennai Central", "06:30", "12:30", 362],
  ["12639", "Brindavan Express", "Chennai Central", "KSR Bengaluru", "07:50", "14:05", 362],
  ["12640", "Brindavan Express", "KSR Bengaluru", "Chennai Central", "15:00", "21:05", 362],
  ["12621", "Tamil Nadu Express", "Chennai Central", "New Delhi", "22:00", "06:30 (+2)", 2182],
  ["12622", "Tamil Nadu Express", "New Delhi", "Chennai Central", "22:30", "07:10 (+2)", 2182],
  ["12163", "Chennai Express", "Mumbai CSMT", "Chennai Central", "20:30", "19:40 (+1)", 1279],
  ["12164", "Chennai Express", "Chennai Central", "Mumbai CSMT", "06:50", "05:00 (+1)", 1279],
  ["12603", "Hyderabad Express", "Chennai Central", "Hyderabad", "16:45", "05:20 (+1)", 794],
  ["12604", "Hyderabad Express", "Hyderabad", "Chennai Central", "16:30", "05:00 (+1)", 794],
  ["12839", "Howrah Mail", "Howrah", "Chennai Central", "23:55", "04:00 (+2)", 1662],
  ["12840", "Howrah Mail", "Chennai Central", "Howrah", "19:00", "23:25 (+1)", 1662],
  ["12627", "Karnataka Express", "KSR Bengaluru", "New Delhi", "19:20", "10:40 (+2)", 2365],
  ["12628", "Karnataka Express", "New Delhi", "KSR Bengaluru", "20:20", "13:10 (+2)", 2365],
  ["12701", "Hussainsagar Express", "Mumbai CSMT", "Hyderabad", "21:50", "12:40 (+1)", 711],
  ["12702", "Hussainsagar Express", "Hyderabad", "Mumbai CSMT", "14:45", "05:25 (+1)", 711]
].map(([no, name, from, to, dep, arr, km]) => ({ no, name, from, to, dep, arr, km }));
const STATIONS = [...new Set(TRAINS.flatMap(t => [t.from, t.to]))].sort();

// One entry per travel class = the Ticket subclasses of the Java version
const BAY8 = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];
const CLASSES = {
  SL: { name: "Sleeper", rate: 0.60, resv: 20, gst: 0, cancel: 120, seats: 8, coach: "S1", meal: 150, bay: BAY8 },
  "3A": { name: "AC 3 Tier", rate: 1.50, resv: 40, gst: 5, cancel: 180, seats: 6, coach: "B1", meal: 150, bay: BAY8 },
  "2A": { name: "AC 2 Tier", rate: 2.20, resv: 50, gst: 5, cancel: 200, seats: 4, coach: "A1", meal: 200, bay: ["LB", "UB", "LB", "UB", "SL", "SU"] }
};
const BERTHS = { "No Preference": null, Lower: "LB", Middle: "MB", Upper: "UB", "Side Lower": "SL", "Side Upper": "SU" };
const MAX_WL = 5, ADVANCE_DAYS = 120, WL_CHARGE = 60, INSURANCE = 10;

const rail = store("hd.rail") || { bookings: [], nextPnr: 4521873601 };
const saveRail = () => store("hd.rail", rail);

function fare(t) {
  const c = CLASSES[t.cls], km = TRAINS.find(x => x.no === t.train).km;
  const base = r2(km * c.rate);
  const pct = t.age >= 60 ? 40 : t.age <= 11 ? 50 : 0;
  const concession = r2(base * pct / 100);
  const gst = r2((base - concession) * c.gst / 100);
  const addons = (t.meals ? c.meal : 0) + (t.insurance ? INSURANCE : 0);
  return { km, base, pct, concession, resv: c.resv, gst, addons, total: r2(base - concession + c.resv + gst + addons) };
}

function statusText(t) {
  if (!t.status) return "Not booked yet (fare enquiry)";
  if (t.status === "CNF") return "CNF " + CLASSES[t.cls].coach + "/" + t.seat + "/" + CLASSES[t.cls].bay[(t.seat - 1) % CLASSES[t.cls].bay.length];
  if (t.status === "WL") return "WL " + t.wl;
  return "CANCELLED";
}

function ticketText(t) {
  const tr = TRAINS.find(x => x.no === t.train), c = CLASSES[t.cls], f = fare(t);
  const L = "=".repeat(50), S = "-".repeat(50);
  const row = (k, v) => pad(k, 13) + ": " + v;
  const amt = (k, v) => pad(k, 33) + "Rs " + lpad(plain(v), 10);
  const out = [L, "         HD RAIL  -  E-TICKET (DEMO)", L,
    row("PNR No.", t.pnr || "(not booked yet)"), row("Train", tr.no + " - " + tr.name),
    row("From", tr.from + "  (dep " + tr.dep + ")"), row("To", tr.to + "  (arr " + tr.arr + ")"),
    row("Journey date", dmy(t.date) + " (" + dayName(t.date) + ")"), row("Class", c.name + " (" + t.cls + ")"), S,
    row("Passenger", t.name), row("Age / Gender", t.age + " / " + t.gender), row("Mobile", t.mobile),
    row("Berth pref.", t.berth), row("Status", statusText(t)), S,
    amt("Base fare (" + f.km + " km x " + c.rate.toFixed(2) + ")", f.base)];
  if (f.pct) out.push(amt("Concession (" + f.pct + "%, " + (t.age >= 60 ? "senior citizen" : "child") + ")", -f.concession));
  out.push(amt("Reservation charge", f.resv));
  if (f.gst > 0) out.push(amt("GST (" + c.gst + "%)", f.gst));
  if (t.meals) out.push(amt("Meals", c.meal));
  if (t.insurance) out.push(amt("Travel insurance", INSURANCE));
  out.push(S, amt("TOTAL FARE", f.total));
  if (t.status === "CAN") out.push(amt("Cancellation charge", -(f.total - t.refund)), amt("REFUND", t.refund));
  out.push(L);
  return out.join("\n");
}

const sameJourney = (a, train, cls, date) => a.train === train && a.cls === cls && a.date === date;
const countStatus = (train, cls, date, st) => rail.bookings.filter(b => b.status === st && sameJourney(b, train, cls, date)).length;

function pickSeat(t) {
  const c = CLASSES[t.cls], taken = new Set(rail.bookings.filter(b => b.status === "CNF" && sameJourney(b, t.train, t.cls, t.date)).map(b => b.seat));
  let want = BERTHS[t.berth];
  if (!want && t.age >= 60) want = "LB";
  for (let s = 1; want && s <= c.seats; s++) if (!taken.has(s) && c.bay[(s - 1) % c.bay.length] === want) return s;
  for (let s = 1; s <= c.seats; s++) if (!taken.has(s)) return s;
  return 0;
}

function book(t) {
  const dup = rail.bookings.find(b => b.status !== "CAN" && b.train === t.train && b.date === t.date &&
    b.name.toLowerCase() === t.name.toLowerCase() && b.mobile === t.mobile);
  if (dup) throw new ValidationError(t.name + " already has a booking on this train and date (PNR " + dup.pnr + ").");
  const seat = pickSeat(t);
  if (seat) { t.status = "CNF"; t.seat = seat; }
  else {
    const wl = countStatus(t.train, t.cls, t.date, "WL");
    if (wl >= MAX_WL) throw new ValidationError("REGRET: " + CLASSES[t.cls].name + " on train " + t.train + " is full and the waiting list is closed.");
    t.status = "WL"; t.wl = wl + 1;
  }
  t.pnr = String(rail.nextPnr++);
  rail.bookings.push(t);
  saveRail();
  return t;
}

function requireActive(pnrRaw) {
  const pnr = String(pnrRaw || "").trim();
  if (!pnr) throw new ValidationError("Please enter a PNR number.");
  if (!/^\d{10}$/.test(pnr)) throw new ValidationError("PNR number must be exactly 10 digits.");
  const t = rail.bookings.find(b => b.pnr === pnr);
  if (!t) throw new ValidationError("No booking found with PNR " + pnr + ".");
  if (t.status === "CAN") throw new ValidationError("PNR " + pnr + " is already cancelled.");
  return t;
}

function cancel(pnr) {
  const t = requireActive(pnr);
  const wasCnf = t.status === "CNF", seat = t.seat;
  const charge = wasCnf ? CLASSES[t.cls].cancel : WL_CHARGE;
  t.refund = r2(Math.max(0, fare(t).total - charge));
  t.status = "CAN"; t.seat = 0; t.wl = 0;
  const waiting = rail.bookings.filter(b => b.status === "WL" && sameJourney(b, t.train, t.cls, t.date)).sort((a, b) => a.wl - b.wl);
  if (wasCnf && waiting.length) { const w = waiting.shift(); w.status = "CNF"; w.seat = seat; w.wl = 0; }
  waiting.forEach((w, i) => (w.wl = i + 1));
  saveRail();
  return t;
}

function renderRail() {
  const tomorrow = iso(addDays(today(), 1));
  $("#app").innerHTML = `
  <p class="tag">// HD RAIL &middot; RAILWAY RESERVATION FORM</p>
  <h1 style="font-size:clamp(26px,5vw,38px)">Book a train ticket</h1>
  <div class="grid2">
    <section class="card">
      <h2>Passenger &amp; journey</h2>
      <div class="form2">
        <div class="field"><label for="rName">Passenger name</label><input id="rName" type="text" autocomplete="name"></div>
        <div class="field"><label for="rAge">Age (years)</label><input id="rAge" type="tel" inputmode="numeric" maxlength="3"></div>
      </div>
      <div class="field"><label>Gender</label><div class="choice" id="rGender">
        <label><input type="radio" name="g" value="Male">Male</label><label><input type="radio" name="g" value="Female">Female</label><label><input type="radio" name="g" value="Other">Other</label></div></div>
      <div class="field"><label for="rMobile">Mobile number</label><input id="rMobile" type="tel" inputmode="numeric" maxlength="10"></div>
      <div class="form2">
        <div class="field"><label for="rFrom">From</label><select id="rFrom">${STATIONS.map(s => `<option${s === "Chennai Central" ? " selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label for="rTo">To</label><select id="rTo">${STATIONS.map(s => `<option${s === "KSR Bengaluru" ? " selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label for="rTrain">Train</label><select id="rTrain"></select></div>
      <div class="form2">
        <div class="field"><label for="rClass">Class</label><select id="rClass">${Object.entries(CLASSES).map(([k, c]) => `<option value="${k}">${k} - ${c.name}</option>`).join("")}</select></div>
        <div class="field"><label for="rDate">Journey date</label><input id="rDate" type="date" value="${tomorrow}" min="${iso(today())}" max="${iso(addDays(today(), ADVANCE_DAYS))}"></div>
      </div>
      <div class="form2">
        <div class="field"><label for="rBerth">Berth preference</label><select id="rBerth">${Object.keys(BERTHS).map(b => `<option>${b}</option>`).join("")}</select></div>
        <div class="field"><label>Add-ons</label><div class="choice"><label><input type="checkbox" id="rMeals">Meals</label><label><input type="checkbox" id="rIns">Insurance (Rs 10)</label></div></div>
      </div>
      <p class="avail" id="rAvail"></p>
      <p class="error" id="rErr"></p>
      <div class="row"><button class="btn" id="rFare">Check Fare</button><button class="btn rail" id="rBook">Book Ticket</button><button class="btn ghost-red" id="rCancel">Cancel by PNR</button><button class="btn" id="rClear">Clear</button></div>
    </section>
    <section>
      <div class="journey" id="rJourney"></div>
      <pre class="ticket" id="rTicket"></pre>
    </section>
  </div>
  <section class="card" style="margin-top:16px"><h2>My bookings <small class="note">(tap one to see its ticket)</small></h2><div class="bookings" id="rList"></div></section>`;

  const digits = el => el.addEventListener("input", () => (el.value = el.value.replace(/\D/g, "")));
  digits($("#rAge")); digits($("#rMobile"));
  ["#rFrom", "#rTo"].forEach(s => $(s).addEventListener("change", refreshTrains));
  ["#rTrain", "#rClass", "#rDate"].forEach(s => $(s).addEventListener("change", refreshAvail));
  $("#rFare").onclick = () => withForm(t => { showTicket(t); toast("Fare: " + money(fare(t).total)); });
  $("#rBook").onclick = () => withForm(t => {
    const f = fare(t);
    if (!confirm("Book " + CLASSES[t.cls].name + " for " + t.name + " on " + dmy(t.date) + "?\nTotal fare: " + money(f.total))) return;
    book(t);
    showTicket(t); renderBookings(); refreshAvail(); clearPassenger();
    modal(`<div class="done"><div class="tick">&#10003;</div><h3>Booking successful</h3><p>PNR <b>${t.pnr}</b><br>Status <b class="status ${t.status}">${statusText(t)}</b><br>Fare paid <b>${money(f.total)}</b></p>
      ${t.status === "WL" ? '<p class="note">The class is full, so this ticket is on the waiting list. It is confirmed automatically if someone cancels.</p>' : ""}
      <button class="btn rail" onclick="closeModal()">OK</button></div>`);
  });
  $("#rCancel").onclick = () => cancelFlow("");
  $("#rClear").onclick = () => { clearPassenger(); $("#rTicket").textContent = welcome(); $("#rErr").textContent = ""; };
  refreshTrains();
  $("#rTicket").textContent = welcome();
  renderBookings();
}

function welcome() {
  return "\n  Welcome to HD Rail\n\n  1. Fill in the passenger and journey details.\n  2. Check Fare shows the full fare breakup.\n  3. Book Ticket gives you a PNR.\n  4. Cancel by PNR shows the refund.\n\n  Senior citizen (60+)  40% off base fare\n  Child (5-11 years)    50% off base fare\n\n  When a class is full, tickets go on the\n  waiting list and are confirmed when\n  someone cancels.\n";
}

function refreshTrains() {
  const from = $("#rFrom").value, to = $("#rTo").value;
  const list = from === to ? [] : TRAINS.filter(t => t.from === from && t.to === to);
  $("#rTrain").innerHTML = list.map(t => `<option value="${t.no}">${t.no} - ${t.name} (${t.dep})</option>`).join("") || "<option value=''>No direct train</option>";
  refreshAvail();
}

function refreshAvail() {
  const from = $("#rFrom").value, to = $("#rTo").value, no = $("#rTrain").value, cls = $("#rClass").value, date = $("#rDate").value;
  const el = $("#rAvail"), tr = TRAINS.find(t => t.no === no);
  if (from === to) { el.textContent = "From and To are the same"; el.style.color = "var(--red)"; }
  else if (!tr) { el.textContent = "No direct train on this route"; el.style.color = "var(--red)"; }
  else if (!date) { el.textContent = "Enter a valid journey date"; el.style.color = "var(--amber)"; }
  else {
    const free = CLASSES[cls].seats - countStatus(no, cls, date, "CNF");
    if (free > 0) { el.textContent = "AVAILABLE  " + free + " of " + CLASSES[cls].seats + " berths"; el.style.color = "var(--green)"; }
    else {
      const wl = countStatus(no, cls, date, "WL");
      el.textContent = wl >= MAX_WL ? "REGRET - waiting list full" : "FULL - next ticket gets WL " + (wl + 1);
      el.style.color = wl >= MAX_WL ? "var(--red)" : "var(--amber)";
    }
  }
  $("#rJourney").innerHTML = tr ? `
    <div><div class="time">${tr.dep}</div><div class="stn">${tr.from}</div></div>
    <div class="mid"><div class="ln"><img src="img/train.png" alt=""></div><b>${tr.no} ${tr.name}</b><small>${tr.km} km &middot; ${CLASSES[cls].name}${date ? " &middot; " + dmy(date) : ""}</small></div>
    <div style="text-align:right"><div class="time">${tr.arr.split(" ")[0]}</div><div class="stn">${tr.to}${tr.arr.includes("+") ? ' <span style="color:var(--amber)">' + tr.arr.split(" ")[1].replace(/[()]/g, "") + " day</span>" : ""}</div></div>`
    : `<div></div><div class="mid note">Choose two different stations with a direct train</div><div></div>`;
}

function readForm() {
  ["#rName", "#rAge", "#rMobile", "#rDate"].forEach(s => $(s).classList.remove("invalid"));
  const mark = (sel, fn) => { try { return fn(); } catch (e) { $(sel).classList.add("invalid"); $(sel).focus(); throw e; } };
  const name = mark("#rName", () => V.name($("#rName").value, "Passenger name"));
  const age = mark("#rAge", () => V.int($("#rAge").value, "Age", 1, 120));
  if (age < 5) { $("#rAge").classList.add("invalid"); throw new ValidationError("Children below 5 years travel free and do not need a reserved berth."); }
  const g = document.querySelector("input[name=g]:checked");
  if (!g) throw new ValidationError("Please select the passenger's gender.");
  const mobile = mark("#rMobile", () => V.mobile($("#rMobile").value));
  if ($("#rFrom").value === $("#rTo").value) throw new ValidationError("From and To stations cannot be the same.");
  const train = $("#rTrain").value;
  if (!train) throw new ValidationError("No direct train runs on this route. Please choose another route.");
  const date = $("#rDate").value;
  mark("#rDate", () => {
    if (!date) throw new ValidationError("Journey date is not a valid date.");
    const d = new Date(date + "T00:00");
    if (d < today()) throw new ValidationError("Journey date cannot be in the past.");
    if (d > addDays(today(), ADVANCE_DAYS)) throw new ValidationError("Bookings open only " + ADVANCE_DAYS + " days in advance.");
  });
  return { name, age, gender: g.value, mobile, train, cls: $("#rClass").value, date, berth: $("#rBerth").value,
    meals: $("#rMeals").checked, insurance: $("#rIns").checked };
}

function withForm(action) {
  try { $("#rErr").textContent = ""; action(readForm()); }
  catch (e) { if (!(e instanceof ValidationError)) throw e; $("#rErr").textContent = e.message; toast(e.message, true); }
}

function clearPassenger() {
  ["#rName", "#rAge", "#rMobile"].forEach(s => ($(s).value = ""));
  document.querySelectorAll("input[name=g]").forEach(r => (r.checked = false));
  $("#rBerth").selectedIndex = 0; $("#rMeals").checked = false; $("#rIns").checked = false;
}

function showTicket(t) { $("#rTicket").textContent = ticketText(t); }

function renderBookings() {
  const list = $("#rList");
  if (!rail.bookings.length) { list.innerHTML = '<p class="note">No bookings yet.</p>'; return; }
  list.innerHTML = rail.bookings.slice().reverse().map(b => `
    <div class="booking" data-pnr="${b.pnr}">
      <div><b>${esc(b.name)}</b> <span class="note">${b.age}</span><small>PNR ${b.pnr} &middot; ${b.train} &middot; ${b.cls} &middot; ${dmy(b.date)}</small></div>
      <div style="text-align:right"><span class="status ${b.status}">${statusText(b)}</span><small>${money(fare(b).total)}</small></div>
    </div>`).join("");
  list.querySelectorAll(".booking").forEach(el => el.onclick = () => {
    const b = rail.bookings.find(x => x.pnr === el.dataset.pnr);
    showTicket(b);
    if (b.status !== "CAN") cancelFlow(b.pnr, true);
    $("#rTicket").scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function cancelFlow(pnr, fromList) {
  modal(`<h3>${fromList ? "Ticket " + pnr : "Cancel a ticket"}</h3>
    <div class="field"><label for="cPnr">10-digit PNR number</label><input id="cPnr" type="tel" inputmode="numeric" maxlength="10" value="${pnr}"></div>
    <p class="error" id="cErr"></p>
    <div class="row"><button class="btn ghost-red" id="cGo">Cancel this ticket</button><button class="btn" onclick="closeModal()">Close</button></div>`);
  $("#cGo").onclick = () => {
    try {
      const t = requireActive($("#cPnr").value);
      const charge = t.status === "CNF" ? CLASSES[t.cls].cancel : WL_CHARGE;
      if (!confirm("Cancel PNR " + t.pnr + " for " + t.name + "?\nCancellation charge: " + money(charge))) return;
      cancel(t.pnr);
      showTicket(t); renderBookings(); refreshAvail();
      modal(`<div class="done"><h3>Ticket cancelled</h3><p>PNR ${t.pnr}<br>Refund <b>${money(t.refund)}</b></p><button class="btn rail" onclick="closeModal()">OK</button></div>`);
    } catch (e) { if (!(e instanceof ValidationError)) throw e; $("#cErr").textContent = e.message; }
  };
}

// ================================================================== HD CART
const PRODUCTS = [
  ["E101", "Wireless Earbuds", "Electronics", 1499, 15, 2999, 4.3, 12840, "Bestseller", "Brand: SoundMax · Warranty: 12 months"],
  ["E102", "Android Smartphone 128GB", "Electronics", 12999, 5, 15999, 4.4, 8650, "New", "Brand: Nova · Warranty: 12 months"],
  ["E103", "Power Bank 10000mAh", "Electronics", 899, 20, 1499, 4.2, 23110, null, "Brand: VoltGo · Warranty: 6 months"],
  ["E104", "Smart Watch", "Electronics", 2499, 8, 4999, 4.1, 5420, "Deal", "Brand: FitPulse · Warranty: 12 months"],
  ["C201", "Cotton T-Shirt", "Clothing", 499, 30, 799, 4.0, 3210, null, "Sizes: S, M, L, XL, XXL · 100% cotton"],
  ["C202", "Slim Fit Jeans", "Clothing", 1299, 12, 1999, 4.2, 1980, null, "Sizes: 28 - 36 · Denim"],
  ["C203", "Winter Hoodie", "Clothing", 1799, 6, 2499, 4.5, 960, "Winter pick", "Sizes: M, L, XL · Fleece"],
  ["B301", "Java: The Complete Reference", "Books", 899, 10, 1099, 4.6, 4120, "Bestseller", "Author: Herbert Schildt · Paperback"],
  ["B302", "Head First Java", "Books", 749, 7, 899, 4.7, 2870, null, "Authors: Kathy Sierra & Bert Bates · Paperback"],
  ["B303", "Clean Code", "Books", 649, 4, 799, 4.7, 6530, null, "Author: Robert C. Martin · Paperback"],
  ["G401", "Basmati Rice", "Grocery", 549, 25, 649, 4.3, 15400, null, "Pack size: 5 kg"],
  ["G402", "Green Tea (100 bags)", "Grocery", 299, 18, 399, 4.2, 7800, null, "Pack size: 100 bags"],
  ["G403", "California Almonds", "Grocery", 449, 3, 599, 4.4, 3300, null, "Pack size: 500 g"]
].map(([id, name, cat, price, stock, mrp, rating, reviews, badge, info]) => ({ id, name, cat, price, stock, mrp, rating, reviews, badge, info }));

// Category tax rules = the Product subclasses of the Java version
const taxPercent = p => p.cat === "Electronics" ? 18 : p.cat === "Clothing" ? (p.price <= 1000 ? 5 : 12) : p.cat === "Books" ? 0 : 5;
const COUPONS = [
  { code: "SAVE10", desc: "10% off (max Rs 500)", min: 0, off: s => r2(Math.min(s * 0.10, 500)) },
  { code: "FLAT200", desc: "Rs 200 off on orders of Rs 1,500 or more", min: 1500, off: s => Math.min(200, s) },
  { code: "FEST20", desc: "20% off on orders of Rs 3,000 or more (max Rs 1,000)", min: 3000, off: s => r2(Math.min(s * 0.20, 1000)) }
];
const FREE_DELIVERY = 999, DELIVERY = 49, GIFT = 50, COD = 40, MAX_ADD = 10;

const shop = store("hd.shop") || { stock: {}, cart: [], coupon: null, gift: false, pay: "UPI", nextOrder: 1001, orders: 0 };
PRODUCTS.forEach(p => { if (shop.stock[p.id] !== undefined) p.stock = shop.stock[p.id]; });
const saveShop = () => { PRODUCTS.forEach(p => (shop.stock[p.id] = p.stock)); store("hd.shop", shop); };
const prod = id => PRODUCTS.find(p => p.id === id);
let shopView = { cat: "All", q: "", sort: 0 };

const line = it => { const p = prod(it.id), sub = r2(p.price * it.qty), tax = r2(sub * taxPercent(p) / 100); return { p, sub, tax, total: r2(sub + tax) }; };
const totals = () => {
  const subtotal = r2(shop.cart.reduce((s, it) => s + line(it).sub, 0));
  const tax = r2(shop.cart.reduce((s, it) => s + line(it).tax, 0));
  const c = COUPONS.find(x => x.code === shop.coupon);
  const discount = c && subtotal >= c.min ? c.off(subtotal) : 0;
  const empty = !shop.cart.length;
  const delivery = empty || subtotal >= FREE_DELIVERY ? 0 : DELIVERY;
  const other = empty ? 0 : (shop.gift ? GIFT : 0) + (shop.pay === "Cash on Delivery" ? COD : 0);
  return { subtotal, tax, discount, delivery, other, grand: r2(subtotal + tax - discount + delivery + other), qty: shop.cart.reduce((s, it) => s + it.qty, 0) };
};

function addToCart(id, qty) {
  const p = prod(id);
  if (qty < 1 || qty > MAX_ADD) throw new ValidationError("Quantity must be between 1 and " + MAX_ADD + ".");
  if (p.stock === 0) throw new ValidationError(p.name + " is out of stock.");
  const it = shop.cart.find(x => x.id === id), already = it ? it.qty : 0;
  if (already + qty > p.stock) throw new ValidationError("Only " + p.stock + " unit(s) of " + p.name + " are in stock" + (already ? " and you already have " + already + " in your cart." : "."));
  if (it) it.qty += qty; else shop.cart.push({ id, qty });
  saveShop();
}

function setQty(id, qty) {
  const it = shop.cart.find(x => x.id === id), p = prod(id);
  if (qty < 1) throw new ValidationError("Quantity must be at least 1. Use Remove to take it out of the cart.");
  if (qty > p.stock) throw new ValidationError("Only " + p.stock + " unit(s) of " + p.name + " are in stock.");
  it.qty = qty; saveShop();
}

function applyCoupon(raw) {
  if (!shop.cart.length) throw new ValidationError("Add some items to your cart before applying a coupon.");
  const code = String(raw || "").trim().toUpperCase();
  if (!code) throw new ValidationError("Please enter a coupon code.");
  const c = COUPONS.find(x => x.code === code);
  if (!c) throw new ValidationError('Coupon "' + code + '" is not valid. Try SAVE10, FLAT200 or FEST20.');
  if (totals().subtotal < c.min) throw new ValidationError("Coupon " + c.code + " needs a minimum order of " + money(c.min) + ".");
  shop.coupon = c.code; saveShop();
}

const starsHtml = r => { const full = Math.round(r); return "&#9733;".repeat(full) + "<span>" + "&#9733;".repeat(5 - full) + "</span>"; };

function renderCart() {
  $("#app").innerHTML = `
  <p class="tag">// HD CART &middot; ONLINE SHOPPING CART SIMULATION</p>
  <h1 style="font-size:clamp(26px,5vw,38px)">Shop</h1>
  <div class="shopbar"><input type="text" id="sQ" placeholder="Search products..." value="${esc(shopView.q)}">
    <select id="sSort">${["Relevance", "Price: Low to High", "Price: High to Low", "Customer Rating", "Biggest Discount"].map((o, i) => `<option value="${i}"${i == shopView.sort ? " selected" : ""}>${o}</option>`).join("")}</select></div>
  <div class="chips">${["All", "Electronics", "Clothing", "Books", "Grocery"].map(c => `<button class="chip${c === shopView.cat ? " on" : ""}" data-cat="${c}">${c}</button>`).join("")}</div>
  <div class="products" id="sGrid"></div>
  <div class="cartbar"><button class="btn cart" style="width:100%" id="sBar"></button></div>`;
  $("#sQ").addEventListener("input", e => { shopView.q = e.target.value; renderGrid(); });
  $("#sSort").addEventListener("change", e => { shopView.sort = +e.target.value; renderGrid(); });
  document.querySelectorAll(".chip").forEach(b => b.onclick = () => { shopView.cat = b.dataset.cat; document.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === b)); renderGrid(); });
  $("#sBar").onclick = openDrawer;
  renderGrid(); updateBadge();
}

function renderGrid() {
  const q = shopView.q.trim().toLowerCase();
  let list = PRODUCTS.filter(p => (shopView.cat === "All" || p.cat === shopView.cat) && p.name.toLowerCase().includes(q));
  const off = p => Math.round((p.mrp - p.price) * 100 / p.mrp);
  const sorts = [null, (a, b) => a.price - b.price, (a, b) => b.price - a.price, (a, b) => b.rating - a.rating, (a, b) => off(b) - off(a)];
  if (sorts[shopView.sort]) list = list.slice().sort(sorts[shopView.sort]);
  $("#sGrid").innerHTML = list.length ? list.map(p => `
    <div class="pcard">
      <img class="pic" src="img/product-${p.id}.png" alt="${esc(p.name)}" data-id="${p.id}">
      ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}<span class="off">-${off(p)}%</span>
      <span class="cat">${p.cat.toUpperCase()}</span>
      <span class="name">${esc(p.name)}</span>
      <span class="stars">${starsHtml(p.rating)} <span>${p.rating} (${p.reviews.toLocaleString("en-US")})</span></span>
      <span class="price">${money(p.price)}<s>${money(p.mrp)}</s></span>
      <span class="stock ${p.stock === 0 ? "out" : p.stock <= 5 ? "low" : "ok"}">${p.stock === 0 ? "Out of stock" : p.stock <= 5 ? "Hurry, only " + p.stock + " left!" : "In stock · " + (taxPercent(p) ? "+" + taxPercent(p) + "% tax" : "no tax")}</span>
      <div class="add"><select data-q="${p.id}"${p.stock ? "" : " disabled"}>${Array.from({ length: Math.max(1, Math.min(MAX_ADD, p.stock)) }, (_, i) => `<option>${i + 1}</option>`).join("")}</select>
        <button class="btn cart" data-add="${p.id}"${p.stock ? "" : " disabled"}>${p.stock ? "Add to Cart" : "Sold out"}</button></div>
    </div>`).join("") : '<p class="note">No products found. Try another word or category.</p>';
  document.querySelectorAll("[data-add]").forEach(b => b.onclick = () => {
    try {
      const qty = +document.querySelector(`[data-q="${b.dataset.add}"]`).value;
      addToCart(b.dataset.add, qty); updateBadge();
      toast("Added " + qty + " x " + prod(b.dataset.add).name + " to your cart");
    } catch (e) { if (!(e instanceof ValidationError)) throw e; toast(e.message, true); }
  });
  document.querySelectorAll(".pic").forEach(img => img.onclick = () => {
    const p = prod(img.dataset.id);
    modal(`<div style="display:grid;grid-template-columns:140px 1fr;gap:14px;align-items:start"><img src="img/product-${p.id}.png" style="width:140px;border-radius:12px" alt="">
      <div><h3>${esc(p.name)}</h3><div class="stars">${starsHtml(p.rating)} <span>${p.rating} out of 5 (${p.reviews.toLocaleString("en-US")} ratings)</span></div>
      <p>${money(p.price)} <s class="note">${money(p.mrp)}</s> &middot; tax ${taxPercent(p)}%<br>${esc(p.info)}<br>In stock: ${p.stock}</p></div></div>
      <button class="btn" onclick="closeModal()">Close</button>`);
  });
}

function updateBadge() {
  const t = totals();
  $("#cartCount").textContent = t.qty;
  const bar = $("#sBar");
  if (bar) bar.textContent = "View cart (" + t.qty + ")  ·  " + money(t.grand);
}

function openDrawer() {
  closeDrawer();
  const d = document.createElement("div");
  d.className = "drawer"; d.id = "drawer";
  d.innerHTML = '<div class="drawer-box" id="drawerBox"></div>';
  d.addEventListener("click", e => { if (e.target === d) closeDrawer(); });
  document.body.appendChild(d);
  renderDrawer();
}
function closeDrawer() { const d = $("#drawer"); if (d) d.remove(); }

function renderDrawer() {
  const box = $("#drawerBox"); if (!box) return;
  const t = totals(), c = COUPONS.find(x => x.code === shop.coupon);
  const progress = Math.min(100, t.subtotal / FREE_DELIVERY * 100);
  box.innerHTML = `
    <div class="drawer-head"><h2 style="margin:0">Your Cart (${t.qty})</h2><button class="btn" id="dClose">Close</button></div>
    <div class="drawer-items">${shop.cart.length ? shop.cart.map(it => { const l = line(it); return `
      <div class="citem"><img src="img/product-${it.id}.png" alt="">
        <div><b>${esc(l.p.name)}</b><small>${money(l.p.price)} each</small>
          <div class="step"><button data-m="${it.id}"${it.qty > 1 ? "" : " disabled"}>-</button><b style="min-width:22px;text-align:center">${it.qty}</b><button data-p="${it.id}">+</button></div></div>
        <div style="text-align:right"><b>${money(l.sub)}</b><br><button class="linkbtn" data-r="${it.id}">Remove</button></div></div>`; }).join("")
      : '<div class="empty"><img src="img/cart.png" alt=""><p><b>Your cart is empty</b><br>Add items from the shop to get started.</p></div>'}</div>
    <div class="drawer-foot">
      <small style="color:${t.qty === 0 ? "var(--muted)" : t.subtotal >= FREE_DELIVERY ? "var(--green)" : "var(--amber)"}">${t.qty === 0 ? "Free delivery on orders of Rs. 999 and above" : t.subtotal >= FREE_DELIVERY ? "Yay! Your order gets FREE delivery" : "Add " + money(FREE_DELIVERY - t.subtotal) + " more for FREE delivery"}</small>
      <div class="bar"><i style="width:${progress}%"></i></div>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="dCoupon" placeholder="Coupon code" value="${shop.coupon || ""}"><button class="btn" id="dApply">Apply</button></div>
      <small class="note">${c ? (t.discount > 0 ? c.code + " applied: " + c.desc : c.code + " needs an order of " + money(c.min)) : "Try SAVE10, FLAT200 or FEST20"}</small>
      <div class="choice" style="padding:0"><label><input type="checkbox" id="dGift"${shop.gift ? " checked" : ""}>Gift wrap (+Rs 50)</label></div>
      <div class="choice" style="padding:0">${["UPI", "Debit / Credit Card", "Cash on Delivery"].map(m => `<label><input type="radio" name="pay" value="${m}"${shop.pay === m ? " checked" : ""}>${m === "Cash on Delivery" ? "COD (+Rs 40)" : m === "UPI" ? "UPI" : "Card"}</label>`).join("")}</div>
      <div class="sum"><span>Subtotal</span><b>${money(t.subtotal)}</b><span>Tax</span><b>${money(t.tax)}</b>
        <span>Coupon discount</span><b style="color:${t.discount ? "var(--green)" : ""}">${t.discount ? "- " + money(t.discount) : money(0)}</b>
        <span>Delivery</span><b>${t.qty && !t.delivery ? "FREE" : money(t.delivery)}</b><span>Gift wrap / COD</span><b>${money(t.other)}</b>
        <span class="total">Total</span><b class="total">${money(t.grand)}</b></div>
      <button class="btn cart" id="dCheckout"${shop.cart.length ? "" : " disabled"}>${shop.cart.length ? "Proceed to Checkout" : "Cart is empty"}</button>
    </div>`;
  $("#dClose").onclick = closeDrawer;
  const guard = fn => { try { fn(); } catch (e) { if (!(e instanceof ValidationError)) throw e; toast(e.message, true); } renderDrawer(); updateBadge(); };
  box.querySelectorAll("[data-p]").forEach(b => b.onclick = () => guard(() => setQty(b.dataset.p, shop.cart.find(x => x.id === b.dataset.p).qty + 1)));
  box.querySelectorAll("[data-m]").forEach(b => b.onclick = () => guard(() => setQty(b.dataset.m, shop.cart.find(x => x.id === b.dataset.m).qty - 1)));
  box.querySelectorAll("[data-r]").forEach(b => b.onclick = () => guard(() => { shop.cart = shop.cart.filter(x => x.id !== b.dataset.r); if (!shop.cart.length) shop.coupon = null; saveShop(); }));
  $("#dApply").onclick = () => guard(() => { applyCoupon($("#dCoupon").value); toast("Coupon applied - you save " + money(totals().discount)); });
  $("#dGift").onchange = e => guard(() => { shop.gift = e.target.checked; saveShop(); });
  box.querySelectorAll("input[name=pay]").forEach(r => r.onchange = () => guard(() => { shop.pay = r.value; saveShop(); }));
  $("#dCheckout").onclick = checkout;
}

function checkout() {
  const t = totals();
  closeDrawer();
  modal(`<p class="tag">CART &gt; <b style="color:var(--cart)">DELIVERY</b> &gt; PAYMENT &gt; DONE</p><h3>Where should we deliver?</h3>
    <div class="field"><label for="kName">Full name</label><input id="kName" type="text" autocomplete="name"></div>
    <div class="field"><label for="kMobile">Mobile number (10 digits)</label><input id="kMobile" type="tel" inputmode="numeric" maxlength="10"></div>
    <div class="field"><label for="kAddr">Delivery address</label><textarea id="kAddr" rows="2"></textarea></div>
    <div class="field"><label for="kPin">PIN code</label><input id="kPin" type="tel" inputmode="numeric" maxlength="6"></div>
    <p class="error" id="kErr"></p>
    <div class="row"><button class="btn green" id="kPay">${shop.pay === "Cash on Delivery" ? "Place Order" : "Pay"} ${money(t.grand)}</button><button class="btn" id="kBack">Back to Cart</button></div>`);
  ["#kMobile", "#kPin"].forEach(s => $(s).addEventListener("input", e => (e.target.value = e.target.value.replace(/\D/g, ""))));
  $("#kBack").onclick = () => { closeModal(); openDrawer(); };
  $("#kPay").onclick = () => {
    const fields = { "#kName": () => V.name($("#kName").value, "Full name"), "#kMobile": () => V.mobile($("#kMobile").value),
      "#kAddr": () => V.text($("#kAddr").value, "Delivery address", 10), "#kPin": () => V.pin($("#kPin").value) };
    const vals = {};
    for (const [sel, fn] of Object.entries(fields)) {
      $(sel).classList.remove("invalid");
      try { vals[sel] = fn(); } catch (e) { $(sel).classList.add("invalid"); $(sel).focus(); $("#kErr").textContent = e.message; return; }
    }
    for (const it of shop.cart) if (it.qty > prod(it.id).stock) { $("#kErr").textContent = "Only " + prod(it.id).stock + " unit(s) of " + prod(it.id).name + " are left."; return; }
    modal(`<div class="done"><p class="tag">PAYMENT</p><div class="spinner"></div><h3>${shop.pay === "Cash on Delivery" ? "Confirming your Cash on Delivery order..." : "Processing " + shop.pay + " payment of " + money(t.grand) + "..."}</h3><p class="note">Please do not close this window</p></div>`);
    setTimeout(() => placeOrder(vals["#kName"], vals["#kMobile"], vals["#kAddr"], vals["#kPin"]), 1600);
  };
}

function placeOrder(name, mobile, addr, pin) {
  const t = totals(), id = "OD" + shop.nextOrder, L = "=".repeat(50), S = "-".repeat(50);
  const amt = (k, v) => pad(k, 35) + "Rs " + lpad(plain(v), 10);
  const out = [L, "            HD CART  -  ORDER RECEIPT", L, "Order ID   : " + id, "Date       : " + new Date().toLocaleString("en-GB"),
    "Customer   : " + name, "Mobile     : " + mobile, "Deliver to : " + addr + " - " + pin, "Payment    : " + shop.pay, S,
    pad("Item", 24) + " " + lpad("Qty", 4) + " " + lpad("Price", 9) + " " + lpad("Total", 10)];
  shop.cart.forEach(it => { const l = line(it), n = l.p.name.length > 24 ? l.p.name.slice(0, 21) + "..." : l.p.name;
    out.push(pad(n, 24) + " " + lpad(it.qty, 4) + " " + lpad(plain(l.p.price), 9) + " " + lpad(plain(l.sub), 10)); });
  out.push(S, amt("Subtotal", t.subtotal), amt("Tax", t.tax));
  if (t.discount) out.push(amt("Discount (" + shop.coupon + ")", -t.discount));
  out.push(amt("Delivery", t.delivery));
  if (t.other) out.push(amt("Gift wrap / COD charges", t.other));
  out.push(S, amt("GRAND TOTAL", t.grand), L);
  const arrive = addDays(today(), 3).toLocaleDateString("en-US", { weekday: "long", day: "2-digit", month: "short" });
  out.push("Expected delivery: " + arrive, "        Thank you for shopping with us!");
  shop.cart.forEach(it => (prod(it.id).stock -= it.qty));
  shop.cart = []; shop.coupon = null; shop.gift = false; shop.pay = "UPI"; shop.nextOrder++; shop.orders++;
  saveShop(); updateBadge();
  modal(`<div class="done"><div class="tick">&#10003;</div><h3 style="color:var(--green)">Order placed successfully!</h3><p class="note">Order ID ${id} &middot; arriving by ${arrive}</p>
    <pre class="ticket" style="text-align:left">${esc(out.join("\n"))}</pre><p><button class="btn cart" onclick="closeModal();renderGrid()">Continue Shopping</button></p></div>`);
}

// ================================================================== HOME + router
function renderHome() {
  $("#app").innerHTML = `
  <section class="hero">
    <div>
      <p class="tag">JAVA SWING / AWT &middot; MINI PROJECT &middot; CMR UNIVERSITY</p>
      <h1>HD Suite</h1>
      <p class="sub">Railway Reservation Form <span style="color:var(--cyan)">+</span> Online Shopping Cart Simulation &mdash; try both apps right here, on your phone or computer.</p>
      <div class="card team"><span class="tag">PRESENTED BY</span><div><b>Hemashree TN</b><code>25BBTCS093</code></div><div><b>Divya Reddy GN</b><code>25BBTCS067</code></div><span class="note">B Tech CSE &middot; 2nd Year &middot; CMR University</span></div>
    </div>
    <div class="hero-art"><img class="t" src="img/train.png" alt="Train"><img class="c" src="img/cart.png" alt="Cart"></div>
  </section>
  <div class="grid2">
    <a class="card module r" href="#/rail"><div class="head"><img src="img/train.png" alt=""><div><h2>HD Rail</h2><span class="note">Railway Reservation Form</span></div></div>
      <ul><li>Search trains between 6 cities</li><li>Fare breakup with concession and GST</li><li>Berth allotment and waiting list</li><li>Cancel by PNR with refund</li></ul>
      <span class="btn rail" style="text-align:center">Open HD Rail</span></a>
    <a class="card module c" href="#/cart"><div class="head"><img src="img/cart.png" alt="" style="width:70px"><div><h2>HD Cart</h2><span class="note">Online Shopping Cart Simulation</span></div></div>
      <ul><li>13 products with pictures and ratings</li><li>Category tax, coupons and delivery</li><li>Cart with quantity steppers</li><li>Checkout, payment and order receipt</li></ul>
      <span class="btn cart" style="text-align:center">Open HD Cart</span></a>
  </div>
  <section class="card downloads">
    <h2>Get the Java project</h2>
    <p class="note">The original is a Java Swing desktop application. It runs on a laptop or PC with Java installed: unzip, then double-click <b>run.bat</b> (or run <code>java -jar HDSuite.jar</code>).</p>
    <div class="row"><a class="btn rail" href="download/HDSuite-Share.zip" download>Download Java project (.zip)</a>
      <a class="btn" href="download/HD-Suite-Project-Report.pdf" target="_blank" rel="noopener">Project report (PDF)</a>
      <a class="btn" href="download/HD-Suite-Presentation.pptx" download>Presentation (PPT)</a></div>
    <p class="note" style="margin-top:10px">This web version follows the same rules as the Java code. All trains, prices and ratings are demo data; no real bookings, orders or payments are made.</p>
  </section>`;
}

function route() {
  const page = (location.hash.replace(/^#\/?/, "") || "home").split("?")[0];
  closeDrawer(); closeModal();
  document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("active", a.dataset.nav === page));
  $("#cartBtn").classList.toggle("hidden", page !== "cart");
  if (page === "rail") renderRail(); else if (page === "cart") renderCart(); else renderHome();
  window.scrollTo(0, 0);
}
$("#cartBtn").onclick = openDrawer;
window.addEventListener("hashchange", route);
route();
updateBadge();
