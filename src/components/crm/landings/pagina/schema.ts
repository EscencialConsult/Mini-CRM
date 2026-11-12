/**
 * What a landing page is made of, and what makes it publishable. Pure on
 * purpose: the CRM editor and the Netlify edge function import this same file,
 * so they cannot disagree. Copied from the Escencial CRM; kept in sync by hand.
 */

/**
 * Every landing lives at a path of its own host (VITE_LANDINGS_URL), never the
 * CRM's: a landing and its tracking scripts must not share an origin with the
 * CRM session.
 */
export const landingPath = (slug: string) =>
  `/${slug ? encodeURIComponent(slug) : ""}`;
/** In the editor the slug may still be empty: never a "//" link to another host. */
export const landingPrivacyPath = (slug: string) =>
  `${slug ? landingPath(slug) : ""}/privacidad`;

/** Names that would look like an official service. */
export const RESERVED_SLUGS = [
  "crm",
  "www",
  "mail",
  "bounce",
  "api",
  "admin",
  "app",
  "smtp",
  "ftp",
  "webmail",
  "ns1",
  "ns2",
];

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const isValidSlug = (slug: string) =>
  SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.includes(slug);

/** "Formación en RRHH" becomes "formacion-en-rrhh". */
export const toSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");

export const LANDING_FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "phone",
  "select",
  "radio",
  "checkbox",
] as const;
export type LandingFieldType = (typeof LANDING_FIELD_TYPES)[number];

export const CHOICE_FIELD_TYPES: LandingFieldType[] = [
  "select",
  "radio",
  "checkbox",
];

/** Where an answer goes: a lead column, a custom field, or just the answer. */
export const LANDING_FIELD_TARGETS = [
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "title",
  "message",
  "answer",
] as const;
export const CUSTOM_FIELD_TARGET_PREFIX = "custom:";

export const LANDING_FONTS = {
  system: {
    family: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    google: null,
  },
  inter: {
    family: '"Inter", system-ui, sans-serif',
    google: "Inter:wght@400;500;600;700;800",
  },
  jakarta: {
    family: '"Plus Jakarta Sans", system-ui, sans-serif',
    google: "Plus+Jakarta+Sans:wght@400;500;600;700;800",
  },
  poppins: {
    family: '"Poppins", system-ui, sans-serif',
    google: "Poppins:wght@400;500;600;700;800",
  },
  montserrat: {
    family: '"Montserrat", system-ui, sans-serif',
    google: "Montserrat:wght@400;500;600;700;800",
  },
  lora: {
    family: '"Lora", Georgia, serif',
    google: "Lora:wght@400;500;600;700",
  },
} as const;
export type LandingFont = keyof typeof LANDING_FONTS;

export const LANDING_RADII = { square: 4, soft: 12, round: 22 } as const;
export type LandingRadius = keyof typeof LANDING_RADII;

export interface LandingField {
  id: string;
  label: string;
  type: LandingFieldType;
  required: boolean;
  options: string[];
  /** One of LANDING_FIELD_TARGETS, or `custom:<custom field value>` */
  target: string;
}

export const LANDING_SECTION_TYPES = [
  "benefits",
  "steps",
  "modules",
  "stats",
  "testimonials",
  "pricing",
  "video",
  "about",
  "faq",
  "cta",
] as const;
export type LandingSectionType = (typeof LANDING_SECTION_TYPES)[number];

/** What each field means depends on the type: a plan's subtitle is its price. */
export interface LandingSectionItem {
  title: string;
  subtitle: string;
  text: string;
}

export interface LandingSection {
  id: string;
  type: LandingSectionType;
  /** Hidden sections stay in the editor, and do not block publishing */
  enabled: boolean;
  title: string;
  text: string;
  imageUrl: string;
  videoUrl: string;
  ctaLabel: string;
  items: LandingSectionItem[];
}

export const createLandingSection = (
  type: LandingSectionType,
  id: string,
): LandingSection => ({
  id,
  type,
  enabled: true,
  title: "",
  text: "",
  imageUrl: "",
  videoUrl: "",
  ctaLabel: "",
  items: [],
});

/**
 * What the CRM does with every lead of this landing. Never reaches a visitor:
 * landing_publica strips it, and the renderer does not read it.
 */
export interface LandingAutomation {
  /** Administrator who gets the new clients and the task; null: the first active one */
  adminId: string | null;
  /** "": no task, only the note with the answers */
  taskTitle: string;
  taskDueInDays: number;
  /** Etiquetas que se le suman al cliente (nuevo o ya existente); las borradas se ignoran */
  tagIds: number[];
}

