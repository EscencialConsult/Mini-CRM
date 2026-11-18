// Prueba cómo lee el CRM el perfil del usuario (src/components/crm/providers/authProvider.ts)
// según las migraciones que tenga aplicadas la base. Usa el código real del archivo (Node le quita
// los tipos) con un cliente de Supabase FALSO: no necesita red, credenciales ni navegador.
//
//   npm run test:perfil
//
// Existe por un error real: el sitio salió antes que la migración 20261118100000, el perfil se pidió
// con una columna que todavía no existía y el respaldo descartó también cuenta_id y plataforma, con lo
// que el dueño del sistema dejó de ver «Cuentas». Si agregás una columna al perfil, sumá un nivel nuevo
// a COLUMNAS_SEGUN_MIGRACION (no la pegues al select existente) y un escenario acá.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fuente = process.argv[2]
  ? resolve(process.argv[2])
  : join(import.meta.dirname, "..", "src", "components", "crm", "providers", "authProvider.ts");

// Las dependencias del archivo se reemplazan por piezas mínimas; los stubs viven en una carpeta temporal
const carpeta = mkdtempSync(join(tmpdir(), "mini-crm-perfil-"));
const stub = (nombre, codigo) => {
  writeFileSync(join(carpeta, nombre), codigo);
  return pathToFileURL(join(carpeta, nombre)).href;
};
// Código real y sin dependencias de la app: se usa tal cual, no se simula
const PRUEBA_REAL = pathToFileURL(
  join(import.meta.dirname, "..", "src", "components", "crm", "domain", "prueba.ts"),
).href;
const REEMPLAZOS = {
  "../domain/prueba": PRUEBA_REAL,
  "ra-core": stub("ra-core.mjs", "export const useGetIdentity = () => ({});"),
  "ra-supabase-core": stub("ra-supabase-core.mjs", "export const supabaseAuthProvider = () => ({});"),
  "../domain/modulos": stub("modulos.mjs", "export const tieneModulo = () => true;"),
  "./permissions": stub("permissions.mjs", "export const puedeAcceder = () => true;"),
  "./supabase": stub("supabase.mjs", "export const getSupabaseClient = () => globalThis.__clienteFalso;"),
};
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (REEMPLAZOS[especificador]) return { url: REEMPLAZOS[especificador], shortCircuit: true };
    return siguiente(especificador, contexto);
  },
});

const VALORES = {
  id: "u1",
  nombre: "Ana",
  apellido: "Gómez",
  email: "ana@x.com",
  rol: "administrador",
  activo: true,
  modulos: [],
  creado_en: "2026-01-01",
  cuenta_id: 7,
  plataforma: true,
  debe_cambiar_clave: false,
};

const VALORES_CUENTA = {
  id: 7,
  nombre: "Cuenta X",
  activa: true,
  modulos: ["clientes"],
  max_usuarios: null,
  prueba_hasta: "2099-01-01T00:00:00+00:00",
};

/**
 * Base falsa: sólo existen las columnas de `estado.columnas` (usuarios) y `estado.columnasCuenta`
 * (cuentas); `estado.cortada` simula un corte de red.
 */
const crearCliente = (estado) => ({
  auth: { getSession: async () => ({ data: { session: { user: { id: "u1" } } } }) },
  from: (tabla) => ({
    select: (columnas) => ({
      eq: () => ({
        maybeSingle: async () => {
          const pedidas = columnas.split(",").map((columna) => columna.trim());
          estado.consultas.push({ tabla, columnas: pedidas });
          if (estado.cortada) return { data: null, error: { message: "TypeError: Failed to fetch" } };
          const existentes = tabla === "cuentas" ? estado.columnasCuenta : estado.columnas;
          const valores = tabla === "cuentas" ? VALORES_CUENTA : VALORES;
          const falta = pedidas.find((columna) => !existentes.has(columna));
          if (falta) {
            return { data: null, error: { code: "42703", message: `column ${tabla}.${falta} does not exist` } };
          }
          return { data: Object.fromEntries(pedidas.map((columna) => [columna, valores[columna]])), error: null };
        },
      }),
    }),
  }),
});

const BASE = ["id", "nombre", "apellido", "email", "rol", "activo", "modulos", "creado_en"];
const CUENTAS = ["cuenta_id", "plataforma"];
const SEGURIDAD = ["debe_cambiar_clave"];
const BASE_CUENTA = ["id", "nombre", "activa", "modulos", "max_usuarios"];
const PRUEBA = ["prueba_hasta"];

let instancia = 0;
// Cada escenario carga el módulo de nuevo (el query string evita la caché): arranca sin estado previo
const cargar = async (columnas, columnasCuenta = [...BASE_CUENTA, ...PRUEBA]) => {
  const estado = {
    columnas: new Set(columnas),
    columnasCuenta: new Set(columnasCuenta),
    consultas: [],
    cortada: false,
  };
  globalThis.__clienteFalso = crearCliente(estado);
  const modulo = await import(`${pathToFileURL(fuente).href}?i=${++instancia}`);
  return { modulo, estado };
};
const lecturasDeUsuarios = (estado) => estado.consultas.filter((consulta) => consulta.tabla === "usuarios");
const lecturasDeCuentas = (estado) => estado.consultas.filter((consulta) => consulta.tabla === "cuentas");

