import {
  CircleDollarSign,
  CircleHelp,
  Hash,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Megaphone,
  MessageSquareQuote,
  PlayCircle,
  Sparkles,
  Users,
} from "lucide-react";

import {
  createLandingSection,
  type LandingSection,
  type LandingSectionItem,
  type LandingSectionType,
} from "./pagina/schema.ts";

/** Which fields of a section mean something for each type. */
export interface LandingSectionShape {
  icon: LucideIcon;
  text?: boolean;
  image?: boolean;
  video?: boolean;
  cta?: boolean;
  item?: { subtitle?: boolean; text?: boolean };
}

export const LANDING_SECTION_SHAPES: Record<
  LandingSectionType,
  LandingSectionShape
> = {
  benefits: { icon: Sparkles, text: true, item: { text: true } },
  steps: { icon: ListOrdered, text: true, item: { text: true } },
  modules: {
    icon: ListChecks,
    text: true,
    item: { subtitle: true, text: true },
  },
  stats: { icon: Hash, item: { subtitle: true } },
  testimonials: {
    icon: MessageSquareQuote,
    text: true,
    item: { subtitle: true, text: true },
  },
  pricing: {
    icon: CircleDollarSign,
    text: true,
    cta: true,
    item: { subtitle: true, text: true },
  },
  video: { icon: PlayCircle, text: true, video: true },
  about: { icon: Users, text: true, image: true },
  faq: { icon: CircleHelp, text: true, item: { text: true } },
  cta: { icon: Megaphone, text: true, cta: true },
};

export const newLandingItemId = (prefix: string) =>
  `${prefix}${crypto.randomUUID().slice(0, 8)}`;

const item = (title: string, text = "", subtitle = ""): LandingSectionItem => ({
  title,
  subtitle,
  text,
});

/** What a new section starts with. Nothing invented: facts are left to complete. */
const STARTERS: Record<
  LandingSectionType,
  Partial<Pick<LandingSection, "title" | "text" | "items" | "ctaLabel">>
> = {
  benefits: {
    title: "Qué vas a lograr",
    items: [
      item(
        "[COMPLETAR: primer beneficio]",
        "[COMPLETAR: explícalo en una línea]",
      ),
      item(
        "[COMPLETAR: segundo beneficio]",
        "[COMPLETAR: explícalo en una línea]",
      ),
      item(
        "[COMPLETAR: tercer beneficio]",
        "[COMPLETAR: explícalo en una línea]",
      ),
    ],
  },
  steps: {
    title: "Cómo funciona",
    items: [
      item(
        "Déjanos tus datos",
        "Completa el formulario en menos de un minuto.",
      ),
      item("Te contactamos", "Conversamos sobre lo que necesitas."),
      item("Empiezas", "[COMPLETAR: cuál es el siguiente paso]"),
    ],
  },
  modules: {
    title: "Programa",
    items: [
      item("[COMPLETAR: módulo 1]", "[COMPLETAR: qué se ve]"),
      item("[COMPLETAR: módulo 2]", "[COMPLETAR: qué se ve]"),
    ],
  },
  stats: {
    items: [
      item("[COMPLETAR: cifra real]", "", "[COMPLETAR: qué mide]"),
      item("[COMPLETAR: cifra real]", "", "[COMPLETAR: qué mide]"),
      item("[COMPLETAR: cifra real]", "", "[COMPLETAR: qué mide]"),
    ],
  },
  testimonials: {
    title: "Lo que dicen quienes ya pasaron por aquí",
    items: [
      item(
        "[COMPLETAR: nombre real]",
        "[COMPLETAR: testimonio real, con su permiso]",
        "[COMPLETAR: cargo y empresa]",
      ),
      item(
        "[COMPLETAR: nombre real]",
        "[COMPLETAR: testimonio real, con su permiso]",
        "[COMPLETAR: cargo y empresa]",
      ),
    ],
  },
  pricing: {
    title: "Inversión",
    items: [
      item(
        "[COMPLETAR: nombre del plan]",
        "[COMPLETAR: qué incluye]\n[COMPLETAR: qué más incluye]",
        "[COMPLETAR: precio]",
      ),
    ],
  },
  video: { title: "Míralo en un minuto" },
  about: {
    title: "Quiénes somos",
    text: "[COMPLETAR: quiénes son y por qué elegirlos]",
  },
  faq: {
    title: "Preguntas frecuentes",
    items: [item("[COMPLETAR: pregunta]", "[COMPLETAR: respuesta]")],
  },
  cta: {
    title: "¿Conversamos?",
    text: "Déjanos tus datos y te contamos todos los detalles.",
  },
};

export const newLandingSection = (
  type: LandingSectionType,
  overrides: Partial<LandingSection> = {},
): LandingSection => ({
  ...createLandingSection(type, newLandingItemId("s")),
  ...STARTERS[type],
  ...overrides,
});

export const emptyLandingItem = (): LandingSectionItem => item("");
