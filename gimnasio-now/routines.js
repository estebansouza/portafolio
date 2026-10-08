// Generador de rutinas (sin DOM ni red). Recomendación general según objetivo, género y días por semana.
// No reemplaza a un instructor: pensado para un gimnasio con barras, mancuernas, poleas y máquinas.

export const GOALS = {
  hipertrofia: { label: "Ganar músculo", hint: "Más volumen, 8 a 12 repeticiones" },
  "bajar-peso": { label: "Bajar de peso", hint: "Más repeticiones, poco descanso y caminadora" },
  fuerza: { label: "Ganar fuerza", hint: "Pocas repeticiones y descansos largos" },
  tonificar: { label: "Tonificar", hint: "Resistencia muscular y core" },
};
export const GENDERS = { mujer: "Mujer", hombre: "Hombre", neutro: "Prefiero no decir" };
export const DAY_OPTIONS = [3, 4, 5, 6];

export const MUSCLE_LABEL = {
  pecho: "Pecho", espalda: "Espalda", hombros: "Hombros", biceps: "Bíceps", triceps: "Tríceps",
  cuadriceps: "Cuádriceps", femorales: "Femorales", gluteos: "Glúteos", pantorrillas: "Pantorrillas", abdomen: "Abdomen",
};

// c = ejercicio compuesto (multiarticular); t = se mide en tiempo. Los compuestos van primero en cada músculo.
const LIB = {
  pecho: [
    { n: "Press de banca con barra", c: 1 }, { n: "Press inclinado con mancuernas", c: 1 }, { n: "Flexiones de brazos", c: 1 },
    { n: "Aperturas con mancuernas" }, { n: "Cruce de poleas" },
  ],
  espalda: [
    { n: "Jalón al pecho", c: 1 }, { n: "Remo con barra", c: 1 }, { n: "Remo en polea baja", c: 1 },
    { n: "Remo con mancuerna", c: 1 }, { n: "Pullover en polea" },
  ],
  hombros: [
    { n: "Press militar con mancuernas", c: 1 }, { n: "Press Arnold", c: 1 },
    { n: "Elevaciones laterales" }, { n: "Pájaros (vuelos posteriores)" }, { n: "Face pull en polea" },
  ],
  biceps: [{ n: "Curl con barra" }, { n: "Curl martillo" }, { n: "Curl alterno con mancuernas" }, { n: "Curl en polea" }],
  triceps: [{ n: "Extensión de tríceps en polea" }, { n: "Fondos en banco" }, { n: "Press francés" }, { n: "Patada de tríceps" }],
  cuadriceps: [
    { n: "Sentadilla con barra", c: 1 }, { n: "Prensa de piernas", c: 1 }, { n: "Zancadas caminando", c: 1 },
    { n: "Sentadilla goblet", c: 1 }, { n: "Extensión de cuádriceps" },
  ],
  femorales: [
    { n: "Peso muerto rumano", c: 1 }, { n: "Peso muerto con piernas rígidas", c: 1 },
    { n: "Curl femoral acostado" }, { n: "Curl femoral sentado" },
  ],
  gluteos: [
    { n: "Hip thrust", c: 1 }, { n: "Sentadilla sumo", c: 1 }, { n: "Estocadas búlgaras", c: 1 },
    { n: "Puente de glúteos", c: 1 }, { n: "Patada de glúteo en polea" }, { n: "Abducción en máquina" },
  ],
  pantorrillas: [{ n: "Elevación de talones de pie" }, { n: "Elevación de talones sentado" }],
  abdomen: [
    { n: "Plancha", t: 1 }, { n: "Crunch abdominal" }, { n: "Elevación de piernas" },
    { n: "Plancha lateral", t: 1 }, { n: "Bicicleta abdominal" },
  ],
};

// Series, repeticiones y descanso por objetivo.
const RX = {
  hipertrofia: { c: ["4", "8-10", "90 s"], i: ["3", "10-12", "60 s"] },
  "bajar-peso": { c: ["3", "12-15", "45 s"], i: ["3", "15", "30 s"] },
  fuerza: { c: ["5", "4-6", "2-3 min"], i: ["3", "8-10", "75 s"] },
  tonificar: { c: ["3", "12-15", "45 s"], i: ["3", "15-20", "30 s"] },
};
const TIMED = ["3", "30-45 s", "30 s"];

const CARDIO = {
  hipertrofia: "Opcional: 10 min de caminadora suave para cerrar.",
  "bajar-peso": "Caminadora: 20 a 25 min a paso rápido, alternando 1 min fuerte y 2 min suave.",
  fuerza: null,
  tonificar: "Caminadora: 10 a 15 min a paso firme.",
};
const NOTES = {
  hipertrofia: ["Elegí un peso con el que las últimas 2 repeticiones cuesten.", "Subí el peso o las repeticiones cuando una serie te resulte fácil."],
  "bajar-peso": ["Mantené el ritmo: descansos cortos para que el pulso no baje.", "Sumá caminatas de 30 min en los días de descanso."],
  fuerza: ["Calentá con series livianas antes de la serie pesada.", "Descansá lo indicado: la fuerza se gana con recuperación completa."],
  tonificar: ["Controlá el movimiento, sin balanceos.", "Combiná con caminatas en los días de descanso."],
};

