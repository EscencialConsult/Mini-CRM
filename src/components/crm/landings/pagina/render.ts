import {
  isFacebookPixelId,
  isGoogleTagId,
  isHttpUrl,
  LANDING_FONTS,
  LANDING_RADII,
  type LandingContent,
  type LandingField,
  type LandingSection,
  landingPath,
  landingPrivacyPath,
  phoneDigits,
  videoEmbedUrl,
} from "./schema.ts";

/**
 * Turns a landing into its HTML. The CRM preview and the published page both
 * come from here, so what the admin sees is what visitors get. No dependencies,
 * and no HTML from the content: every text is escaped and every link checked.
 */
export interface RenderOptions {
  /** The landing's path, which its own links point to */
  slug: string;
  /** Where the form posts: the landing_recibir function of the database */
  submitUrl: string;
  /** The publishable key: public, the database decides what it allows. Not in previews */
  apiKey?: string;
  /** Inside the editor: no script and no tracking, the form sends nothing */
  preview?: boolean;
  /**
   * The editor's canvas, a preview too: every text says where it is stored,
   * and what is empty or hidden is still drawn so it can be filled in place.
   */
  editable?: boolean;
}

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type Mark = string | number | boolean | undefined;

/** `data-*` attributes for the canvas; a page that is not edited gets none. */
const marks = (editable: boolean, data: Record<string, Mark>) =>
  editable
    ? Object.entries(data)
        .filter(([, value]) => value !== undefined && value !== false)
        .map(([key, value]) =>
          value === true
            ? ` data-${key}`
            : ` data-${key}="${esc(String(value))}"`,
        )
        .join("")
    : "";

/** A text edited on one line. */
const editLine = (editable: boolean, path: string) =>
  marks(editable, { edit: path });

/** A text edited with its line breaks: paragraphs, a subtitle, an address. */
const editBlock = (editable: boolean, path: string) =>
  marks(editable, { edit: path, multi: true });

/** A spot of the canvas to put an image or a video in. */
const emptySlot = (kind: "image" | "video", path: string, className = "") =>
  `<div class="ed-slot${className}" data-${kind}="${esc(path)}"></div>`;

const safeUrl = (value: string) =>
  isHttpUrl(value.trim()) ? value.trim() : "";

/** A paragraph per blank line; single line breaks are kept. */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** The same paragraphs; on the canvas, one text to edit. */
const textBody = (text: string, editable: boolean, path: string) =>
  editable
    ? `<div${editBlock(true, path)}>${paragraphs(text)}</div>`
    : paragraphs(text);

/** White or near-black, whichever reads better on this background. */
const textOn = (hex: string) => {
  const channel = (start: number) => parseInt(hex.slice(start, start + 2), 16);
  const luminance =
    (0.299 * channel(1) + 0.587 * channel(3) + 0.114 * channel(5)) / 255;
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
};

const CHECK_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
const WHATSAPP_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.5 15l-1.4 5 5.1-1.3A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3a8.2 8.2 0 1 1 6.9 3.8Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1-.8-.3-1.5-.7-2.1-1.3-.6-.5-1.1-1.2-1.4-1.9-.1-.2 0-.4.1-.5l.4-.5.3-.4v-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.6.6-.9 1.4-.9 2.2.1 1 .5 1.9 1.1 2.7 1.1 1.7 2.6 3 4.5 3.8.5.2 1 .4 1.5.5.6.2 1.1.1 1.6.1.6-.1 1.1-.5 1.5-1 .2-.4.2-.9.2-1 0-.1-.2-.2-.4-.3Z"/></svg>`;

const heroBackground = ({ design }: LandingContent) => {
  const { type, color, color2, imageUrl, overlay } = design.background;
  const image = safeUrl(imageUrl);
  if (type === "image" && image) {
    const shade = overlay / 100;
    return {
      css: `linear-gradient(rgba(0,0,0,${shade}),rgba(0,0,0,${shade})),url("${encodeURI(image).replace(/"/g, "%22")}") center/cover no-repeat`,
      text: "#ffffff",
    };
  }
  if (type === "gradient") {
    return {
      css: `linear-gradient(135deg,${color},${color2})`,
      text: textOn(color),
    };
  }
  return { css: color, text: textOn(color) };
};