/**
 * Carrito de la landing: parte del mismo formulario. El visitante elige
 * productos junto a sus datos y se guarda un pedido en el CRM (landing_recibir,
 * con los precios de la base); después puede abrir WhatsApp con el mensaje
 * armado. Se publica con la landing: no tiene nada reservado.
 */
export interface LandingCarrito {
  activo: boolean;
  /** Productos que se ofrecen; vacío: todos los activos */
  productoIds: number[];
  /** Número al que se manda el pedido; vacío: se usa el del botón de WhatsApp (si está activado); sin ninguno no se puede publicar */
  telefonoWhatsapp: string;
  /** Variables: {pedido}, {nombre}, {lineas}, {total} */
  plantillaMensaje: string;
  /** Texto del botón de envío del formulario cuando ya se eligió algún producto */
  tituloBoton: string;
  /**
   * Cómo se entrega, lo decide el negocio: "elegir" (la persona elige envío o
   * retiro), "envio" (solo pide la dirección), "retiro" (en el local) o
   * "ninguna" (el pedido queda «a coordinar»).
   */
  entrega: CarritoEntrega;
}

export const CARRITO_ENTREGAS = ["elegir", "envio", "retiro", "ninguna"] as const;
export type CarritoEntrega = (typeof CARRITO_ENTREGAS)[number];

export const CARRITO_PLANTILLA_MENSAJE =
  "Hola, soy {nombre}. Acabo de hacer el pedido #{pedido}:\n{lineas}\nTotal: {total}";
export const CARRITO_TITULO_BOTON = "Enviar pedido";
export const CARRITO_MAX_PRODUCTOS = 200;
export const CARRITO_MAX_LINEAS = 30;
export const CARRITO_MAX_CANTIDAD = 99;

