// Página pública "Armá tu rutina": el socio elige objetivo, género y días, y ve su semana.
import { GYM } from "./config.js";
import { generateRoutine, GOALS, GENDERS, DAY_OPTIONS, MUSCLE_LABEL } from "./routines.js";
import { whatsappLink } from "./membership.js";
import { h, $ } from "./ui.js";

const DEFAULTS = { goal: "hipertrofia", gender: "neutro", days: 4 };
const WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// La elección vive en el hash (#goal=fuerza&gender=mujer&days=5) para poder compartir el link.
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const goal = p.get("goal"), gender = p.get("gender"), days = Number(p.get("days"));
  return {
    goal: GOALS[goal] ? goal : DEFAULTS.goal,
    gender: GENDERS[gender] ? gender : DEFAULTS.gender,
    days: DAY_OPTIONS.includes(days) ? days : DEFAULTS.days,
  };
}
const state = readHash();

function choice(name, legend, options, current, onPick) {
  return h("fieldset", { class: "choice" },
    h("legend", {}, legend),
    h("div", { class: "pills" }, options.map(([value, label, hint]) => {
      const id = `${name}-${value}`;
      return h("div", { class: "pill" },
        h("input", { type: "radio", name, id, value, checked: String(current) === String(value), onchange: () => onPick(value) }),
        h("label", { for: id }, h("span", {}, label), hint ? h("small", {}, hint) : null));
    })));
}

function weekStrip(routine) {
  const byDay = new Map(routine.sessions.map((s) => [s.day, s]));
  return h("div", { class: "week", role: "list", "aria-label": "Tu semana" }, WEEK.map((d) => {
    const s = byDay.get(d);
    return h("div", { class: `week-day${s ? " on" : ""}`, role: "listitem" },
      h("b", {}, d.slice(0, 3)),
      h("span", {}, s ? s.muscles.map((m) => MUSCLE_LABEL[m]).join(" · ") : "Descanso"));
  }));
}

function sessionCard(s, i) {
  return h("article", { class: "card session" },
    h("div", { class: "session-head" },
      h("div", {}, h("small", { class: "muted" }, `Día ${i + 1} · ${s.day}`), h("h3", {}, s.name)),
      h("div", { class: "chips" }, s.muscles.map((m) => h("span", { class: "chip" }, MUSCLE_LABEL[m])))),
    h("p", { class: "muted small" }, s.warmup),
    h("div", { class: "table-wrap" }, h("table", {},
      h("thead", {}, h("tr", {}, h("th", {}, "Ejercicio"), h("th", {}, "Series × reps"), h("th", { class: "hide-sm" }, "Descanso"))),
      h("tbody", {}, s.exercises.map((e) => h("tr", {},
        h("td", {}, e.name, h("div", { class: "muted small" }, MUSCLE_LABEL[e.muscle])),
        h("td", {}, `${e.sets} × ${e.reps}`),
        h("td", { class: "hide-sm" }, e.rest)))))),
    s.cardio ? h("p", { class: "small" }, s.cardio) : null);
}

function render() {
  history.replaceState(null, "", `#goal=${state.goal}&gender=${state.gender}&days=${state.days}`);
  const r = generateRoutine(state);
  const msg = `Hola, armé mi rutina en la web (${GOALS[state.goal].label}, ${state.days} días por semana). ¿Me ayudan a ajustarla?`;

  $("#result").replaceChildren(...[
    h("h2", {}, `Tu rutina: ${GOALS[state.goal].label}, ${state.days} días`),
    weekStrip(r),
    r.restDays.length ? h("p", { class: "muted small" }, `Descanso: ${r.restDays.join(", ")}. El gimnasio cierra los domingos.`) : null,
    h("div", { class: "sessions" }, r.sessions.map(sessionCard)),
    h("div", { class: "panel" }, h("h2", {}, "Consejos"), h("ul", {}, r.notes.map((n) => h("li", {}, n)))),
    h("div", { class: "actions no-print" },
      h("button", { class: "btn", type: "button", onclick: () => window.print() }, "Imprimir o guardar en PDF"),
      h("a", { class: "btn wa", href: whatsappLink(GYM.whatsapp, msg), target: "_blank", rel: "noopener" }, "Consultar con un instructor")),
    h("p", { class: "muted small" }, r.disclaimer),
  ].filter(Boolean));
}

function pick(key) {
  return (value) => { state[key] = key === "days" ? Number(value) : value; render(); };
}

$("#root").replaceChildren(
  h("section", { class: "hero" },
    h("h1", {}, "Armá tu rutina"),
    h("p", { class: "muted" }, "Elegí tu objetivo y cuántos días vas a venir por semana. Te mostramos qué músculo trabajar cada día y con qué ejercicios.")),
  h("form", { class: "panel no-print", onsubmit: (e) => e.preventDefault() },
    choice("goal", "¿Cuál es tu objetivo?", Object.entries(GOALS).map(([v, g]) => [v, g.label, g.hint]), state.goal, pick("goal")),
    choice("days", "¿Cuántos días por semana venís?", DAY_OPTIONS.map((d) => [d, `${d} días`]), state.days, pick("days")),
    choice("gender", "Género (ajusta el énfasis de la rutina)", Object.entries(GENDERS), state.gender, pick("gender"))),
  h("section", { id: "result", "aria-live": "polite" }));

render();
