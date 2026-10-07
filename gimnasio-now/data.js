// Capa de datos: Supabase si hay config, localStorage (demo) si no.
import { SUPABASE_URL, SUPABASE_ANON_KEY, GYM, DEFAULT_PLANS } from "./config.js";
import { todayStr, addDays } from "./membership.js";

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// ---------- Demo (localStorage) ----------
const LS = { plans: "gym_demo_plans_v1", members: "gym_demo_members_v1", payments: "gym_demo_payments_v1", checkins: "gym_demo_checkins_v1", session: "gym_demo_session" };
const read = (k, fallback) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage bloqueado */ } };
const newId = () => crypto.randomUUID();

// Socios de muestra con vencimientos repartidos para que el panel se vea con vida.
function seedDemo() {
  const today = todayStr(new Date(), GYM.tz);
  const plans = DEFAULT_PLANS.map((p) => ({ ...p, id: newId(), active: true }));
  const [libre, caminadora] = plans;
  const sample = [
    ["Martín Rodríguez", "4.123.456-7", "099 111 222", libre, 18],
    ["Lucía Fernández", "3.987.654-3", "098 333 444", caminadora, 22],
    ["Santiago Pereira", "5.222.111-0", "091 555 666", libre, 4],
    ["Camila Silva", "4.555.888-2", "094 777 888", caminadora, 1],
    ["Diego Acosta", "3.456.789-1", "092 999 000", libre, -3],
    ["Valentina Núñez", "5.010.203-4", "099 222 333", caminadora, -12],
    ["Federico Méndez", "4.789.012-5", "097 444 555", libre, 25],
    ["Sofía Techera", "5.300.400-6", "098 666 777", caminadora, 6],
  ];
  const members = [], payments = [], checkins = [];
  sample.forEach(([name, document, phone, plan, left], i) => {
    const m = { id: newId(), name, document, phone, plan_id: plan.id, expires_on: addDays(today, left), notes: "", active: true, created_at: new Date(Date.now() - (60 - i * 5) * 864e5).toISOString() };
    members.push(m);
    // Pagos recientes (últimos días) para que "ingresos del mes" tenga datos en la demo.
    const paidOn = addDays(m.expires_on, -plan.days);
    payments.push({ id: newId(), member_id: m.id, plan_id: plan.id, plan_name: plan.name, amount: plan.price, method: i % 2 ? "transferencia" : "efectivo", paid_on: addDays(today, -(i % 4)), covers_from: paidOn, expires_on: m.expires_on, created_at: new Date(Date.now() - i * 36e5).toISOString() });
    if (left >= -3 && i % 2 === 0) checkins.push({ id: newId(), member_id: m.id, created_at: new Date(Date.now() - i * 36e5).toISOString() });
  });
  write(LS.plans, plans); write(LS.members, members); write(LS.payments, payments); write(LS.checkins, checkins);
}
function demo(key) {
  if (!localStorage.getItem(LS.plans)) seedDemo();
  return read(LS[key], []);
}

// ---------- Supabase ----------
let sbPromise;
function sb() {
  sbPromise ||= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
    .then((m) => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return sbPromise;
}
const must = ({ data, error }) => { if (error) throw error; return data; };
const strip = ({ id, created_at, ...fields }) => fields;

// ---------- Planes ----------
export async function listPlans({ includeInactive = false } = {}) {
  if (isDemo) return demo("plans").filter((p) => includeInactive || p.active).sort((a, b) => a.price - b.price);
  let q = (await sb()).from("plans").select("*").order("price");
  if (!includeInactive) q = q.eq("active", true);
  return must(await q);
}

export async function savePlan(p) {
  if (isDemo) {
    const all = demo("plans");
    const i = all.findIndex((x) => x.id === p.id);
    if (i >= 0) all[i] = { ...all[i], ...p }; else all.push({ ...p, id: newId() });
    return write(LS.plans, all);
  }
  const table = (await sb()).from("plans");
  must(p.id ? await table.update(strip(p)).eq("id", p.id) : await table.insert(strip(p)));
}

// ---------- Socios ----------
export async function listMembers() {
  if (isDemo) return demo("members").sort((a, b) => a.name.localeCompare(b.name, "es"));
  return must(await (await sb()).from("members").select("*").order("name"));
}

export async function saveMember(m) {
  if (isDemo) {
    const all = demo("members");
    const i = all.findIndex((x) => x.id === m.id);
    if (i >= 0) all[i] = { ...all[i], ...m };
    else all.push({ ...m, id: newId(), created_at: new Date().toISOString() });
    return write(LS.members, all);
  }
  const table = (await sb()).from("members");
  must(m.id ? await table.update(strip(m)).eq("id", m.id) : await table.insert(strip(m)));
}

// ---------- Pagos ----------
// Registra el pago y actualiza el vencimiento del socio en una sola transacción (rpc register_payment).
export async function registerPayment({ member, plan, amount, method, paidOn, coversFrom, expiresOn }) {
  if (isDemo) {
    const payment = { id: newId(), member_id: member.id, plan_id: plan.id, plan_name: plan.name, amount, method, paid_on: paidOn, covers_from: coversFrom, expires_on: expiresOn, created_at: new Date().toISOString() };
    write(LS.payments, [...demo("payments"), payment]);
    write(LS.members, demo("members").map((m) => (m.id === member.id ? { ...m, plan_id: plan.id, expires_on: expiresOn, active: true } : m)));
    return payment;
  }
  return must(await (await sb()).rpc("register_payment", {
    p_member: member.id, p_plan: plan.id, p_amount: amount, p_method: method,
    p_paid_on: paidOn, p_covers_from: coversFrom, p_expires_on: expiresOn,
  }));
}

export async function listPayments({ since = null, limit = 500 } = {}) {
  if (isDemo) {
    return demo("payments").filter((p) => !since || p.paid_on >= since)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
  }
  let q = (await sb()).from("payments").select("*").order("created_at", { ascending: false }).limit(limit);
  if (since) q = q.gte("paid_on", since);
  return must(await q);
}

// ---------- Asistencias ----------
export async function checkIn(memberId) {
  if (isDemo) {
    return write(LS.checkins, [...demo("checkins"), { id: newId(), member_id: memberId, created_at: new Date().toISOString() }]);
  }
  must(await (await sb()).from("checkins").insert({ member_id: memberId }));
}

// since: ISO string (inicio del día, etc.)
export async function listCheckins(since) {
  if (isDemo) return demo("checkins").filter((c) => c.created_at >= since).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return must(await (await sb()).from("checkins").select("*").gte("created_at", since).order("created_at", { ascending: false }));
}

// ---------- Auth ----------
export async function isLoggedIn() {
  if (isDemo) return read(LS.session, false) === true;
  return !!must(await (await sb()).auth.getSession()).session;
}

// Tener cuenta no alcanza: hay que figurar en public.staff (RLS devolvería listas vacías sin avisar).
export async function isStaff() {
  if (isDemo) return true;
  const client = await sb();
  const { session } = must(await client.auth.getSession());
  if (!session) return false;
  return !!must(await client.from("staff").select("user_id").eq("user_id", session.user.id).maybeSingle());
}

export async function login(email, password) {
  if (isDemo) {
    if (email === "admin" && password === "admin") return write(LS.session, true);
    throw new Error("En modo demo el usuario es admin / admin");
  }
  must(await (await sb()).auth.signInWithPassword({ email, password }));
}

export async function logout() {
  if (isDemo) return write(LS.session, false);
  await (await sb()).auth.signOut();
}
