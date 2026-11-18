// Prueba las reglas de la prueba gratis, sin red ni base de datos:
//   1. las del SERVIDOR (función `cuentas`: iniciar, extender, cortar, convertir), extraídas
//      del propio archivo entre las marcas <prueba-gratis>;
//   2. las de la PANTALLA (src/components/crm/domain/prueba.ts: estado, días que faltan,
//      comprobación de que el servidor aplicó el cambio) y el mensaje de WhatsApp.
//
//   npm run test:prueba
//
// El corte automático en sí lo prueba la base: supabase/tests/aislamiento_cuentas.sql (sección 10).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = join(import.meta.dirname, "..");

// ---------------------------------------------------------------------------
// 1) Reglas del servidor, tal como están en la función `cuentas`
// ---------------------------------------------------------------------------
const fuenteServidor = readFileSync(join(raiz, "supabase", "functions", "cuentas", "index.ts"), "utf8");
const bloque = fuenteServidor.match(/\/\/ <prueba-gratis>[\s\S]*?\/\/ <\/prueba-gratis>/);
if (!bloque) {
  console.error("✗ No encuentro el bloque <prueba-gratis> en supabase/functions/cuentas/index.ts");
  process.exit(1);
}
const carpeta = mkdtempSync(join(tmpdir(), "mini-crm-prueba-"));
const archivoServidor = join(carpeta, "prueba-servidor.mts");
writeFileSync(archivoServidor, `${bloque[0]}\nexport { calcularPrueba, DIAS_DE_PRUEBA, MAX_DIAS_PRUEBA };\n`);
const servidor = await import(pathToFileURL(archivoServidor).href);
const pantalla = await import(
  pathToFileURL(join(raiz, "src", "components", "crm", "domain", "prueba.ts")).href
);
const { mensajeSeguimientoPrueba } = await import(
  pathToFileURL(join(raiz, "src", "components", "crm", "cuentas", "seguimientoPrueba.ts")).href
);
rmSync(carpeta, { recursive: true, force: true });

