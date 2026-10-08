import assert from "node:assert/strict";
import { generateRoutine, GOALS, GENDERS, DAY_OPTIONS, MUSCLE_LABEL } from "./routines.js";

const count = (r, muscle) => r.sessions.flatMap((s) => s.exercises).filter((e) => e.muscle === muscle).length;

// Todas las combinaciones son válidas
for (const goal of Object.keys(GOALS)) for (const gender of Object.keys(GENDERS)) for (const days of DAY_OPTIONS) {
  const r = generateRoutine({ goal, gender, days });
  const tag = `${goal}/${gender}/${days}`;
  assert.equal(r.sessions.length, days, `${tag}: cantidad de sesiones`);
  assert.equal(r.sessions.length + r.restDays.length, 6, `${tag}: días de gimnasio (lun a sáb)`);
  assert.ok(!r.sessions.some((s) => s.day === "Domingo"), `${tag}: el gimnasio cierra los domingos`);
  for (const s of r.sessions) {
    assert.ok(s.exercises.length >= 4 && s.exercises.length <= 8, `${tag} ${s.name}: ${s.exercises.length} ejercicios`);
    const names = s.exercises.map((e) => e.name);
    assert.equal(new Set(names).size, names.length, `${tag} ${s.name}: ejercicio repetido en el día`);
    for (const e of s.exercises) {
      assert.ok(MUSCLE_LABEL[e.muscle], `${tag}: músculo desconocido ${e.muscle}`);
      assert.ok(e.sets && e.reps && e.rest, `${tag}: falta prescripción en ${e.name}`);
      assert.ok(s.muscles.includes(e.muscle), `${tag}: ${e.name} no figura en los músculos del día`);
    }
  }
}

// Los días de 3 a 6 se reparten con descanso entre sesiones cuando se puede
assert.deepEqual(generateRoutine({ goal: "fuerza", gender: "neutro", days: 3 }).sessions.map((s) => s.day), ["Lunes", "Miércoles", "Viernes"]);
assert.deepEqual(generateRoutine({ goal: "fuerza", gender: "neutro", days: 6 }).restDays, []);

// Énfasis por género
for (const days of [3, 4, 5, 6]) {
  const m = generateRoutine({ goal: "hipertrofia", gender: "mujer", days });
  const h = generateRoutine({ goal: "hipertrofia", gender: "hombre", days });
  assert.ok(count(m, "gluteos") > count(h, "gluteos"), `${days} días: la mujer entrena más glúteos`);
  assert.ok(count(h, "pecho") + count(h, "espalda") + count(h, "hombros") > count(m, "pecho") + count(m, "espalda") + count(m, "hombros"),
    `${days} días: el hombre entrena más tren superior`);
}

// Prescripción según objetivo
const first = (goal) => generateRoutine({ goal, gender: "neutro", days: 4 }).sessions[0].exercises[0];
assert.equal(first("fuerza").reps, "4-6");
assert.equal(first("hipertrofia").reps, "8-10");
assert.equal(first("bajar-peso").reps, "12-15");
assert.ok(generateRoutine({ goal: "bajar-peso", gender: "neutro", days: 3 }).sessions.every((s) => /caminadora/i.test(s.cardio)));
assert.equal(generateRoutine({ goal: "fuerza", gender: "neutro", days: 3 }).sessions[0].cardio, null);

// Es determinista (misma entrada, misma rutina) y rota ejercicios entre sesiones del mismo músculo
const a = generateRoutine({ goal: "hipertrofia", gender: "hombre", days: 4 });
assert.deepEqual(a, generateRoutine({ goal: "hipertrofia", gender: "hombre", days: 4 }));
assert.notEqual(a.sessions[0].exercises[0].name, a.sessions[2].exercises.find((e) => e.muscle === "pecho").name);

// Entradas inválidas
assert.throws(() => generateRoutine({ goal: "x", gender: "mujer", days: 3 }));
assert.throws(() => generateRoutine({ goal: "fuerza", gender: "x", days: 3 }));
assert.throws(() => generateRoutine({ goal: "fuerza", gender: "mujer", days: 2 }));

console.log("routines.js OK");
