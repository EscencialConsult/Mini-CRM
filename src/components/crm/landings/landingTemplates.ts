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
  `${company} es responsable de los datos que nos dejas en esta página.

Qué datos guardamos: los que completas en el formulario y la fecha en que lo enviaste.

Para qué los usamos: para responder tu consulta y enviarte información sobre lo que pediste.

Quién los ve: solo nuestro equipo. No vendemos, alquilamos ni compartimos tus datos con otras empresas.

Cómo darte de baja: cada correo trae un enlace para dejar de recibirlos. También puedes pedir que corrijamos o borremos tus datos escribiendo a ${email}.

Más información: [COMPLETAR: revisa este texto según la ley de tu país].`;

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
    whatsapp: { ...empty.whatsapp, enabled: true },
    ...overrides,
  };
};

const consent = (brand: LandingBrand) => ({
  enabled: true,
  text: `Acepto recibir correos de ${brand.company?.trim() || "[COMPLETAR: nombre de tu empresa]"} sobre esta propuesta. Puedo darme de baja cuando quiera.`,
});

const palette = (primary: string, color: string, color2: string) => ({
  ...createEmptyLandingContent().design,
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
    design: palette("#0f766e", "#0f766e", "#134e4a"),
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Formación en Recursos Humanos",
      title: "[COMPLETAR: nombre del programa]",
      subtitle:
        "[COMPLETAR: a quién va dirigido y qué va a poder hacer al terminar]",
      imageUrl: "",
      highlights: [
        "[COMPLETAR: modalidad, por ejemplo en línea y en vivo]",
        "[COMPLETAR: duración]",
        "[COMPLETAR: qué certificado recibe]",
      ],
      ctaLabel: "Quiero información",
    },
    sections: [
      newLandingSection("stats", { enabled: false }),
      newLandingSection("benefits", {
        title: "Qué vas a aprender",
        items: [
          item(
            "Selección y entrevistas",
            "Definir perfiles, evaluar candidatos y decidir con criterio.",
          ),
          item(
            "Gestión del desempeño",
            "Fijar objetivos claros y dar devoluciones que ayuden a mejorar.",
          ),
          item(
            "Clima y cultura",
            "Medir cómo está el equipo y actuar sobre lo que encuentres.",
          ),
        ],
      }),
      newLandingSection("modules"),
      newLandingSection("steps"),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("pricing", { enabled: false }),
      newLandingSection("video", { enabled: false }),
      newLandingSection("about"),
      newLandingSection("faq", {
        items: [
          item(
            "¿Cuánto dura y cómo se cursa?",
            "[COMPLETAR: duración y modalidad]",
          ),
          item("¿Qué incluye?", "[COMPLETAR: material, clases y certificado]"),
        ],
      }),
      newLandingSection("cta", {
        title: "¿Te quedan dudas?",
        text: "Déjanos tus datos y te contamos todos los detalles.",
      }),
    ],
    form: {
      title: "Quiero más información",
      intro: "Déjanos tus datos y te contamos todos los detalles.",
      submitLabel: "Quiero información",
      fields: [
        ...contactFields(),
        field("Empresa", "text", "company"),
        field("Cargo", "text", "title"),
        field("¿Cómo prefieres cursar?", "radio", "answer", false, [
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
    design: palette("#1d4ed8", "#1e40af", "#172554"),
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Selección de personal",
      title: "Encuentra a la persona indicada para tu equipo",
      subtitle:
        "[COMPLETAR: qué tipo de búsquedas hacen y en qué se diferencian]",
      imageUrl: "",
      highlights: [
        "Definimos el perfil contigo",
        "Filtramos y entrevistamos por ti",
        "Te acompañamos en la decisión",
      ],
      ctaLabel: "Quiero que me contacten",
    },
    sections: [
      newLandingSection("stats", { enabled: false }),
      newLandingSection("steps", {
        title: "Cómo trabajamos",
        items: [
          item(
            "Entendemos lo que necesitas",
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
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("about"),
      newLandingSection("faq", {
        items: [
          item("¿Cuánto tarda una búsqueda?", "[COMPLETAR: plazos habituales]"),
          item("¿Cómo se paga el servicio?", "[COMPLETAR: modalidad de pago]"),
        ],
      }),
      newLandingSection("cta", {
        title: "¿Tienes una búsqueda abierta?",
        text: "Cuéntanos qué necesitas y te respondemos para conversarlo.",
      }),
    ],
    form: {
      title: "Cuéntanos qué buscas",
      intro: "Te respondemos para conversar sobre tu búsqueda.",
      submitLabel: "Quiero que me contacten",
      fields: [
        ...contactFields(),
        field("Empresa", "text", "company", true),
        field("Cargo", "text", "title"),
        field("¿Qué perfil buscas?", "text", "answer", true),
        field("¿Cuántas personas necesitas?", "select", "answer", false, [
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
    design: {
      ...palette("#4338ca", "#312e81", "#1e1b4b"),
      formPosition: "below",
    },
    hero: {
      logoUrl: brand.logoUrl ?? "",
      eyebrow: "Consultoría de Recursos Humanos",
      title: "Ordena la gestión de personas de tu empresa",
      subtitle: "[COMPLETAR: qué problema resuelven y para qué empresas]",
      imageUrl: "",
      highlights: [],
      ctaLabel: "Quiero conversar",
    },
    sections: [
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
        items: [
          item(
            "Conversamos",
            "Nos cuentas qué te preocupa y cómo está tu equipo.",
          ),
          item("Diagnosticamos", "[COMPLETAR: cómo hacen el diagnóstico]"),
          item("Ponemos en marcha", "[COMPLETAR: cómo acompañan los cambios]"),
        ],
      }),
      newLandingSection("testimonials", { enabled: false }),
      newLandingSection("about"),
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
      intro: "Cuéntanos brevemente qué necesitas.",
      submitLabel: "Quiero conversar",
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
        field("¿Qué quieres resolver?", "textarea", "message"),
      ],
      consent: consent(brand),
    },
    automation: followUp("interés en consultoría"),
  });

export const LANDING_TEMPLATES: {
  id: string;
  build: (brand: LandingBrand) => LandingContent;
}[] = [
  { id: "training", build: buildTraining },
  { id: "recruiting", build: buildRecruiting },
  { id: "consulting", build: buildConsulting },
];

export const buildLandingTemplate = (
  id: string | undefined,
  brand: LandingBrand = {},
) =>
  (
    LANDING_TEMPLATES.find((template) => template.id === id) ??
    LANDING_TEMPLATES[0]
  ).build(brand);
