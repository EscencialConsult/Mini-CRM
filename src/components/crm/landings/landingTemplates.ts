import {
  createEmptyLandingContent,
  type LandingContent,
  type LandingField,
  type LandingFieldType,
} from "./pagina/schema.ts";
import { newLandingItemId, newLandingSection } from "./landingSections";

export const newFieldId = () => newLandingItemId("q");

const field = (
  label: string,
  type: LandingFieldType,
  target: string,
  required = false,
  options: string[] = [],
): LandingField => ({
  id: newFieldId(),
  label,
  type,
  target,
  required,
  options,
});

/** What everybody needs: who they are and how to reach them. */
const contactFields = (): LandingField[] => [
  field("Nombre y apellido", "text", "full_name", true),
  field("Email", "email", "email", true),
  field("Teléfono", "phone", "phone"),
];

const item = (title: string, text = "", subtitle = "") => ({
  title,
  subtitle,
  text,
});

/** What the person creating the landing tells us, so it is not asked four times. */
export interface LandingBrand {
  company?: string;
  email?: string;
  logoUrl?: string;
}

const privacyText = (company: string, email: string) =>
  `${company} es responsable de los datos que nos dejás en esta página.

Qué datos guardamos: los que completás en el formulario y la fecha en que lo enviaste.

Para qué los usamos: para responder tu consulta y enviarte información sobre lo que pediste.

Quién los ve: solo nuestro equipo. No vendemos, alquilamos ni compartimos tus datos con otras empresas.

Cómo darte de baja: cada correo trae un enlace para dejar de recibirlos. También podés pedir que corrijamos o borremos tus datos escribiendo a ${email}.

Más información: [COMPLETAR: revisá este texto según la ley de tu país].`;

// Marked with [COMPLETAR: ...]: publishing is blocked while a visible one
// remains, so nothing made up reaches a visitor. No testimonials, figures or
// prices here: those sections start hidden, ready to be filled in.
const base = (
  brand: LandingBrand,
  overrides: Partial<LandingContent>,
): LandingContent => {
  const empty = createEmptyLandingContent();
  const company = brand.company?.trim() || "[COMPLETAR: nombre de tu empresa]";
  const email = brand.email?.trim() || "[COMPLETAR: correo de contacto]";
  return {
    ...empty,
    footer: { company, email, phone: "", address: "" },
    privacy: { ...empty.privacy, text: privacyText(company, email) },
    // Most leads of this business start on WhatsApp: it asks for the number
    whatsapp: {
      ...empty.whatsapp,
      enabled: true,
      label: "Escribinos",
      popupText: "Dejanos tu nombre y número, y abrimos el chat.",
    },
    ...overrides,
  };
};

const consent = (brand: LandingBrand) => ({
  enabled: true,
  text: `Acepto recibir correos de ${brand.company?.trim() || "[COMPLETAR: nombre de tu empresa]"} sobre esta propuesta. Puedo darme de baja cuando quiera.`,
});

const palette = (
  primary: string,
  color: string,
  color2: string,
  extra: Partial<LandingContent["design"]> = {},
): LandingContent["design"] => ({
  ...createEmptyLandingContent().design,
  ...extra,
  primaryColor: primary,
  background: {
    type: "gradient" as const,
    color,
    color2,
    imageUrl: "",
    overlay: 50,
  },
});

const followUp = (interest: string) => ({
  ...createEmptyLandingContent().automation,
  taskTitle: `Contactar (${interest})`,
});