const AHORA = Date.parse("2026-11-18T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const calcular = (hastaActual, accion, dias, propia = false) =>
  servidor.calcularPrueba(propia, hastaActual, accion, dias, AHORA);
const rechazado = (resultado, estado, codigo) => {
  assert.equal(resultado.ok, false, "debió rechazarse");
  assert.equal(resultado.estado, estado);
  assert.equal(resultado.codigo, codigo);
};

const PRUEBAS = [
  ["servidor · la prueba dura 3 días", () => assert.equal(servidor.DIAS_DE_PRUEBA, 3)],
  [
    "servidor · iniciar: pone en prueba una cuenta sin prueba, 3 días desde ahora",
    () => assert.deepEqual(calcular(null, "iniciar"), { ok: true, hasta: iso(AHORA + 3 * DIA) }),
  ],
  [
    "servidor · iniciar con días propios",
    () => assert.deepEqual(calcular(null, "iniciar", 5), { ok: true, hasta: iso(AHORA + 5 * DIA) }),
  ],
  [
    "servidor · iniciar sobre una cuenta que ya tiene prueba se rechaza",
    () => rechazado(calcular(iso(AHORA + DIA), "iniciar"), 409, "trial_exists"),
  ],
  [
    "servidor · extender suma desde el vencimiento si todavía no pasó",
    () =>
      assert.deepEqual(calcular(iso(AHORA + DIA), "extender"), { ok: true, hasta: iso(AHORA + 4 * DIA) }),
  ],
  [
    "servidor · extender una vencida cuenta desde ahora (dar 3 días más)",
    () =>
      assert.deepEqual(calcular(iso(AHORA - 2 * DIA), "extender"), { ok: true, hasta: iso(AHORA + 3 * DIA) }),
  ],
  [
    "servidor · extender una cuenta paga se rechaza (no la convierte en prueba por error)",
    () => rechazado(calcular(null, "extender"), 409, "no_trial"),
  ],
  [
    "servidor · cortar una prueba en curso la termina ahora",
    () => assert.deepEqual(calcular(iso(AHORA + 2 * DIA), "cortar"), { ok: true, hasta: iso(AHORA) }),
  ],
  [
    "servidor · cortar una ya terminada no cambia nada",
    () => assert.deepEqual(calcular(iso(AHORA - HORA), "cortar"), { ok: true, hasta: undefined }),
  ],
  [
    "servidor · cortar una cuenta paga se rechaza (para bloquearla está suspender)",
    () => rechazado(calcular(null, "cortar"), 409, "no_trial"),
  ],
  [
    "servidor · convertir quita la prueba (cuenta paga)",
    () => {
      assert.deepEqual(calcular(iso(AHORA + DIA), "convertir"), { ok: true, hasta: null });
      assert.deepEqual(calcular(iso(AHORA - DIA), "convertir"), { ok: true, hasta: null });
    },
  ],
  [
    "servidor · convertir una cuenta que ya es paga se rechaza",
    () => rechazado(calcular(null, "convertir"), 409, "no_trial"),
  ],
  [
    "servidor · sin acción no hay cambio",
    () => assert.deepEqual(calcular(iso(AHORA + DIA), undefined), { ok: true, hasta: undefined }),
  ],
  [
    "servidor · una acción desconocida se rechaza",
    () => {
      rechazado(calcular(null, "borrar"), 400, "invalid_trial_action");
      rechazado(calcular(null, 1), 400, "invalid_trial_action");
    },
  ],
  [
    "servidor · días inválidos se rechazan (0, 31, decimales, texto)",
    () => {
      for (const dias of [0, -1, 31, 2.5, "3", null]) rechazado(calcular(null, "iniciar", dias), 400, "invalid_days");
    },
  ],
  [
    "servidor · la cuenta de la plataforma no entra en prueba (ninguna acción)",
    () => {
      for (const accion of ["iniciar", "extender", "cortar", "convertir"]) {
        rechazado(calcular(null, accion, undefined, true), 403, "self_change");
      }
    },
  ],
  [
    "pantalla · estado de la prueba",
    () => {
      const e = (hasta) => pantalla.estadoPrueba({ prueba_hasta: hasta }, AHORA);
      assert.equal(e(null), "sin_prueba");
      assert.equal(e(undefined), "sin_prueba");
      assert.equal(e("no es una fecha"), "sin_prueba");
      assert.equal(e(iso(AHORA + 1)), "en_prueba");
      assert.equal(e(iso(AHORA)), "terminada", "en el instante exacto del vencimiento ya está terminada");
      assert.equal(e(iso(AHORA - 1)), "terminada");
      assert.equal(pantalla.estadoPrueba(undefined, AHORA), "sin_prueba");
    },
  ],
  [
    "pantalla · cuenta vigente (activa y sin vencer): la misma regla que la base",
    () => {
      const v = (activa, hasta) => pantalla.cuentaVigente({ activa, prueba_hasta: hasta }, AHORA);
      assert.equal(v(true, null), true);
      assert.equal(v(true, iso(AHORA + DIA)), true);
      assert.equal(v(true, iso(AHORA - 1)), false, "vencida");
      assert.equal(v(false, iso(AHORA + DIA)), false, "suspendida aunque la prueba no venza");
      assert.equal(v(false, null), false);
      assert.equal(pantalla.cuentaVigente(undefined, AHORA), false);
    },
  ],
  [
    "pantalla · estado de la cuenta para la lista",
    () => {
      const s = (activa, hasta) => pantalla.estadoCuenta({ activa, prueba_hasta: hasta }, AHORA);
      assert.equal(s(true, null), "activa");
      assert.equal(s(true, iso(AHORA + DIA)), "en_prueba");
      assert.equal(s(true, iso(AHORA - DIA)), "prueba_terminada");
      assert.equal(s(false, iso(AHORA - DIA)), "suspendida");
      assert.equal(s(false, null), "suspendida");
    },
  ],
  [
    "pantalla · días que faltan (hacia arriba) y días desde que terminó",
    () => {
      const f = (ms) => pantalla.diasRestantes({ prueba_hasta: iso(AHORA + ms) }, AHORA);
      assert.equal(f(HORA), 1);
      assert.equal(f(DIA), 1);
      assert.equal(f(DIA + 1), 2);
      assert.equal(f(71 * HORA), 3);
      assert.equal(f(3 * DIA), 3);
      assert.equal(pantalla.diasRestantes({ prueba_hasta: null }, AHORA), null);
      assert.equal(pantalla.diasRestantes({ prueba_hasta: iso(AHORA - HORA) }, AHORA), null);
      const t = (ms) => pantalla.diasDesdeQueTermino({ prueba_hasta: iso(AHORA - ms) }, AHORA);
      assert.equal(t(HORA), 0);
      assert.equal(t(25 * HORA), 1);
      assert.equal(t(3 * DIA), 3);
      assert.equal(pantalla.diasDesdeQueTermino({ prueba_hasta: iso(AHORA + DIA) }, AHORA), null);
    },
  ],
  [
    "pantalla · comprobar que el servidor aplicó el cambio",
    () => {
      const m = (accion, cuenta) => pantalla.motivoSinAplicar(accion, cuenta, AHORA);
      // Una versión vieja de la función no devuelve la columna: nada se aplicó
      assert.match(m("cortar", { nombre: "x" }), /todavía no tiene la prueba gratis/);
      assert.equal(m("iniciar", { prueba_hasta: iso(AHORA + 3 * DIA) }), null);
      assert.equal(m("extender", { prueba_hasta: iso(AHORA + 3 * DIA) }), null);
      assert.match(m("iniciar", { prueba_hasta: null }), /no aplicó/);
      assert.equal(m("cortar", { prueba_hasta: iso(AHORA) }), null);
      assert.equal(m("cortar", { prueba_hasta: iso(AHORA + 30 * 1000) }), null, "reloj de esta máquina 30 s atrasado");
      assert.match(m("cortar", { prueba_hasta: iso(AHORA + 2 * DIA) }), /no aplicó/);
      assert.equal(m("convertir", { prueba_hasta: null }), null);
      assert.match(m("convertir", { prueba_hasta: iso(AHORA + DIA) }), /no aplicó/);
    },
  ],
  [
    "pantalla · mensaje de WhatsApp para preguntar si le interesó",
    () => {
      const con = mensajeSeguimientoPrueba({ nombre: "Ana", empresa: "Panadería López" });
      assert.match(con, /^Hola Ana, soy de Dealflow\. Terminó tu prueba gratis de Panadería López\./);
      assert.match(con, /¿Te interesa seguir con un plan\?/);
      const sin = mensajeSeguimientoPrueba({ nombre: "  Beto " });
      assert.match(sin, /^Hola Beto, soy de Dealflow\. Terminó tu prueba gratis\./);
      assert.doesNotMatch(sin, /undefined| de \./);
    },
  ],
];

let fallos = 0;
for (const [nombre, prueba] of PRUEBAS) {
  try {
    prueba();
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.error(`✗ ${nombre}\n  ${String(error.message).split("\n")[0]}`);
  }
}
if (fallos) process.exit(1);
console.log(`✓ ${PRUEBAS.length} pruebas de la prueba gratis`);