const ESCENARIOS = [
  [
    "todas las migraciones aplicadas",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS, ...SEGURIDAD]);
      const perfil = await modulo.getPerfil();
      assert.equal(perfil.plataforma, true);
      assert.equal(perfil.cuenta_id, 7);
      assert.equal(perfil.debe_cambiar_clave, false);
      assert.equal(perfil.cuenta?.nombre, "Cuenta X");
      assert.equal(lecturasDeUsuarios(estado).length, 1);
    },
  ],
  [
    "falta sólo la de seguridad (el sitio salió antes que ella): no se pierde plataforma ni cuenta",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS]);
      const perfil = await modulo.getPerfil();
      assert.ok(perfil, "no devolvió perfil");
      assert.equal(perfil.plataforma, true, "se perdió «plataforma»: el dueño no vería Cuentas");
      assert.equal(perfil.cuenta_id, 7, "se perdió «cuenta_id»");
      assert.equal(perfil.cuenta?.nombre, "Cuenta X", "no se cargó la cuenta");
      assert.equal(perfil.debe_cambiar_clave, undefined);
      assert.equal(lecturasDeUsuarios(estado).length, 2);
      // El nivel se recuerda: la próxima lectura no insiste con la columna que falta
      modulo.invalidarPerfil();
      await modulo.getPerfil();
      assert.equal(lecturasDeUsuarios(estado).length, 3, "la segunda lectura volvió a probar el nivel más nuevo");
    },
  ],
  [
    "cuenta con prueba gratis: llega el vencimiento",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS, ...SEGURIDAD]);
      const perfil = await modulo.getPerfil();
      assert.equal(perfil.cuenta?.prueba_hasta, "2099-01-01T00:00:00+00:00");
      assert.equal(lecturasDeCuentas(estado).length, 1);
    },
  ],
  [
    "falta sólo la de la prueba gratis (cuentas sin prueba_hasta): la cuenta se carga igual",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS, ...SEGURIDAD], BASE_CUENTA);
      const perfil = await modulo.getPerfil();
      assert.ok(perfil.cuenta, "se perdió la cuenta: no se limitaría nada por plan ni se vería que está suspendida");
      assert.equal(perfil.cuenta.nombre, "Cuenta X");
      assert.equal(perfil.cuenta.activa, true);
      assert.equal(perfil.cuenta.prueba_hasta, undefined);
      assert.equal(lecturasDeCuentas(estado).length, 2);
      // El nivel se recuerda también para la cuenta
      modulo.invalidarPerfil();
      await modulo.getPerfil();
      assert.equal(lecturasDeCuentas(estado).length, 3);
    },
  ],
  [
    "PRODUCCIÓN HOY: la de seguridad y la de la prueba faltan a la vez: queda todo lo de cuentas",
    async () => {
      const { modulo } = await cargar([...BASE, ...CUENTAS], BASE_CUENTA);
      const perfil = await modulo.getPerfil();
      assert.equal(perfil.plataforma, true, "se perdió «plataforma»");
      assert.equal(perfil.cuenta_id, 7);
      assert.equal(perfil.cuenta?.nombre, "Cuenta X", "se perdió la cuenta");
      assert.equal(perfil.debe_cambiar_clave, undefined);
    },
  ],
  [
    "no hay ninguna de las dos migraciones",
    async () => {
      const { modulo, estado } = await cargar(BASE);
      const perfil = await modulo.getPerfil();
      assert.equal(perfil.nombre, "Ana");
      assert.equal(perfil.cuenta_id, undefined);
      assert.equal(perfil.cuenta, undefined);
      assert.equal(lecturasDeUsuarios(estado).length, 3);
    },
  ],
  [
    "corte de red: no devuelve perfil y NO baja de nivel (la próxima lectura vuelve a probar el completo)",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS, ...SEGURIDAD]);
      estado.cortada = true;
      assert.equal(await modulo.getPerfil(), undefined);
      assert.equal(lecturasDeUsuarios(estado).length, 1);
      estado.cortada = false;
      modulo.invalidarPerfil();
      const perfil = await modulo.getPerfil();
      assert.equal(perfil.plataforma, true);
      assert.equal(perfil.debe_cambiar_clave, false, "tras el corte quedó en un nivel más bajo");
    },
  ],
  [
    "la migración se aplica con la pestaña abierta: a los 10 minutos vuelve a leer el nivel completo",
    async () => {
      const { modulo, estado } = await cargar([...BASE, ...CUENTAS]);
      await modulo.getPerfil();
      estado.columnas.add("debe_cambiar_clave");
      const ahora = Date.now;
      try {
        Date.now = () => ahora() + 11 * 60 * 1000;
        modulo.invalidarPerfil();
        const perfil = await modulo.getPerfil();
        assert.equal(perfil.debe_cambiar_clave, false, "no volvió a probar el nivel completo");
      } finally {
        Date.now = ahora;
      }
    },
  ],
];

let fallos = 0;
for (const [nombre, prueba] of ESCENARIOS) {
  try {
    await prueba();
    console.log(`✓ ${nombre}`);
  } catch (error) {
    fallos += 1;
    console.error(`✗ ${nombre}\n  ${String(error.message).split("\n")[0]}`);
  }
}
rmSync(carpeta, { recursive: true, force: true });
if (fallos) process.exit(1);
console.log(`✓ ${ESCENARIOS.length} escenarios del perfil`);