const styles = (content: LandingContent) => {
  const background = heroBackground(content);
  const { primaryColor, font, radius } = content.design;
  const heroIsDark = background.text === "#ffffff";
  return `
:root{--primary:${primaryColor};--on-primary:${textOn(primaryColor)};--hero-text:${background.text};--hero-btn:${heroIsDark ? "#ffffff" : primaryColor};--hero-btn-text:${heroIsDark ? "#0f172a" : textOn(primaryColor)};--radius:${LANDING_RADII[radius]}px;--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--tint:#f6f8fa;--tint:color-mix(in srgb,var(--primary) 5%,#fff);--tint-strong:#eef2f6;--tint-strong:color-mix(in srgb,var(--primary) 13%,#fff)}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:84px}
body{margin:0;font-family:${LANDING_FONTS[font].family};color:var(--ink);background:#fff;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%;height:auto;display:block}
a{color:var(--primary)}
h1,h2,h3{line-height:1.15;margin:0;letter-spacing:-.015em}
p{margin:0 0 1em}
p:last-child{margin-bottom:0}
.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
.narrow{max-width:780px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 26px;border:0;border-radius:var(--radius);background:var(--primary);color:var(--on-primary);font:inherit;font-weight:700;line-height:1.25;text-align:center;text-decoration:none;cursor:pointer;transition:filter .15s,transform .15s}
.btn:hover{filter:brightness(1.08)}
.btn:active{transform:translateY(1px)}
.btn:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.btn-sm{padding:9px 16px;font-size:.92rem}
.btn-on-dark{background:#fff;color:#0f172a}
.top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:66px}
.brand{font-weight:800;font-size:1.05rem;color:var(--ink);text-decoration:none}
.brand img{max-height:40px;width:auto}
.hero{background:${background.css};color:var(--hero-text)}
.hero-inner{display:grid;gap:40px;padding-top:56px;padding-bottom:64px}
.eyebrow{font-size:.84rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.86;margin:0 0 14px}
.hero h1{font-size:clamp(2.1rem,4.4vw,3.35rem);font-weight:800}
.subtitle{font-size:clamp(1.05rem,1.6vw,1.22rem);margin:18px 0 0;opacity:.93;white-space:pre-line;max-width:60ch}
.highlights{list-style:none;padding:0;margin:26px 0 0;display:grid;gap:10px}
.highlights li{display:flex;gap:10px;align-items:flex-start;font-weight:600}
.highlights svg{flex:none;margin-top:3px}
.hero-image{border-radius:var(--radius);margin-top:32px;box-shadow:0 22px 50px rgba(15,23,42,.25)}
.hero-btn{margin-top:30px;background:var(--hero-btn);color:var(--hero-btn-text)}
.centered{text-align:center}
.centered .hero-copy{max-width:800px;margin:0 auto}
.centered .subtitle{margin-inline:auto}
.centered .highlights{display:flex;flex-wrap:wrap;justify-content:center;gap:10px 26px}
.centered .hero-image{margin-inline:auto}
.card{background:#fff;color:var(--ink);border-radius:calc(var(--radius) + 4px);padding:28px;box-shadow:0 24px 60px rgba(15,23,42,.22);text-align:left}
.card h2{font-size:1.35rem;font-weight:800;margin-bottom:6px}
.intro{color:var(--muted);margin:0 0 18px}
.fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 12px;margin-bottom:16px}
.fields>*{grid-column:span 2;min-width:0}
.fields>.half{grid-column:span 1}
.field{display:block}
.field-label{display:block;font-weight:600;font-size:.88rem;margin-bottom:5px}
.req{color:#b91c1c}
input[type=text],input[type=email],input[type=tel],select,textarea{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:max(6px,calc(var(--radius) - 4px));font:inherit;color:inherit;background:#fff}
input:focus,select:focus,textarea:focus{outline:2px solid var(--primary);outline-offset:1px;border-color:transparent}
textarea{min-height:88px;resize:vertical}
fieldset{border:0;padding:0;margin:0}
legend{padding:0}
.choice{display:flex;align-items:flex-start;gap:8px;margin-top:6px;font-size:.95rem}
.choice input{margin-top:5px;accent-color:var(--primary)}
.consent{font-size:.82rem;color:var(--muted);margin:0 0 16px}
.trap{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.send{width:100%}
.send:disabled{opacity:.6;cursor:wait}
.error{color:#b91c1c;font-size:.9rem;margin:0 0 12px}
.section{padding:72px 0}
.tint{background:var(--tint)}
.head{max-width:720px;margin-bottom:36px}
.head h2{font-size:clamp(1.6rem,3vw,2.25rem);font-weight:800}
.head p{color:var(--muted);margin-top:10px;font-size:1.06rem}
.cards{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(250px,1fr))}
.item{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:24px}
.item h3{font-size:1.08rem;font-weight:700;margin-bottom:8px}
.item p{color:var(--muted);font-size:.97rem}
.icon{display:inline-flex;width:38px;height:38px;border-radius:50%;align-items:center;justify-content:center;background:var(--tint-strong);color:var(--primary);margin-bottom:14px}
.steps{list-style:none;counter-reset:step;padding:0;margin:0;display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
.steps li{counter-increment:step}
.steps li::before{content:counter(step);display:flex;width:42px;height:42px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-weight:800;align-items:center;justify-content:center;margin-bottom:14px}
.steps h3{font-size:1.08rem;font-weight:700;margin-bottom:6px}
.steps p{color:var(--muted);font-size:.97rem}
.module{background:#fff;border:1px solid var(--line);border-radius:var(--radius);margin-bottom:10px}
.module summary{display:flex;gap:14px;align-items:baseline;padding:16px 20px;cursor:pointer;font-weight:700;list-style:none}
.module summary::-webkit-details-marker{display:none}
.num{color:var(--primary);font-variant-numeric:tabular-nums}
.meta{margin-left:auto;color:var(--muted);font-size:.875rem;font-weight:500;white-space:nowrap}
.module-body{padding:0 20px 18px;color:var(--muted)}
.band{background:var(--primary);color:var(--on-primary)}
.stats-row{display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));text-align:center}
.stats-band{background:var(--tint-strong);padding:44px 0}
.stats-band .head{margin-inline:auto;text-align:center}
.stat b{display:block;font-size:clamp(2rem,4vw,3rem);font-weight:800;line-height:1.1;margin-bottom:6px;color:var(--primary)}
.stat span{color:var(--muted)}
figure{margin:0}
.quote{display:flex;flex-direction:column;gap:16px}
.quote blockquote{margin:0;font-size:1.02rem}
.quote figcaption{margin-top:auto;font-size:.92rem}
.quote figcaption b{display:block}
.quote figcaption span{color:var(--muted)}
.plans{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,360px));align-items:stretch}
.plan{display:flex;flex-direction:column;gap:14px}
.plan h3{margin:0}
.price{font-size:1.9rem;font-weight:800;line-height:1.1}
.plan ul{list-style:none;padding:0;margin:0 0 6px;display:grid;gap:8px;color:var(--muted);font-size:.96rem}
.plan li{display:flex;gap:8px;align-items:flex-start}
.plan li svg{flex:none;color:var(--primary);margin-top:2px;width:18px;height:18px}
.plan .btn{margin-top:auto}
.video{position:relative;aspect-ratio:16/9;border-radius:var(--radius);overflow:hidden;background:#0f172a}
.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.split{display:grid;gap:40px;align-items:center}
.split img{border-radius:var(--radius)}
.split p{color:var(--muted)}
.faq-item{border-bottom:1px solid var(--line);padding:16px 0}
.faq-item summary{cursor:pointer;font-weight:700}
.faq-item p{margin-top:10px;color:var(--muted)}
.final{text-align:center}
.final h2{font-size:clamp(1.6rem,3vw,2.25rem);font-weight:800}
.final p{margin:12px auto 0;max-width:60ch;opacity:.92}
.final .btn{margin-top:26px}
.form-below{max-width:600px;margin:0 auto}
.form-below .card{box-shadow:0 16px 44px rgba(15,23,42,.12);border:1px solid var(--line)}
footer{background:#0f172a;color:#cbd5e1;padding:36px 0;font-size:.9rem}
footer a{color:#fff}
.footer-row{display:flex;flex-wrap:wrap;gap:8px 22px;justify-content:space-between}
.footer-row span{white-space:pre-line}
.sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:15;padding:10px 16px;background:#fff;border-top:1px solid var(--line);display:none;transition:transform .2s}
.sticky-cta.away{transform:translateY(110%)}
.sticky-cta .btn{width:100%;padding:12px 20px}
.wa{position:fixed;right:20px;bottom:20px;z-index:16;display:inline-flex;align-items:center;gap:10px;background:#25d366;color:#07361f;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none;box-shadow:0 10px 28px rgba(15,23,42,.28)}
.wa svg{width:24px;height:24px}
.wa-dialog{border:0;border-radius:calc(var(--radius) + 4px);padding:24px;width:min(400px,calc(100vw - 32px));color:var(--ink);box-shadow:0 30px 70px rgba(15,23,42,.35)}
.wa-dialog::backdrop{background:rgba(15,23,42,.55)}
.wa-dialog h2{font-size:1.2rem;font-weight:800;margin-bottom:4px}
.wa-dialog p{color:var(--muted);font-size:.94rem;margin:0 0 14px}
.wa-dialog .field{margin-bottom:12px}
.wa-send{width:100%;background:#25d366;color:#07361f}
.wa-close{float:right;border:0;background:none;font-size:1.4rem;line-height:1;color:var(--muted);cursor:pointer;padding:0 0 0 12px}
.wa-note{display:block;font-size:.78rem;color:var(--muted);margin-top:10px}
@media (min-width:900px){
.hero-inner.side{grid-template-columns:minmax(0,1.1fr) minmax(0,480px);align-items:center;gap:56px;padding-top:72px;padding-bottom:88px}
.split.with-image{grid-template-columns:1.2fr 1fr}
}
@media (max-width:899px){
.sticky-cta{display:block}
body{padding-bottom:72px}
.wa{bottom:84px;right:14px;padding:14px}
.wa span{display:none}
.section{padding:52px 0}
}
@media (max-width:460px){
.fields>.half{grid-column:span 2}
.card{padding:22px}
}
`;
};

