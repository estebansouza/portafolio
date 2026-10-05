// Capa de datos: Supabase si hay config, localStorage (demo) si no.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;

const DEFAULT_SETTINGS = {
  business_name: "Automotora Demo",
  whatsapp: "5491100000000",
  tna: 60,
};

// Fotos reales de Wikimedia Commons (licencias libres); autores en img/CREDITS.md.
const SAMPLE = [
  { brand: "Toyota", model: "Corolla XEi", year: 2021, km: 42000, price: 24500000, currency: "ARS", fuel: "nafta", transmission: "automática", status: "disponible", description: "Único dueño, service oficial al día.", photos: ["img/corolla.jpg"], photo_credit: "Foto: MercurySable99, CC BY-SA 4.0, Wikimedia Commons" },
  { brand: "Volkswagen", model: "Amarok V6", year: 2022, km: 28000, price: 48000, currency: "USD", fuel: "diesel", transmission: "automática", status: "disponible", description: "Extreme 4Motion, cuero, techo corredizo.", photos: ["img/amarok.jpg"], photo_credit: "Foto: RL GNZLZ, CC BY-SA 2.0, Wikimedia Commons" },
  { brand: "Ford", model: "Ranger XLS", year: 2019, km: 90000, price: 31000000, currency: "ARS", fuel: "diesel", transmission: "manual", status: "reservado", description: "4x2, excelente estado.", photos: ["img/ranger.jpg"], photo_credit: "Foto: Ethan Llamas, CC BY-SA 4.0, Wikimedia Commons" },
  { brand: "Fiat", model: "Cronos Precision", year: 2023, km: 12000, price: 17800000, currency: "ARS", fuel: "nafta", transmission: "manual", status: "disponible", description: "Como nuevo, 1.3 GSE, un solo dueño.", photos: ["img/cronos.jpg"], photo_credit: "Foto: Just a Man, CC BY 4.0, Wikimedia Commons" },
];

// ---------- Demo (localStorage) ----------
// v2: invalida la demo guardada con las fotos de relleno anteriores.
const LS = { cars: "auto_demo_vehicles_v2", settings: "auto_demo_settings", session: "auto_demo_session" };
const read = (k, fallback) => {
  try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage bloqueado */ } };

function demoCars() {
  let cars = read(LS.cars, null);
  if (!cars) {
    cars = SAMPLE.map((c, i) => ({ ...c, id: String(i + 1), created_at: new Date(Date.now() - i * 864e5).toISOString() }));
    write(LS.cars, cars);
  }
  return cars;
}

// ---------- Supabase ----------
let sbPromise;
function sb() {
  sbPromise ||= import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
    .then((m) => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  return sbPromise;
}
const must = ({ data, error }) => { if (error) throw error; return data; };

// ---------- API ----------
export async function listVehicles({ includeSold = false } = {}) {
  if (isDemo) {
    return demoCars().filter((c) => includeSold || c.status !== "vendido")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  let q = (await sb()).from("vehicles").select("*").order("created_at", { ascending: false });
  if (!includeSold) q = q.neq("status", "vendido");
  return must(await q);
}

export async function getVehicle(id) {
  if (isDemo) return demoCars().find((c) => c.id === id) || null;
  return must(await (await sb()).from("vehicles").select("*").eq("id", id).maybeSingle());
}

export async function saveVehicle(v) {
  if (isDemo) {
    const cars = demoCars();
    if (v.id) {
      const i = cars.findIndex((c) => c.id === v.id);
      if (i >= 0) cars[i] = { ...cars[i], ...v };
    } else {
      cars.unshift({ ...v, id: String(Date.now()), created_at: new Date().toISOString() });
    }
    write(LS.cars, cars);
    return;
  }
  const { id, created_at, ...fields } = v;
  const table = (await sb()).from("vehicles");
  must(id ? await table.update(fields).eq("id", id) : await table.insert(fields));
}

export async function deleteVehicle(id) {
  if (isDemo) return write(LS.cars, demoCars().filter((c) => c.id !== id));
  must(await (await sb()).from("vehicles").delete().eq("id", id));
}

export async function getSettings() {
  if (isDemo) return { ...DEFAULT_SETTINGS, ...read(LS.settings, {}) };
  const row = must(await (await sb()).from("settings").select("*").eq("id", 1).maybeSingle());
  return { ...DEFAULT_SETTINGS, ...(row || {}) };
}

export async function saveSettings(s) {
  if (isDemo) return write(LS.settings, s);
  must(await (await sb()).from("settings").upsert({ id: 1, ...s }));
}

export async function uploadPhoto(file) {
  if (isDemo) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  const client = await sb();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  must(await client.storage.from("vehicle-photos").upload(path, file, { contentType: file.type }));
  return client.storage.from("vehicle-photos").getPublicUrl(path).data.publicUrl;
}

// ---------- Auth ----------
export async function isLoggedIn() {
  if (isDemo) return read(LS.session, false) === true;
  return !!must(await (await sb()).auth.getSession()).session;
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