// Cada sesión: nombre y lista [músculo, cantidad de ejercicios].
const S = (name, ...m) => ({ name, m });
const FULL = [
  S("Cuerpo completo A", ["cuadriceps", 1], ["gluteos", 1], ["pecho", 1], ["espalda", 1], ["abdomen", 1]),
  S("Cuerpo completo B", ["femorales", 1], ["gluteos", 1], ["espalda", 1], ["pecho", 1], ["biceps", 1]),
  S("Cuerpo completo C", ["cuadriceps", 1], ["femorales", 1], ["hombros", 1], ["espalda", 1], ["triceps", 1], ["abdomen", 1]),
];
const UPPER_LOWER = [
  S("Torso A", ["pecho", 2], ["espalda", 2], ["hombros", 1], ["biceps", 1], ["triceps", 1]),
  S("Piernas A", ["cuadriceps", 2], ["femorales", 1], ["gluteos", 1], ["pantorrillas", 1], ["abdomen", 1]),
  S("Torso B", ["espalda", 2], ["pecho", 1], ["hombros", 2], ["biceps", 1], ["triceps", 1]),
  S("Piernas B", ["gluteos", 2], ["femorales", 2], ["cuadriceps", 1], ["abdomen", 1], ["pantorrillas", 1]),
];
const FIVE_BASE = [
  S("Pecho y tríceps", ["pecho", 3], ["triceps", 2], ["abdomen", 1]),
  S("Espalda y bíceps", ["espalda", 3], ["biceps", 2]),
  S("Piernas", ["cuadriceps", 2], ["femorales", 2], ["gluteos", 1], ["pantorrillas", 1]),
  S("Hombros y abdomen", ["hombros", 3], ["abdomen", 2]),
];
const FIVE = {
  neutro: [...FIVE_BASE, S("Brazos y core", ["biceps", 2], ["triceps", 2], ["abdomen", 1])],
  hombre: [...FIVE_BASE, S("Pecho y espalda", ["pecho", 2], ["espalda", 2], ["biceps", 1], ["triceps", 1])],
  mujer: [
    S("Glúteos y piernas", ["gluteos", 3], ["cuadriceps", 2], ["femorales", 1]),
    S("Espalda y bíceps", ["espalda", 3], ["biceps", 1], ["abdomen", 1]),
    S("Pecho, hombros y tríceps", ["pecho", 2], ["hombros", 2], ["triceps", 1]),
    S("Glúteos y core", ["gluteos", 2], ["femorales", 2], ["abdomen", 2], ["pantorrillas", 1]),
    S("Piernas completas", ["cuadriceps", 2], ["femorales", 1], ["gluteos", 2], ["pantorrillas", 1]),
  ],
};
const PPL = [
  S("Empuje (pecho, hombros y tríceps)", ["pecho", 2], ["hombros", 2], ["triceps", 1]),
  S("Tirón (espalda y bíceps)", ["espalda", 3], ["biceps", 1], ["abdomen", 1]),
  S("Piernas", ["cuadriceps", 2], ["femorales", 1], ["gluteos", 1], ["pantorrillas", 1]),
];

const WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SCHEDULE = { 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4], 6: [0, 1, 2, 3, 4, 5] };

const MAX_PER_SESSION = 8;
// Énfasis por género: suma un ejercicio a estos músculos mientras la sesión no pase del máximo.
const BUMP = { hombre: ["pecho", "espalda", "hombros"], mujer: ["gluteos"], neutro: [] };

function baseSessions(days, gender) {
  if (days === 3) return FULL;
  if (days === 4) return UPPER_LOWER;
  if (days === 5) return FIVE[gender];
  return [...PPL, ...PPL];
}

export function generateRoutine({ goal, gender, days }) {
  if (!GOALS[goal]) throw new Error(`Objetivo inválido: ${goal}`);
  if (!GENDERS[gender]) throw new Error(`Género inválido: ${gender}`);
  if (!DAY_OPTIONS.includes(days)) throw new Error(`Días inválidos: ${days}`);

  const cursor = {}; // rota los ejercicios para que no se repitan entre días
  const rx = RX[goal];
  const sessions = baseSessions(days, gender).map((tpl, idx) => {
    const counts = tpl.m.map(([m, n]) => [m, n]);
    let total = counts.reduce((s, [, n]) => s + n, 0);
    for (const m of BUMP[gender]) {
      const entry = counts.find(([k]) => k === m);
      if (entry && entry[1] < 3 && total < MAX_PER_SESSION) { entry[1] += 1; total += 1; }
    }
    const exercises = [];
    for (const [muscle, n] of counts) {
      const lib = LIB[muscle];
      const start = cursor[muscle] || 0;
      const picks = Array.from({ length: Math.min(n, lib.length) }, (_, k) => lib[(start + k) % lib.length]);
      cursor[muscle] = start + n;
      picks.sort((a, b) => (b.c || 0) - (a.c || 0));
      for (const ex of picks) {
        const [sets, reps, rest] = ex.t ? TIMED : ex.c ? rx.c : rx.i;
        exercises.push({ name: ex.n, muscle, sets, reps, rest });
      }
    }
    return {
      day: WEEK[SCHEDULE[days][idx]],
      name: tpl.name,
      muscles: [...new Set(counts.map(([m]) => m))],
      warmup: "Calentamiento: 5 a 10 min de caminadora y movilidad articular.",
      exercises,
      cardio: CARDIO[goal],
    };
  });

  const trainDays = new Set(sessions.map((s) => s.day));
  return {
    goal, gender, days, sessions,
    restDays: WEEK.filter((d) => !trainDays.has(d)),
    notes: NOTES[goal],
    disclaimer: "Recomendación general, no reemplaza la indicación de un instructor ni de un profesional de la salud. Si tenés lesiones o alguna condición médica, consultá antes de empezar.",
  };
}