const head = (content: LandingContent, title: string, description: string) => {
  const font = LANDING_FONTS[content.design.font].google;
  const image = safeUrl(content.seo.imageUrl || content.hero.imageUrl);
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ""}
<meta property="og:title" content="${esc(title)}">
${description ? `<meta property="og:description" content="${esc(description)}">` : ""}
${image ? `<meta property="og:image" content="${esc(image)}">` : ""}
${font ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${font}&display=swap">` : ""}
<style>${styles(content)}</style>`;
};

/** Short answers share a row, so a long questionnaire does not tower over the page. */
const SHORT_TARGETS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "company",
  "title",
];
const isShortField = (field: LandingField) =>
  SHORT_TARGETS.includes(field.target) &&
  ["text", "email", "phone"].includes(field.type);

const halfWidthFields = (fields: LandingField[]) => {
  const half = new Set<string>();
  for (let index = 0; index < fields.length - 1; index++) {
    if (isShortField(fields[index]) && isShortField(fields[index + 1])) {
      half.add(fields[index].id);
      half.add(fields[index + 1].id);
      index++;
    }
  }
  return half;
};

/** On the canvas `index` is set: its label is edited there and it is no <label>. */
const renderField = (field: LandingField, half: boolean, index?: number) => {
  const editable = index !== undefined;
  const required = field.required ? " required" : "";
  const mark = field.required ? ' <span class="req">*</span>' : "";
  const name = esc(field.id);
  const label = editable
    ? `<span${editLine(true, `form.fields.${index}.label`)}>${esc(field.label)}</span>${mark}`
    : `${esc(field.label)}${mark}`;
  const options = field.options.filter((option) => option.trim());
  const fieldMark = marks(editable, { field: index });
  const tag = editable ? "div" : "label";

  if (field.type === "radio" || field.type === "checkbox") {
    const choices = options
      .map(
        (option) =>
          `<label class="choice"><input type="${field.type}" name="${name}" value="${esc(option)}"${field.type === "radio" ? required : ""}><span>${esc(option)}</span></label>`,
      )
      .join("");
    return `<fieldset${fieldMark}><legend class="field-label">${label}</legend>${choices}</fieldset>`;
  }
  const open = `<${tag} class="field${half ? " half" : ""}"${fieldMark}><span class="field-label">${label}</span>`;
  if (field.type === "select") {
    const choices = options
      .map((option) => `<option value="${esc(option)}">${esc(option)}</option>`)
      .join("");
    return `${open}<select name="${name}"${required}><option value="">Elige una opción</option>${choices}</select></${tag}>`;
  }
  if (field.type === "textarea") {
    return `${open}<textarea name="${name}"${required}></textarea></${tag}>`;
  }
  const inputType =
    field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  const autocomplete: Record<string, string> = {
    full_name: "name",
    first_name: "given-name",
    last_name: "family-name",
    email: "email",
    phone: "tel",
    company: "organization",
    title: "organization-title",
  };
  const hint = autocomplete[field.target];
  return `${open}<input type="${inputType}" name="${name}"${hint ? ` autocomplete="${hint}"` : ""}${required}></${tag}>`;
};

const renderForm = (
  content: LandingContent,
  editable: boolean,
  privacyHref: string,
) => {
  const { form, thanks } = content;
  const half = halfWidthFields(form.fields);
  const consent = editable
    ? `<span${editLine(true, "form.consent.text")}>${esc(form.consent.text)}</span>`
    : esc(form.consent.text);
  // A button cannot be typed into: on the canvas its text sits in a span
  const submit = esc(form.submitLabel || "Enviar");
  return `<div class="card" id="formulario">
<div id="lead-thanks" hidden><h2>${esc(thanks.title)}</h2>${paragraphs(thanks.message)}</div>
<form id="lead-form" novalidate>
${form.title || editable ? `<h2${editLine(editable, "form.title")}>${esc(form.title)}</h2>` : ""}
${form.intro || editable ? `<p class="intro"${editLine(editable, "form.intro")}>${esc(form.intro)}</p>` : ""}
<div class="fields">
${form.fields.map((field, index) => renderField(field, half.has(field.id), editable ? index : undefined)).join("\n")}
</div>
<div class="trap" aria-hidden="true"><label>No completar <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
${
  form.consent.enabled && (form.consent.text.trim() || editable)
    ? `<label class="choice consent"><input type="checkbox" name="consent" required><span>${consent} <a href="${esc(privacyHref)}" target="_blank" rel="noopener">Política de privacidad</a></span></label>`
    : ""
}
<p class="error" id="lead-error" role="alert" hidden></p>
${
  editable
    ? `<span class="btn send"${editLine(true, "form.submitLabel")}>${submit}</span>`
    : `<button class="btn send" type="submit">${submit}</button>`
}
</form>
</div>`;
};

const ctaLabel = ({ hero, form }: LandingContent) =>
  hero.ctaLabel.trim() || form.submitLabel.trim() || "Quiero información";

const hasContent = ({
  title,
  subtitle,
  text,
}: LandingSection["items"][number]) =>
  !!(title.trim() || subtitle.trim() || text.trim());

const sectionHead = (
  { title, text }: LandingSection,
  editable: boolean,
  path: string,
) =>
  editable
    ? `<div class="head"><h2${editLine(true, `${path}.title`)}>${esc(title)}</h2>${textBody(text, true, `${path}.text`)}</div>`
    : title.trim() || text.trim()
      ? `<div class="head">${title.trim() ? `<h2>${esc(title)}</h2>` : ""}${paragraphs(text)}</div>`
      : "";

/** The lines of a plan, each one a line of its text; the canvas keeps empty ones. */
const planLines = (text: string, editable: boolean, path: string) => {
  if (!editable) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<li>${CHECK_ICON}<span>${esc(line)}</span></li>`);
  }
  return text
    .split("\n")
    .map(
      (line, index) =>
        `<li>${CHECK_ICON}<span${marks(true, { edit: path, line: index })}>${esc(line)}</span></li>`,
    );
};