const buildTraining = (brand: LandingBrand): LandingContent =>
  base(brand, {
    design: palette("#0f766e", "#0f766e", "#115e59", {
      font: "poppins",
      radius: "round",
    }),
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Formación en Recursos Humanos",
      title: "Aprendé a liderar personas con herramientas que se usan el lunes",
      subtitle:
        "[COMPLETAR: nombre del programa, a quién va dirigido y qué va a poder hacer al terminar]",
      imageUrl: "",
      highlights: [
        "[COMPLETAR: modalidad, por ejemplo en línea y en vivo]",
        "[COMPLETAR: duración]",
        "[COMPLETAR: qué certificado recibe]",
      ],
      ctaLabel: "Reservar mi lugar",
    },
    sections: [
      newLandingSection("benefits", {
        title: "Qué te vas a llevar",
        items: [
          item(
            "[COMPLETAR: primer tema del programa]",
            "[COMPLETAR: qué va a poder hacer quien lo curse]",
          ),
          item(
            "[COMPLETAR: segundo tema del programa]",
            "[COMPLETAR: qué va a poder hacer quien lo curse]",
          ),
          item(
            "[COMPLETAR: tercer tema del programa]",
            "[COMPLETAR: qué va a poder hacer quien lo curse]",
          ),
        ],
      }),
      newLandingSection("modules", {
        title: "Programa",
        text: "[COMPLETAR: cómo está organizado el programa]",
      }),
      newLandingSection("video", { enabled: false }),
      newLandingSection("stats", { enabled: false }),
      newLandingSection("about", {
        title: "Quiénes te acompañan",
        text: "[COMPLETAR: quién dicta el programa y su experiencia]",
      }),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("pricing", { enabled: false }),
      newLandingSection("faq", {
        items: [
          item(
            "¿Cuánto dura y cómo se cursa?",
            "[COMPLETAR: duración y modalidad]",
          ),
          item("¿Qué incluye?", "[COMPLETAR: material, clases y certificado]"),
          item(
            "¿Necesito experiencia previa?",
            "[COMPLETAR: requisitos de ingreso]",
          ),
        ],
      }),
      newLandingSection("cta", {
        title: "Dá el primer paso",
        text: "Dejanos tus datos y te enviamos el programa completo y las fechas de inicio.",
        ctaLabel: "Reservar mi lugar",
      }),
    ],
    form: {
      title: "Reservá tu lugar",
      intro: "Dejanos tus datos y te contamos todos los detalles.",
      submitLabel: "Reservar mi lugar",
      fields: [
        ...contactFields(),
        field("Empresa", "text", "company"),
        field("Cargo", "text", "title"),
        field("¿Cómo preferís cursar?", "radio", "answer", false, [
          "En línea",
          "Presencial",
          "Todavía no lo sé",
        ]),
      ],
      consent: consent(brand),
    },
    automation: followUp("interés en formación"),
  });

const buildRecruiting = (brand: LandingBrand): LandingContent =>
  base(brand, {
    design: palette("#2563eb", "#1d4ed8", "#0f172a", {
      font: "inter",
      radius: "square",
    }),
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Selección de personal",
      title: "Cubrí tu vacante con la persona que encaja",
      subtitle:
        "[COMPLETAR: qué tipo de búsquedas hacen y en qué se diferencian]",
      imageUrl: "",
      highlights: [
        "Definimos el perfil con vos",
        "Filtramos y entrevistamos por vos",
        "Te acompañamos en la decisión",
      ],
      ctaLabel: "Abrir una búsqueda",
    },
    sections: [
      newLandingSection("steps", {
        title: "Cómo trabajamos",
        items: [
          item(
            "Entendemos lo que necesitás",
            "Definimos juntos el perfil, las tareas y la cultura de tu empresa.",
          ),
          item(
            "Evaluamos a los candidatos",
            "Filtramos y entrevistamos para que llegues solo a los que encajan.",
          ),
          item(
            "Te acompañamos en la decisión",
            "Compartimos nuestra evaluación y seguimos cerca durante la incorporación.",
          ),
        ],
      }),
      newLandingSection("stats", { enabled: false }),
      newLandingSection("faq", {
        items: [
          item("¿Cuánto tarda una búsqueda?", "[COMPLETAR: plazos habituales]"),
          item("¿Cómo se paga el servicio?", "[COMPLETAR: modalidad de pago]"),
          item(
            "¿Qué pasa si el candidato no funciona?",
            "[COMPLETAR: garantía o política de reemplazo]",
          ),
        ],
      }),
      newLandingSection("about"),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("benefits", { enabled: false }),
      newLandingSection("cta", {
        title: "¿Tenés una búsqueda abierta?",
        text: "Contanos qué necesitás y te respondemos para conversarlo.",
        ctaLabel: "Abrir una búsqueda",
      }),
    ],
    form: {
      title: "Contanos qué buscás",
      intro: "Te respondemos para conversar sobre tu búsqueda.",
      submitLabel: "Abrir una búsqueda",
      fields: [
        ...contactFields(),
        field("Empresa", "text", "company", true),
        field("Cargo", "text", "title"),
        field("¿Qué perfil buscás?", "text", "answer", true),
        field("¿Cuántas personas necesitás?", "select", "answer", false, [
          "1",
          "2 a 5",
          "Más de 5",
        ]),
      ],
      consent: consent(brand),
    },
    automation: followUp("interés en selección"),
  });