export interface LineaCarritoMensaje {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

export interface DatosMensajeCarrito {
  pedido: number | string;
  nombre: string;
  lineas: LineaCarritoMensaje[];
  total: number;
}

export const formatCarritoMoneda = (valor: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(
    valor,
  );

/**
 * El texto que se manda por WhatsApp: la plantilla con {pedido}, {nombre},
 * {lineas} y {total} reemplazados. Una línea por producto, "• 2 × Nombre — $ 1.000,00".
 * La landing publicada trae su propia copia de esta lógica (render.ts): si
 * cambia una, cambia la otra.
 */
export const armarMensajeCarrito = (
  plantilla: string,
  datos: DatosMensajeCarrito,
): string => {
  const lineas = datos.lineas
    .map(
      (linea) =>
        `• ${linea.cantidad} × ${linea.nombre} — ${formatCarritoMoneda(linea.subtotal)}`,
    )
    .join("\n");
  const valores: Record<string, string> = {
    pedido: String(datos.pedido),
    nombre: datos.nombre,
    lineas,
    total: formatCarritoMoneda(datos.total),
  };
  return (plantilla.trim() ? plantilla : CARRITO_PLANTILLA_MENSAJE).replace(
    /\{\s*(pedido|nombre|lineas|total)\s*\}/g,
    (_, clave: string) => valores[clave],
  );
};

export interface LandingContent {
  version: 1;
  design: {
    primaryColor: string;
    background: {
      type: "color" | "gradient" | "image";
      color: string;
      color2: string;
      imageUrl: string;
      /** How much the image is darkened so the text stays readable, 0 to 80 */
      overlay: number;
    };
    font: LandingFont;
    radius: LandingRadius;
    formPosition: "side" | "below";
  };
  hero: {
    logoUrl: string;
    eyebrow: string;
    title: string;
    subtitle: string;
    imageUrl: string;
    /** Short reasons shown with a check under the subtitle */
    highlights: string[];
    /** The button that leads to the form, everywhere on the page */
    ctaLabel: string;
  };
  sections: LandingSection[];
  footer: { company: string; email: string; phone: string; address: string };
  form: {
    title: string;
    intro: string;
    submitLabel: string;
    fields: LandingField[];
    consent: { enabled: boolean; text: string };
  };
  thanks: {
    mode: "message" | "url" | "whatsapp";
    title: string;
    message: string;
    url: string;
  };
  /** Floating button: asks for name and phone, then opens the chat */
  whatsapp: {
    enabled: boolean;
    phone: string;
    label: string;
    message: string;
    popupTitle: string;
    popupText: string;
  };
  tracking: { facebookPixelId: string; googleTagId: string };
  automation: LandingAutomation;
  /** Siempre completo al normalizar: las landings anteriores quedan con el carrito apagado */
  carrito: LandingCarrito;
  seo: { title: string; description: string; imageUrl: string };
  privacy: { title: string; text: string };
  settings: { channel: string };
}

export const createEmptyLandingContent = (): LandingContent => ({
  version: 1,
  design: {
    primaryColor: "#0f766e",
    background: {
      type: "gradient",
      color: "#0f766e",
      color2: "#134e4a",
      imageUrl: "",
      overlay: 50,
    },
    font: "jakarta",
    radius: "soft",
    formPosition: "side",
  },
  hero: {
    logoUrl: "",
    eyebrow: "",
    title: "",
    subtitle: "",
    imageUrl: "",
    highlights: [],
    ctaLabel: "",
  },
  sections: [],
  footer: { company: "", email: "", phone: "", address: "" },
  form: {
    title: "",
    intro: "",
    submitLabel: "Enviar",
    fields: [],
    consent: { enabled: true, text: "" },
  },
  thanks: {
    mode: "message",
    title: "¡Gracias!",
    message: "Recibimos tus datos. Te contactaremos pronto.",
    url: "",
  },
  whatsapp: {
    enabled: false,
    phone: "",
    label: "Escríbenos",
    message: "Hola, soy {{nombre}} y quiero más información",
    popupTitle: "Hablemos por WhatsApp",
    popupText: "Déjanos tu nombre y número, y abrimos el chat.",
  },
  tracking: { facebookPixelId: "", googleTagId: "" },
  automation: {
    adminId: null,
    taskTitle: "Contactar al cliente",
    taskDueInDays: 1,
    tagIds: [],
  },
  carrito: {
    activo: false,
    productoIds: [],
    telefonoWhatsapp: "",
    plantillaMensaje: CARRITO_PLANTILLA_MENSAJE,
    tituloBoton: CARRITO_TITULO_BOTON,
    entrega: "elegir",
  },
  seo: { title: "", description: "", imageUrl: "" },
  privacy: { title: "Política de privacidad", text: "" },
  settings: { channel: "" },
});

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const ITEM_ID = /^[a-zA-Z0-9_-]{1,40}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const asText = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const asColor = (value: unknown, fallback: string): string =>
  typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
const asChoice = <T extends string>(
  value: unknown,
  choices: readonly T[],
  fallback: T,
): T => (choices.includes(value as T) ? (value as T) : fallback);
const asList = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const asTextList = (value: unknown): string[] =>
  asList(value).filter((item): item is string => typeof item === "string");
const asItemId = (value: unknown, fallback: string) => {
  const id = asText(value);
  return ITEM_ID.test(id) ? id : fallback;
};
const normalizeSection = (value: unknown, index: number): LandingSection => {
  const section = asObject(value);
  return {
    id: asItemId(section.id, `seccion_${index + 1}`),
    type: asChoice(section.type, LANDING_SECTION_TYPES, "benefits"),
    enabled: section.enabled !== false,
    title: asText(section.title),
    text: asText(section.text),
    imageUrl: asText(section.imageUrl),
    videoUrl: asText(section.videoUrl),
    ctaLabel: asText(section.ctaLabel),
    items: asList(section.items).map((item) => ({
      title: asText(asObject(item).title),
      subtitle: asText(asObject(item).subtitle),
      text: asText(asObject(item).text),
    })),
  };
};

const MAX_TAGS = 20;

const normalizeAutomation = (value: unknown): LandingAutomation => {
  const automation = asObject(value);
  const due = Number(automation.taskDueInDays);
  const adminId = asText(automation.adminId);
  return {
    adminId: UUID.test(adminId) ? adminId.toLowerCase() : null,
    taskTitle: asText(automation.taskTitle, "Contactar al cliente"),
    taskDueInDays: Number.isFinite(due)
      ? Math.min(365, Math.max(0, Math.round(due)))
      : 1,
    tagIds: Array.isArray(automation.tagIds)
      ? [
          ...new Set(
            automation.tagIds.filter(
              (id): id is number => Number.isSafeInteger(id) && id > 0,
            ),
          ),
        ].slice(0, MAX_TAGS)
      : [],
  };
};

const normalizeCarrito = (value: unknown): LandingCarrito => {
  const carrito = asObject(value);
  const plantilla = asText(carrito.plantillaMensaje);
  const boton = asText(carrito.tituloBoton).trim();
  return {
    activo: carrito.activo === true,
    productoIds: Array.isArray(carrito.productoIds)
      ? [
          ...new Set(
            carrito.productoIds.filter(
              (id): id is number => Number.isSafeInteger(id) && id > 0,
            ),
          ),
        ].slice(0, CARRITO_MAX_PRODUCTOS)
      : [],
    telefonoWhatsapp: asText(carrito.telefonoWhatsapp).trim(),
    plantillaMensaje: plantilla.trim() ? plantilla : CARRITO_PLANTILLA_MENSAJE,
    tituloBoton: boton || CARRITO_TITULO_BOTON,
    // Without it (landings from before) the visitor keeps choosing
    entrega: asChoice(carrito.entrega, CARRITO_ENTREGAS, "elegir"),
  };
};

/**
 * Whatever is stored or sent, this returns a complete and safe structure: the
 * renderer and the validations never see a missing piece or a bad color.
 */
export const normalizeLandingContent = (value: unknown): LandingContent => {
  const empty = createEmptyLandingContent();
  const input = asObject(value);
  const design = asObject(input.design);
  const background = asObject(design.background);
  const hero = asObject(input.hero);
  const footer = asObject(input.footer);
  const form = asObject(input.form);
  const consent = asObject(form.consent);
  const thanks = asObject(input.thanks);
  const whatsapp = asObject(input.whatsapp);
  const tracking = asObject(input.tracking);
  const seo = asObject(input.seo);
  const privacy = asObject(input.privacy);
  const settings = asObject(input.settings);
  const overlay = Number(background.overlay);

  return {
    version: 1,
    design: {
      primaryColor: asColor(design.primaryColor, empty.design.primaryColor),
      background: {
        type: asChoice(
          background.type,
          ["color", "gradient", "image"] as const,
          empty.design.background.type,
        ),
        color: asColor(background.color, empty.design.background.color),
        color2: asColor(background.color2, empty.design.background.color2),
        imageUrl: asText(background.imageUrl),
        overlay: Number.isFinite(overlay)
          ? Math.min(80, Math.max(0, overlay))
          : empty.design.background.overlay,
      },
      font: asChoice(
        design.font,
        Object.keys(LANDING_FONTS) as LandingFont[],
        empty.design.font,
      ),
      radius: asChoice(
        design.radius,
        Object.keys(LANDING_RADII) as LandingRadius[],
        empty.design.radius,
      ),
      formPosition: asChoice(
        design.formPosition,
        ["side", "below"] as const,
        empty.design.formPosition,
      ),
    },
    hero: {
      logoUrl: asText(hero.logoUrl),
      eyebrow: asText(hero.eyebrow),
      title: asText(hero.title),
      subtitle: asText(hero.subtitle),
      imageUrl: asText(hero.imageUrl),
      highlights: asTextList(hero.highlights),
      ctaLabel: asText(hero.ctaLabel),
    },
    sections: asList(input.sections).map(normalizeSection),
    footer: {
      company: asText(footer.company),
      email: asText(footer.email),
      phone: asText(footer.phone),
      address: asText(footer.address),
    },
    form: {
      title: asText(form.title),
      intro: asText(form.intro),
      submitLabel: asText(form.submitLabel, empty.form.submitLabel),
      fields: asList(form.fields).map((item, index) => {
        const field = asObject(item);
        return {
          id: asItemId(field.id, `campo_${index + 1}`),
          label: asText(field.label),
          type: asChoice(field.type, LANDING_FIELD_TYPES, "text"),
          required: field.required === true,
          options: asTextList(field.options),
          target: asText(field.target, "answer"),
        };
      }),
      consent: {
        enabled: consent.enabled !== false,
        text: asText(consent.text),
      },
    },
    thanks: {
      mode: asChoice(
        thanks.mode,
        ["message", "url", "whatsapp"] as const,
        "message",
      ),
      title: asText(thanks.title, empty.thanks.title),
      message: asText(thanks.message, empty.thanks.message),
      url: asText(thanks.url),
    },
    whatsapp: {
      enabled: whatsapp.enabled === true,
      phone: asText(whatsapp.phone),
      label: asText(whatsapp.label, empty.whatsapp.label),
      message: asText(whatsapp.message, empty.whatsapp.message),
      popupTitle: asText(whatsapp.popupTitle, empty.whatsapp.popupTitle),
      popupText: asText(whatsapp.popupText, empty.whatsapp.popupText),
    },
    tracking: {
      facebookPixelId: asText(tracking.facebookPixelId).trim(),
      googleTagId: asText(tracking.googleTagId).trim(),
    },
    automation: normalizeAutomation(input.automation),
    carrito: normalizeCarrito(input.carrito),
    seo: {
      title: asText(seo.title),
      description: asText(seo.description),
      imageUrl: asText(seo.imageUrl),
    },
    privacy: {
      title: asText(privacy.title, empty.privacy.title),
      text: asText(privacy.text),
    },
    settings: { channel: asText(settings.channel) },
  };
};

export const isHttpUrl = (value: string) => /^https?:\/\/[^\s]+$/i.test(value);

/** Digits of a phone for wa.me, or "" if it cannot be one. */
export const phoneDigits = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 6 ? digits : "";
};

/**
 * Number the cart sends the order to: its own, or else the one of the WhatsApp
 * button, so a store does not have to type the same phone twice.
 */
export const carritoTelefono = ({
  carrito,
  whatsapp,
}: Pick<LandingContent, "carrito" | "whatsapp">) =>
  phoneDigits(carrito.telefonoWhatsapp) ||
  (whatsapp.enabled ? phoneDigits(whatsapp.phone) : "");

/** Only YouTube and Vimeo: their players are the ones the page allows to load. */
export const videoEmbedUrl = (value: string) => {
  const url = value.trim();
  const youtube = url.match(
    /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/i,
  );
  if (youtube) return `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
  const vimeo = url.match(
    /^https?:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})(?:[?#/].*)?$/i,
  );
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return "";
};

export const isFacebookPixelId = (value: string) => /^\d{5,20}$/.test(value);
export const isGoogleTagId = (value: string) =>
  /^(G|AW|GT|DC)-[A-Z0-9]{4,20}$/.test(value);

export const LANDING_PROBLEMS = [
  "title_missing",
  "name_missing",
  "contact_missing",
  "label_missing",
  "options_missing",
  "target_repeated",
  "consent_missing",
  "privacy_missing",
  "thanks_url_invalid",
  "thanks_whatsapp_missing",
  "whatsapp_missing",
  "cart_phone_missing",
  "video_invalid",
  "tracking_invalid",
  "placeholder_left",
] as const;
export type LandingProblem = (typeof LANDING_PROBLEMS)[number];

/** Text the templates ask to replace: it must never reach a visitor. */
export const PLACEHOLDER_MARK = "[COMPLETAR";

/** Why this landing cannot go public yet; nothing means it can. */
export const findPublishProblems = (
  content: LandingContent,
): LandingProblem[] => {
  const problems: LandingProblem[] = [];
  const { fields, consent } = content.form;
  const { whatsapp, tracking, thanks } = content;
  const targets = fields.map((field) => field.target);
  const sections = content.sections.filter((section) => section.enabled);

  if (!content.hero.title.trim()) problems.push("title_missing");
  if (!targets.includes("full_name") && !targets.includes("first_name")) {
    problems.push("name_missing");
  }
  // A lead nobody can reach is useless
  if (
    !fields.some(
      (field) =>
        field.required &&
        (field.target === "email" || field.target === "phone"),
    )
  ) {
    problems.push("contact_missing");
  }
  if (fields.some((field) => !field.label.trim())) {
    problems.push("label_missing");
  }
  if (
    fields.some(
      (field) =>
        CHOICE_FIELD_TYPES.includes(field.type) &&
        field.options.filter((option) => option.trim()).length === 0,
    )
  ) {
    problems.push("options_missing");
  }
  const columns = targets.filter((target) => target !== "answer");
  if (new Set(columns).size !== columns.length) {
    problems.push("target_repeated");
  }
  // Whoever leaves an email must have agreed to receive messages
  if (targets.includes("email") && (!consent.enabled || !consent.text.trim())) {
    problems.push("consent_missing");
  }
  if (!content.privacy.text.trim()) problems.push("privacy_missing");
  if (thanks.mode === "url" && !isHttpUrl(thanks.url)) {
    problems.push("thanks_url_invalid");
  }
  if (thanks.mode === "whatsapp" && !phoneDigits(whatsapp.phone)) {
    problems.push("thanks_whatsapp_missing");
  }
  if (whatsapp.enabled && !phoneDigits(whatsapp.phone)) {
    problems.push("whatsapp_missing");
  }
  if (content.carrito.activo && !carritoTelefono(content)) {
    problems.push("cart_phone_missing");
  }
  if (
    sections.some(
      (section) =>
        section.type === "video" &&
        section.videoUrl.trim() &&
        !videoEmbedUrl(section.videoUrl),
    )
  ) {
    problems.push("video_invalid");
  }
  if (
    (tracking.facebookPixelId &&
      !isFacebookPixelId(tracking.facebookPixelId)) ||
    (tracking.googleTagId && !isGoogleTagId(tracking.googleTagId))
  ) {
    problems.push("tracking_invalid");
  }
  // Only what a visitor can read: a hidden section may wait
  const visible = { ...content, sections, automation: undefined };
  if (JSON.stringify(visible).includes(PLACEHOLDER_MARK)) {
    problems.push("placeholder_left");
  }
  return problems;
};