/** The inside of a section, or "" when it has nothing to show yet. */
const renderSectionBody = (
  section: LandingSection,
  index: number,
  content: LandingContent,
  editable: boolean,
) => {
  const path = `sections.${index}`;
  // The canvas keeps empty items too, so each one is found by its position
  const items = section.items
    .map((item, position) => ({
      item,
      itemPath: `${path}.items.${position}`,
      itemMark: marks(editable, { item: position }),
    }))
    .filter(({ item }) => editable || hasContent(item));
  const hasItems = items.length > 0 || editable;
  const head = sectionHead(section, editable, path);
  const label = esc(section.ctaLabel.trim() || ctaLabel(content));
  const button = editLine(editable, `${path}.ctaLabel`);
  const line = (itemPath: string) => editLine(editable, itemPath);
  const shows = (text: string) => !!text.trim() || editable;

  switch (section.type) {
    case "benefits":
      return hasItems
        ? `<div class="wrap">${head}<div class="cards">${items
            .map(
              ({ item, itemPath, itemMark }) =>
                `<div class="item"${itemMark}><span class="icon">${CHECK_ICON}</span><h3${line(`${itemPath}.title`)}>${esc(item.title)}</h3>${textBody(item.text, editable, `${itemPath}.text`)}</div>`,
            )
            .join("")}</div></div>`
        : "";
    case "steps":
      return hasItems
        ? `<div class="wrap">${head}<ol class="steps">${items
            .map(
              ({ item, itemPath, itemMark }) =>
                `<li${itemMark}><h3${line(`${itemPath}.title`)}>${esc(item.title)}</h3>${textBody(item.text, editable, `${itemPath}.text`)}</li>`,
            )
            .join("")}</ol></div>`
        : "";
    case "modules":
      return hasItems
        ? `<div class="wrap narrow">${head}${items
            .map(
              ({ item, itemPath, itemMark }, position) =>
                `<details class="module"${position === 0 || editable ? " open" : ""}${itemMark}><summary><span class="num">${String(position + 1).padStart(2, "0")}</span><span${line(`${itemPath}.title`)}>${esc(item.title)}</span>${shows(item.subtitle) ? `<span class="meta"${line(`${itemPath}.subtitle`)}>${esc(item.subtitle)}</span>` : ""}</summary>${shows(item.text) ? `<div class="module-body">${textBody(item.text, editable, `${itemPath}.text`)}</div>` : ""}</details>`,
            )
            .join("")}</div>`
        : "";
    case "stats":
      return hasItems
        ? `<div class="wrap">${head}<div class="stats-row">${items
            .map(
              ({ item, itemPath, itemMark }) =>
                `<div class="stat"${itemMark}><b${line(`${itemPath}.title`)}>${esc(item.title)}</b><span${line(`${itemPath}.subtitle`)}>${esc(item.subtitle)}</span></div>`,
            )
            .join("")}</div></div>`
        : "";
    case "testimonials":
      return hasItems
        ? `<div class="wrap">${head}<div class="cards">${items
            .map(
              ({ item, itemPath, itemMark }) =>
                `<figure class="item quote"${itemMark}><blockquote${editBlock(editable, `${itemPath}.text`)}>${paragraphs(item.text)}</blockquote><figcaption><b${line(`${itemPath}.title`)}>${esc(item.title)}</b>${shows(item.subtitle) ? `<span${line(`${itemPath}.subtitle`)}>${esc(item.subtitle)}</span>` : ""}</figcaption></figure>`,
            )
            .join("")}</div></div>`
        : "";
    case "pricing":
      return hasItems
        ? `<div class="wrap">${head}<div class="plans">${items
            .map(({ item, itemPath, itemMark }) => {
              const lines = planLines(item.text, editable, `${itemPath}.text`);
              return `<div class="item plan"${itemMark}><h3${line(`${itemPath}.title`)}>${esc(item.title)}</h3>${shows(item.subtitle) ? `<div class="price"${line(`${itemPath}.subtitle`)}>${esc(item.subtitle)}</div>` : ""}${lines.length ? `<ul>${lines.join("")}</ul>` : ""}<a class="btn" href="#formulario"${button}>${label}</a></div>`;
            })
            .join("")}</div></div>`
        : "";
    case "video": {
      // The player cannot run on the canvas: a spot to click stands in for it
      if (editable) {
        return `<div class="wrap narrow">${head}${emptySlot("video", `${path}.videoUrl`, " video")}</div>`;
      }
      const embed = videoEmbedUrl(section.videoUrl);
      return embed
        ? `<div class="wrap narrow">${head}<div class="video"><iframe src="${esc(embed)}" title="${esc(section.title || "Video")}" loading="lazy" allow="fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></div>`
        : "";
    }
    case "about": {
      if (!section.text.trim() && !editable) return "";
      const image = safeUrl(section.imageUrl);
      const picture = image
        ? `<img src="${esc(image)}" alt="" loading="lazy"${marks(editable, { image: `${path}.imageUrl` })}>`
        : editable
          ? emptySlot("image", `${path}.imageUrl`)
          : "";
      return `<div class="wrap"><div class="split${picture ? " with-image" : ""}"><div class="narrow">${shows(section.title) ? `<div class="head" style="margin-bottom:14px"><h2${line(`${path}.title`)}>${esc(section.title)}</h2></div>` : ""}${textBody(section.text, editable, `${path}.text`)}</div>${picture}</div></div>`;
    }
    case "faq":
      return hasItems
        ? `<div class="wrap narrow">${head}${items
            .map(({ item, itemPath, itemMark }) =>
              editable
                ? `<details class="faq-item" open${itemMark}><summary><span${line(`${itemPath}.title`)}>${esc(item.title)}</span></summary>${textBody(item.text, true, `${itemPath}.text`)}</details>`
                : `<details class="faq-item"><summary>${esc(item.title)}</summary>${paragraphs(item.text)}</details>`,
            )
            .join("")}</div>`
        : "";
    case "cta":
      return shows(section.title)
        ? `<div class="wrap final"><h2${line(`${path}.title`)}>${esc(section.title)}</h2>${textBody(section.text, editable, `${path}.text`)}<a class="btn btn-on-dark" href="#formulario"${button}>${label}</a></div>`
        : "";
  }
};