const buildConsulting = (brand: LandingBrand): LandingContent =>
  base(brand, {
    design: palette("#7c3aed", "#4c1d95", "#1e1b4b", {
      font: "lora",
      radius: "soft",
      formPosition: "below",
    }),
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Consultoría de Recursos Humanos",
      title: "Ordená la gestión de personas antes de que se vuelva un problema",
      subtitle: "[COMPLETAR: qué problema resuelven y para qué empresas]",
      imageUrl: "",
      highlights: [],
      ctaLabel: "Agendar una conversación",
    },
    sections: [
      newLandingSection("about", {
        title: "Por qué trabajar con nosotros",
        text: "[COMPLETAR: enfoque y experiencia del equipo consultor]",
      }),
      newLandingSection("benefits", {
        title: "En qué te ayudamos",
        items: [
          item(
            "Diagnóstico",
            "Revisamos cómo funciona hoy tu área de personas y qué conviene priorizar.",
          ),
          item(
            "Procesos claros",
            "Ordenamos ingresos, evaluaciones y comunicación interna.",
          ),
          item(
            "Acompañamiento",
            "Ayudamos a tu equipo a poner en marcha los cambios.",
          ),
        ],
      }),
      newLandingSection("steps", {
        title: "Cómo es trabajar juntos",
        items: [
          item(
            "Conversamos",
            "Nos contás qué te preocupa y cómo está tu equipo.",
          ),
          item("Diagnosticamos", "[COMPLETAR: cómo hacen el diagnóstico]"),
          item("Ponemos en marcha", "[COMPLETAR: cómo acompañan los cambios]"),
        ],
      }),
      newLandingSection("pricing", { enabled: false }),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("faq", {
        items: [
          item("¿Cómo empezamos?", "[COMPLETAR: primer paso del trabajo]"),
          item(
            "¿Con qué tamaño de empresa trabajan?",
            "[COMPLETAR: tipo de clientes]",
          ),
        ],
      }),
    ],
    form: {
      title: "Conversemos sobre tu empresa",
      intro: "Contanos brevemente qué necesitás.",
      submitLabel: "Agendar una conversación",
      fields: [
        ...contactFields(),
        field("Empresa", "text", "company", true),
        field("Cargo", "text", "title"),
        field("¿Cuántas personas trabajan?", "select", "answer", false, [
          "1 a 10",
          "11 a 50",
          "51 a 200",
          "Más de 200",
        ]),
        field("¿Qué querés resolver?", "textarea", "message"),
      ],
      consent: consent(brand),
    },
    automation: followUp("interés en consultoría"),
  });

/**
 * A pure catalog: the business name, the products, the cart and the data form.
 * Nothing here promises shipping, support, payment or returns, because the
 * client who owns the shop decides that. The marketing sections exist but start
 * hidden, so the client can turn on the ones they want.
 */
const buildSales = (brand: LandingBrand): LandingContent => {
  const empty = createEmptyLandingContent();
  const shop = brand.company?.trim() || "[COMPLETAR: nombre de tu tienda]";
  const draft = base(brand, {
    design: palette("#c2410c", "#c2410c", "#be123c", {
      font: "montserrat",
      radius: "round",
    }),
    // Only the name: no eyebrow, subtitle or highlights
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "",
      title: shop,
      subtitle: "",
      imageUrl: "",
      highlights: [],
      ctaLabel: "Ver catálogo",
    },
    sections: [
      newLandingSection("about", { enabled: false }),
      newLandingSection("benefits", { enabled: false }),
      newLandingSection("steps", { enabled: false }),
      newLandingSection("stats", { enabled: false }),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("pricing", { enabled: false }),
      newLandingSection("faq", { enabled: false }),
      newLandingSection("cta", { enabled: false }),
    ],
    // The block of products brings its own titles («Catálogo», «Tus datos»)
    form: {
      title: "",
      intro: "",
      submitLabel: "Enviar consulta",
      fields: [
        field("Nombre y apellido", "text", "full_name", true),
        field("WhatsApp", "phone", "phone", true),
        field("Aclaraciones", "textarea", "message"),
      ],
      consent: {
        enabled: true,
        text: `Acepto que ${shop} me contacte por WhatsApp por este pedido o consulta.`,
      },
    },
    thanks: { ...empty.thanks, message: "Recibimos tus datos." },
    automation: {
      ...empty.automation,
      taskTitle: "Atender pedido o consulta",
    },
    carrito: {
      activo: true,
      productoIds: [],
      telefonoWhatsapp: "",
      plantillaMensaje: empty.carrito.plantillaMensaje,
      tituloBoton: empty.carrito.tituloBoton,
      // The shop decides how it delivers: the order starts as «a coordinar»
      entrega: "ninguna",
    },
  });
  // The name is the shop's everywhere it shows
  return {
    ...draft,
    footer: { ...draft.footer, company: shop },
    privacy: {
      ...draft.privacy,
      text: privacyText(shop, draft.footer.email),
    },
  };
};

export const LANDING_TEMPLATES: {
  id: string;
  build: (brand: LandingBrand) => LandingContent;
}[] = [
  { id: "training", build: buildTraining },
  { id: "recruiting", build: buildRecruiting },
  { id: "consulting", build: buildConsulting },
  { id: "ventas", build: buildSales },
];

export const buildLandingTemplate = (
  id: string | undefined,
  brand: LandingBrand = {},
) =>
  (
    LANDING_TEMPLATES.find((template) => template.id === id) ??
    LANDING_TEMPLATES[0]
  ).build(brand);
