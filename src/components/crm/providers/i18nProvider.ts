import spanishMessages from "@blackbox-vision/ra-language-spanish";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { mergeTranslations } from "ra-core";

import { mensajesLandings } from "../landings/mensajes";

const crmMessages = {
  ra: {
    auth: {
      sign_in_error: "Correo o contraseña incorrectos",
      auth_check_error: "Iniciá sesión para continuar",
    },
    notification: {
      http_error: "Error de comunicación con el servidor",
    },
  },
  resources: {
    clientes: { name: "Cliente |||| Clientes" },
    oportunidades: { name: "Oportunidad |||| Oportunidades" },
    actividades: { name: "Tarea |||| Tareas" },
    usuarios: { name: "Usuario |||| Usuarios" },
    auditoria: { name: "Registro |||| Auditoría" },
    landings: mensajesLandings,
  },
  crm: {
    common: {
      copy_error: "No se pudo copiar al portapapeles",
      load_error: "No se pudieron cargar los datos",
    },
  },
};

const catalogo = mergeTranslations(spanishMessages, crmMessages);

export const i18nProvider = polyglotI18nProvider(
  () => catalogo,
  "es",
  [{ locale: "es", name: "Español" }],
  { allowMissing: true },
);