const BAND_TONES: Partial<Record<LandingSection["type"], string>> = {
  stats: " stats-band",
  cta: " band",
};

/**
 * White and tinted in turns; bands of color break the rhythm on their own.
 * The canvas also draws hidden sections, without letting them change the turns.
 */
const renderSections = (content: LandingContent, editable: boolean) => {
  let tinted = true;
  return content.sections
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => editable || section.enabled)
    .map(({ section, index }) => {
      const body = renderSectionBody(section, index, content, editable);
      if (!body) return "";
      const band = BAND_TONES[section.type];
      const tone = band ?? (tinted ? "" : " tint");
      if (section.enabled) tinted = band ? true : !tinted;
      const sectionMarks = marks(editable, {
        section: index,
        hidden: !section.enabled,
      });
      return `<section class="section${tone}" id="s-${esc(section.id)}"${sectionMarks}>${body}</section>`;
    })
    .join("\n");
};

const renderHeader = (content: LandingContent, editable: boolean) => {
  const logo = safeUrl(content.hero.logoUrl);
  const company = content.footer.company.trim();
  if (!logo && !company && !editable) return "";
  const brand = logo
    ? `<img src="${esc(logo)}" alt="${esc(company)}"${marks(editable, { image: "hero.logoUrl" })}>`
    : editable
      ? `${emptySlot("image", "hero.logoUrl", " logo")}<span${editLine(true, "footer.company")}>${esc(company)}</span>`
      : esc(company);
  return `<header class="top"><div class="wrap top-row"><a class="brand" href="#s-hero">${brand}</a><a class="btn btn-sm" href="#formulario"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a></div></header>`;
};

const renderHero = (
  content: LandingContent,
  editable: boolean,
  privacyHref: string,
) => {
  const { hero, design } = content;
  const isSide = design.formPosition === "side";
  const heroImage = safeUrl(hero.imageUrl);
  // The canvas keeps empty points too, and offers one when there are none
  const entries = editable
    ? hero.highlights.length
      ? hero.highlights
      : [""]
    : hero.highlights.filter((item) => item.trim());
  const highlights = entries.map(
    (item, index) =>
      `<li>${CHECK_ICON}<span${marks(editable, { edit: `hero.highlights.${index}`, entry: true })}>${esc(item)}</span></li>`,
  );
  const image = heroImage
    ? `<img class="hero-image" src="${esc(heroImage)}" alt=""${marks(editable, { image: "hero.imageUrl" })}>`
    : editable
      ? emptySlot("image", "hero.imageUrl", " hero-image")
      : "";
  return `<section class="hero" id="s-hero">
<div class="wrap hero-inner${isSide ? " side" : " centered"}">
<div class="hero-copy">
${hero.eyebrow.trim() || editable ? `<p class="eyebrow"${editLine(editable, "hero.eyebrow")}>${esc(hero.eyebrow)}</p>` : ""}
<h1${editLine(editable, "hero.title")}>${esc(hero.title)}</h1>
${hero.subtitle.trim() || editable ? `<p class="subtitle"${editBlock(editable, "hero.subtitle")}>${esc(hero.subtitle)}</p>` : ""}
${highlights.length ? `<ul class="highlights">${highlights.join("")}</ul>` : ""}
${isSide ? "" : `<a class="btn hero-btn" href="#formulario"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a>`}
${image}
</div>
${isSide ? renderForm(content, editable, privacyHref) : ""}
</div>
</section>`;
};

const renderFooter = (
  { footer }: LandingContent,
  editable: boolean,
  privacyHref: string,
) => {
  const email = footer.email.trim();
  const text = (value: string, path: string) =>
    (value.trim() || editable) &&
    `<span${(path === "footer.address" ? editBlock : editLine)(editable, path)}>${esc(value)}</span>`;
  const items = [
    text(footer.company, "footer.company"),
    // On the canvas the email is a text to edit, not a link to follow
    editable
      ? text(footer.email, "footer.email")
      : email && `<a href="mailto:${esc(email)}">${esc(email)}</a>`,
    text(footer.phone, "footer.phone"),
    text(footer.address, "footer.address"),
    `<a href="${esc(privacyHref)}">Política de privacidad</a>`,
  ].filter(Boolean);
  return `<footer id="s-footer"><div class="wrap footer-row">${items.join("")}</div></footer>`;
};

/** Without JavaScript the button is a plain link: the chat always opens. */
const renderWhatsapp = (
  content: LandingContent,
  preview: boolean,
  editable: boolean,
  privacyHref: string,
) => {
  const { whatsapp } = content;
  const phone = phoneDigits(whatsapp.phone);
  // In the editor it shows before the number is in, so it does not look missing
  if (!whatsapp.enabled || (!phone && !preview)) return "";
  const label = whatsapp.label.trim() || "WhatsApp";
  return `<a class="wa" id="wa-open" href="https://wa.me/${phone}" target="_blank" rel="noopener" aria-label="${esc(label)}">${WHATSAPP_ICON}<span${editLine(editable, "whatsapp.label")}>${esc(label)}</span></a>
<dialog class="wa-dialog" id="wa-dialog">
<form id="wa-form" novalidate>
<button class="wa-close" type="button" id="wa-close" aria-label="Cerrar">×</button>
<h2>${esc(whatsapp.popupTitle)}</h2>
${whatsapp.popupText.trim() ? `<p>${esc(whatsapp.popupText)}</p>` : ""}
<label class="field"><span class="field-label">Tu nombre</span><input type="text" name="name" autocomplete="name" required></label>
<label class="field"><span class="field-label">Tu WhatsApp</span><input type="tel" name="phone" autocomplete="tel" required></label>
<div class="trap" aria-hidden="true"><label>No completar <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<p class="error" id="wa-error" role="alert" hidden></p>
<button class="btn wa-send" type="submit">Abrir WhatsApp</button>
<small class="wa-note">Al continuar aceptas nuestra <a href="${esc(privacyHref)}" target="_blank" rel="noopener">política de privacidad</a>.</small>
</form>
</dialog>`;
};

/** The ids were validated, so they cannot break out of these scripts. */
const trackingHead = ({ tracking }: LandingContent) => {
  const pixel = isFacebookPixelId(tracking.facebookPixelId)
    ? tracking.facebookPixelId
    : "";
  const tag = isGoogleTagId(tracking.googleTagId) ? tracking.googleTagId : "";
  return [
    pixel &&
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel}');fbq('track','PageView');</script>`,
    tag &&
      `<script async src="https://www.googletagmanager.com/gtag/js?id=${tag}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${tag}');</script>`,
  ]
    .filter(Boolean)
    .join("\n");
};

/** Only runs on the published page; plain JavaScript for any browser. */
const pageScript = (content: LandingContent, options: RenderOptions) => {
  const { form, thanks, whatsapp } = content;
  const nameField = form.fields.find(
    (field) => field.target === "full_name" || field.target === "first_name",
  );
  const config = {
    submitUrl: options.submitUrl,
    apiKey: options.apiKey ?? "",
    slug: options.slug,
    fields: form.fields.map(({ id, type, label, required }) => ({
      id,
      type,
      label,
      required,
    })),
    nameFieldId: nameField?.id ?? "",
    thanks: { mode: thanks.mode, url: safeUrl(thanks.url) },
    whatsapp: { phone: phoneDigits(whatsapp.phone), message: whatsapp.message },
  };
  // "<" cannot appear inside the script: a text cannot close the tag
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script type="application/json" id="landing-config">${json}</script>
<script>
(function () {
  var config = JSON.parse(document.getElementById("landing-config").textContent);
  var noop = function () {};
  var memory = {
    get: function (key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set: function (key, value) { try { sessionStorage.setItem(key, value); } catch (e) {} }
  };
  var post = function (payload) {
    payload.slug = config.slug;
    return fetch(config.submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: config.apiKey },
      keepalive: true,
      body: JSON.stringify({ p_datos: payload })
    });
  };

  // One visit per browser session; a failure here never bothers the visitor
  if (!memory.get("landing-visit")) {
    memory.set("landing-visit", "1");
    post({ event: "visit" }).catch(noop);
  }

  // The campaign is kept if they come back from the privacy page
  var utm = {};
  var params = new URLSearchParams(window.location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_keywords"].forEach(function (key) {
    var value = params.get(key);
    if (value) utm[key] = value;
  });
  if (Object.keys(utm).length) {
    memory.set("landing-utm", JSON.stringify(utm));
  } else {
    try { utm = JSON.parse(memory.get("landing-utm") || "{}"); } catch (e) { utm = {}; }
  }

  var trackLead = function () {
    if (window.fbq) window.fbq("track", "Lead");
    if (window.gtag) window.gtag("event", "generate_lead");
  };
  var whatsappUrl = function (name) {
    var text = config.whatsapp.message.replace(/\\{\\{\\s*nombre\\s*\\}\\}/g, name);
    return "https://wa.me/" + config.whatsapp.phone + "?text=" + encodeURIComponent(text);
  };
  var firstWord = function (text) { return String(text || "").trim().split(/\\s+/)[0]; };

  var form = document.getElementById("lead-form");
  var errorBox = document.getElementById("lead-error");
  var button = form.querySelector("button[type=submit]");
  var showError = function (text) {
    errorBox.textContent = text;
    errorBox.hidden = false;
  };
  var valueOf = function (field) {
    if (field.type === "checkbox") {
      return [].slice
        .call(form.querySelectorAll('input[name="' + field.id + '"]:checked'))
        .map(function (input) { return input.value; });
    }
    if (field.type === "radio") {
      var picked = form.querySelector('input[name="' + field.id + '"]:checked');
      return picked ? picked.value : "";
    }
    var input = form.elements[field.id];
    return input ? input.value.trim() : "";
  };
  var finish = function (answers) {
    var thanks = config.thanks;
    if (thanks.mode === "url" && thanks.url) {
      window.location.href = thanks.url;
      return;
    }
    if (thanks.mode === "whatsapp" && config.whatsapp.phone) {
      window.location.href = whatsappUrl(firstWord(answers[config.nameFieldId]));
      return;
    }
    form.hidden = true;
    document.getElementById("lead-thanks").hidden = false;
  };
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    errorBox.hidden = true;
    var answers = {};
    var missing = null;
    config.fields.forEach(function (field) {
      var value = valueOf(field);
      answers[field.id] = value;
      if (field.required && !value.length && !missing) missing = field.label;
    });
    if (missing) {
      showError("Completa este campo: " + missing);
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var consent = form.elements.consent;
    button.disabled = true;
    post({
      answers: answers,
      consent: consent ? consent.checked : false,
      utm: utm,
      website: form.elements.website.value
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () { return {}; })
          .then(function (body) {
            if (!response.ok) throw body;
          });
      })
      .then(function () {
        trackLead();
        finish(answers);
      })
      .catch(function (body) {
        button.disabled = false;
        showError(
          body && body.message === "rate_limited"
            ? "Recibimos varios envíos desde tu conexión. Vuelve a intentarlo en unos minutos."
            : "No pudimos enviar tus datos. Revisa el formulario e inténtalo de nuevo."
        );
      });
  });

  // The bar on phones steps aside while the form is on screen
  var bar = document.getElementById("sticky-cta");
  var card = document.getElementById("formulario");
  if (bar && card && window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle("away", entries[0].isIntersecting);
    }).observe(card);
  }

  var opener = document.getElementById("wa-open");
  var dialog = document.getElementById("wa-dialog");
  if (opener && dialog && dialog.showModal) {
    var waForm = document.getElementById("wa-form");
    var waError = document.getElementById("wa-error");
    opener.addEventListener("click", function (event) {
      event.preventDefault();
      dialog.showModal();
    });
    document.getElementById("wa-close").addEventListener("click", function () {
      dialog.close();
    });
    waForm.addEventListener("submit", function (event) {
      event.preventDefault();
      waError.hidden = true;
      var name = waForm.elements.name.value.trim();
      var phone = waForm.elements.phone.value.trim();
      if (!name || phone.replace(/\\D/g, "").length < 6) {
        waError.textContent = "Escribe tu nombre y un número válido.";
        waError.hidden = false;
        return;
      }
      waForm.querySelector("button[type=submit]").disabled = true;
      // The chat opens even if the CRM is slow or fails: that sale matters more
      var opened = false;
      var open = function () {
        if (opened) return;
        opened = true;
        window.location.href = whatsappUrl(firstWord(name));
      };
      setTimeout(open, 4000);
      post({
        kind: "whatsapp",
        name: name,
        phone: phone,
        utm: utm,
        website: waForm.elements.website.value
      })
        .then(function (response) {
          if (response.ok) trackLead();
        })
        .then(open, open);
    });
  }
})();
</script>`;
};

export const renderLandingPage = (
  content: LandingContent,
  options: RenderOptions,
) => {
  const { hero, design, seo } = content;
  const isSide = design.formPosition === "side";
  const editable = !!options.editable;
  const preview = !!options.preview || editable;
  const privacyHref = landingPrivacyPath(options.slug);
  return `<!doctype html>
<html lang="es">
<head>
${head(content, seo.title || hero.title, seo.description || hero.subtitle)}
${preview ? "" : trackingHead(content)}
</head>
<body>
${renderHeader(content, editable)}
${renderHero(content, editable, privacyHref)}
${renderSections(content, editable)}
${isSide ? "" : `<section class="section tint" id="s-form"><div class="wrap"><div class="form-below">${renderForm(content, editable, privacyHref)}</div></div></section>`}
${renderFooter(content, editable, privacyHref)}
<div class="sticky-cta" id="sticky-cta"><a class="btn" href="#formulario"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a></div>
${renderWhatsapp(content, preview, editable, privacyHref)}
${preview ? "" : pageScript(content, options)}
</body>
</html>`;
};

export const renderPrivacyPage = (content: LandingContent, slug: string) => {
  const logo = safeUrl(content.hero.logoUrl);
  return `<!doctype html>
<html lang="es">
<head>
${head(content, content.privacy.title, "")}
</head>
<body>
<section class="section"><div class="wrap narrow">
${logo ? `<img src="${esc(logo)}" alt="" style="max-height:48px;width:auto;margin-bottom:28px">` : ""}
<div class="head"><h2>${esc(content.privacy.title)}</h2></div>
${paragraphs(content.privacy.text)}
<p style="margin-top:24px"><a href="${esc(landingPath(slug))}">Volver</a></p>
</div></section>
${renderFooter(content, false, landingPrivacyPath(slug))}
</body>
</html>`;
};

/** For a path with nothing published: says so instead of an error page. */
export const renderLandingNotFound = () => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Página no disponible</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;color:#374151;background:#f9fafb;text-align:center;padding:20px}h1{font-size:1.4rem;margin:0 0 8px}p{margin:0}</style>
</head>
<body><div><h1>Esta página no está disponible</h1><p>Puede que el enlace haya cambiado o que ya no esté publicada.</p></div></body>
</html>`;

/**
 * What the browser may load for this page. Pixels and players are allowed only
 * when this landing uses them, so a page without tracking cannot be made to load it.
 */
export const landingContentSecurityPolicy = (
  supabaseUrl: string,
  content?: LandingContent,
) => {
  const tracking = content?.tracking;
  const pixel = !!tracking && isFacebookPixelId(tracking.facebookPixelId);
  const tag = !!tracking && isGoogleTagId(tracking.googleTagId);
  const hasVideo = !!content?.sections.some(
    (section) => section.enabled && section.type === "video",
  );
  const scripts = [
    "'unsafe-inline'",
    ...(pixel ? ["https://connect.facebook.net"] : []),
    ...(tag
      ? [
          "https://www.googletagmanager.com",
          "https://www.googleadservices.com",
          "https://www.google.com",
          "https://googleads.g.doubleclick.net",
        ]
      : []),
  ];
  const connections = [
    supabaseUrl,
    ...(pixel
      ? ["https://www.facebook.com", "https://connect.facebook.net"]
      : []),
    ...(tag
      ? [
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
          "https://www.google.com",
          "https://googleads.g.doubleclick.net",
          "https://www.googleadservices.com",
        ]
      : []),
  ];
  const frames = [
    ...(hasVideo
      ? ["https://www.youtube-nocookie.com", "https://player.vimeo.com"]
      : []),
    ...(pixel ? ["https://www.facebook.com"] : []),
    ...(tag
      ? [
          "https://www.googletagmanager.com",
          "https://td.doubleclick.net",
          "https://bid.g.doubleclick.net",
        ]
      : []),
  ];
  return [
    "default-src 'none'",
    "img-src https: data:",
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `script-src ${scripts.join(" ")}`,
    `connect-src ${connections.join(" ")}`,
    `frame-src ${frames.length ? frames.join(" ") : "'none'"}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
};
