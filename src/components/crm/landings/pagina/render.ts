import {
  CARRITO_MAX_CANTIDAD,
  CARRITO_MAX_LINEAS,
  CARRITO_TITULO_BOTON,
  carritoTelefono,
  formatCarritoMoneda,
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
  /**
   * Active products of the catalog, for the order block of the editor's
   * preview (no RPC is called there). The published page loads its own.
   */
  productos?: ProductosVistaPrevia;
}

/** The catalog as the preview knows it: still loading, failed, or the active products. */
export type ProductosVistaPrevia =
  | { estado: "cargando" }
  | { estado: "error" }
  | { estado: "listo"; lista: ProductoPagina[] };

/** What the order block shows of a product. */
export interface ProductoPagina {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number;
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

/** WCAG relative luminance of a #rrggbb color. */
const relativeLuminance = (hex: string) => {
  const linear = (start: number) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
};

const contrastRatio = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Luminance of the near-black used for text (#0f172a). */
const DARK_TEXT_LUMINANCE = relativeLuminance("#0f172a");

/**
 * White or near-black, whichever has the higher real contrast (WCAG) on every
 * given background: a gradient needs one text color that reads on both ends.
 */
const textOn = (...hexes: string[]) => {
  const luminances = hexes.map(relativeLuminance);
  const worst = (text: number) =>
    Math.min(...luminances.map((luminance) => contrastRatio(luminance, text)));
  return worst(1) >= worst(DARK_TEXT_LUMINANCE) ? "#ffffff" : "#0f172a";
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
      text: textOn(color, color2),
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
.hero.compact .hero-inner{gap:0;padding-top:28px;padding-bottom:32px}
.hero.compact h1{font-size:clamp(1.7rem,3.2vw,2.5rem)}
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
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
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
.step{margin:0 0 24px;padding:0;border:0;min-width:0}
.step-title{display:flex;align-items:center;gap:10px;margin:0 0 14px;padding:0;font-size:1.1rem;font-weight:800;line-height:1.2}
.step-n{display:inline-flex;align-items:center;justify-content:center;flex:none;width:28px;height:28px;border-radius:50%;background:var(--primary);color:var(--on-primary);font-size:.85rem;font-weight:800}
.step:focus-visible{outline:3px solid var(--primary);outline-offset:4px}
.shop{display:grid;gap:20px;align-items:start}
.shop-main{min-width:0}
.cart-products{list-style:none;margin:0;padding:0;display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))}
.shop-card{display:flex;flex-direction:column;min-width:0;background:#fff;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;transition:border-color .15s,box-shadow .15s}
.shop-card:hover{box-shadow:0 8px 24px rgba(15,23,42,.1)}
.shop-card:focus-within{border-color:var(--primary)}
.shop-card.in-cart{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}
.shop-img{aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:var(--tint-strong);color:var(--primary);font-size:2.2rem;font-weight:800;line-height:1}
.shop-body{display:flex;flex-direction:column;gap:6px;flex:1 1 auto;min-width:0;padding:14px 14px 8px}
.shop-name{margin:0;font-size:1rem;font-weight:700;line-height:1.3;overflow-wrap:anywhere}
.shop-desc{margin:0;color:var(--muted);font-size:.9rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.shop-price{margin-top:auto;padding-top:4px;font-size:1.35rem;font-weight:800;font-variant-numeric:tabular-nums}
.shop-action{padding:6px 14px 14px}
.shop-add{width:100%;height:44px;min-height:44px;padding-block:0}
.shop-add:disabled{opacity:.5;cursor:not-allowed}
.qty{display:inline-flex;align-items:center;gap:6px;height:44px}
.shop-action .qty{display:flex;justify-content:space-between;width:100%}
.shop-action .qty output{flex:1}
.qty button{width:44px;height:44px;border:1px solid #cbd5e1;border-radius:max(6px,calc(var(--radius) - 4px));background:#fff;color:var(--ink);font:inherit;font-size:1.3rem;line-height:1;cursor:pointer}
.qty button:hover:not(:disabled){background:var(--tint-strong)}
.qty button:disabled{opacity:.45;cursor:not-allowed}
.qty button:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
.qty output{min-width:2.4ch;text-align:center;font-weight:700;font-variant-numeric:tabular-nums}
.skel .shop-img{font-size:0}
.skel .shop-img,.skel .bar{background:linear-gradient(90deg,var(--tint-strong),var(--tint),var(--tint-strong));background-size:200% 100%;animation:shimmer 1.3s linear infinite}
.skel .shop-body{min-height:96px}
.bar{height:14px;border-radius:6px}
.bar.w60{width:60%}
.bar.w40{width:40%}
@keyframes shimmer{to{background-position:-200% 0}}
.cart-status{color:var(--muted);margin:0 0 10px}
.cart-status .btn{min-height:44px;margin-left:6px}
.mini-cart{background:var(--tint);border:1px solid var(--line);border-radius:var(--radius);padding:18px}
.mini-cart h4{margin:0 0 12px;font-size:1.05rem;font-weight:800}
.mini-cart h4:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.mini-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0;text-align:center;color:var(--muted)}
.mini-empty svg{width:40px;height:40px;opacity:.7}
.mini-empty p{margin:0}
.cart-table{width:100%;border-collapse:collapse;margin:0 0 12px}
.cart-table th{padding:8px 10px;border-bottom:2px solid var(--line);color:var(--muted);font-size:.8rem;font-weight:700;letter-spacing:.04em;text-align:left;text-transform:uppercase}
.cart-table td{padding:12px 10px;border-bottom:1px solid var(--line);vertical-align:middle;font-variant-numeric:tabular-nums}
.cart-table .cell-num{text-align:right}
.cart-table .cell-name{font-weight:600;overflow-wrap:break-word}
.cart-table .cell-sub{font-weight:700;white-space:nowrap}
.cart-table .cell-remove{width:52px;padding:2px}
.line-remove{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:50%;background:transparent;color:var(--ink);font-size:1.5rem;line-height:1;cursor:pointer}
.line-remove:hover{background:var(--tint-strong)}
.line-remove:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
@media (max-width:600px){
.cart-table,.cart-table tbody,.cart-table tr,.cart-table td{display:block}
.cart-table thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.cart-table tr{position:relative;padding:10px 0;border-bottom:1px solid var(--line)}
.cart-table td{display:flex;justify-content:space-between;gap:12px;padding:3px 0;border:0;text-align:right}
.cart-table td::before{content:attr(data-label);color:var(--muted);font-weight:500;text-align:left}
.cart-table td.cell-name{display:block;padding-right:48px;font-size:1rem;text-align:left}
.cart-table td.cell-name::before,.cart-table td.cell-remove::before{display:none}
.cart-table td.cell-remove{position:absolute;top:4px;right:-8px;width:auto;padding:0}
}
.cart-totals{max-width:320px;margin-left:auto}
.cart-totals .row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:4px 0;font-variant-numeric:tabular-nums}
.cart-totals .total{margin-top:6px;padding-top:10px;border-top:1px solid var(--line);font-size:1.25rem;font-weight:800}
.cart-delivery{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.choice-card{position:relative;display:block;min-width:0;cursor:pointer}
.choice-card input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.cc-body{position:relative;display:block;height:100%;min-height:48px;padding:12px 12px 12px 44px;border:1.5px solid var(--line);border-radius:var(--radius);background:#fff;transition:border-color .15s,background-color .15s}
.cc-body::before{content:"";position:absolute;left:14px;top:15px;width:18px;height:18px;border:2px solid #64748b;border-radius:50%;background:#fff}
.cc-body b{display:block;font-size:.98rem;line-height:1.3}
.cc-body span{display:block;margin-top:2px;color:var(--muted);font-size:.86rem;line-height:1.35}
.choice-card:hover .cc-body{border-color:var(--primary)}
.choice-card input:checked+.cc-body{border-color:var(--primary);background:var(--tint)}
.choice-card input:checked+.cc-body::before{border-color:var(--primary);background:radial-gradient(circle,var(--primary) 0 4px,#fff 5px)}
.choice-card input:focus-visible+.cc-body{outline:3px solid var(--primary);outline-offset:2px}
@media (max-width:480px){
.cart-delivery{grid-template-columns:1fr}
.cc-body{padding:12px 10px 12px 38px}
.cc-body::before{left:10px}
}
.cart-delivery-box .field{margin-top:10px}
.cart-note{margin:0;padding:12px 14px;border:1.5px solid var(--line);border-radius:var(--radius);background:var(--tint);font-weight:600}
.shop [hidden],.mini-cart [hidden],.cart-delivery-box[hidden],.cart-delivery-box [hidden]{display:none!important}
#lead-form [aria-invalid=true]{border-color:#b91c1c}
.lead-order h2{margin-bottom:8px}
.lead-order .btn{margin-top:14px;width:100%}
.order-lines{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:8px}
.order-lines li{display:flex;justify-content:space-between;gap:12px;font-size:.95rem}
.order-lines li span:first-child{min-width:0;overflow-wrap:anywhere}
.order-lines li span:last-child{white-space:nowrap;font-variant-numeric:tabular-nums}
.lead-order:focus-visible,#cart-products:focus-visible,#cart-status:focus-visible{outline:3px solid var(--primary);outline-offset:3px}
.form-below.wide{max-width:1100px}
.cart-bar{position:fixed;left:12px;right:12px;bottom:84px;z-index:14;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:48px;padding:6px 6px 6px 16px;background:var(--ink);color:#fff;border-radius:999px;box-shadow:0 10px 28px rgba(15,23,42,.3)}
.cart-bar[hidden]{display:none}
.cart-bar-text{display:flex;flex-direction:column;min-width:0;line-height:1.2;font-variant-numeric:tabular-nums}
.cart-bar-count{font-size:.8rem;opacity:.85}
.cart-bar-total{font-size:1.05rem;font-weight:800;white-space:nowrap}
.cart-bar a{flex:none;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:999px;background:#fff;color:var(--ink);font-weight:700;text-decoration:none}
.cart-bar a:focus-visible{outline:3px solid var(--primary);outline-offset:2px}
body.has-cart-bar{padding-bottom:140px}
body.has-cart-bar .wa{bottom:144px}
@media (prefers-reduced-motion:reduce){.sticky-cta,.shop-card,.cc-body{transition:none}.skel .shop-img,.skel .bar{animation:none}}
@media (min-width:900px){
.cart-bar{right:auto;left:20px;bottom:20px;width:min(460px,calc(100vw - 120px))}
body.has-cart-bar{padding-bottom:0}
body.has-cart-bar .wa{bottom:20px}
}
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
    return `${open}<select name="${name}"${required}><option value="">Elegí una opción</option>${choices}</select></${tag}>`;
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
  options: RenderOptions,
) => {
  const { form, thanks } = content;
  const shop = content.carrito.activo;
  const half = halfWidthFields(form.fields);
  const consent = editable
    ? `<span${editLine(true, "form.consent.text")}>${esc(form.consent.text)}</span>`
    : esc(form.consent.text);
  // A button cannot be typed into: on the canvas its text sits in a span
  const submit = esc(form.submitLabel || "Enviar");
  return `<div class="card" id="formulario">
<div id="lead-thanks" hidden><h2>${esc(thanks.title)}</h2>${paragraphs(thanks.message)}${shop && !editable ? `<div class="lead-order" id="lead-order" tabindex="-1" hidden></div>` : ""}</div>
<form id="lead-form" novalidate>
${form.title || editable ? `<h2${editLine(editable, "form.title")}>${esc(form.title)}</h2>` : ""}
${form.intro || editable ? `<p class="intro"${editLine(editable, "form.intro")}>${esc(form.intro)}</p>` : ""}
${renderPedido(content, options)}
${shop ? `<div class="step"><h3 class="step-title"><span class="step-n" aria-hidden="true">2</span>Tus datos</h3>` : ""}
<div class="fields">
${form.fields.map((field, index) => renderField(field, half.has(field.id), editable ? index : undefined)).join("\n")}
</div>
${shop ? "</div>" : ""}
${renderEntrega(content, editable)}
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

const ctaLabel = ({ hero, form, carrito }: LandingContent) =>
  hero.ctaLabel.trim() ||
  (carrito.activo
    ? "Ver catálogo"
    : form.submitLabel.trim() || "Quiero información");

/** With a catalog the main buttons lead to it; otherwise, to the inquiry form. */
const ctaHref = ({ carrito }: LandingContent) =>
  carrito.activo ? "#pedido" : "#formulario";

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
              return `<div class="item plan"${itemMark}><h3${line(`${itemPath}.title`)}>${esc(item.title)}</h3>${shows(item.subtitle) ? `<div class="price"${line(`${itemPath}.subtitle`)}>${esc(item.subtitle)}</div>` : ""}${lines.length ? `<ul>${lines.join("")}</ul>` : ""}<a class="btn" href="${ctaHref(content)}"${button}>${label}</a></div>`;
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
        ? `<div class="wrap final"><h2${line(`${path}.title`)}>${esc(section.title)}</h2>${textBody(section.text, editable, `${path}.text`)}<a class="btn btn-on-dark" href="${ctaHref(content)}"${button}>${label}</a></div>`
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
  return `<header class="top"><div class="wrap top-row"><a class="brand" href="#s-hero">${brand}</a><a class="btn btn-sm" href="${ctaHref(content)}"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a></div></header>`;
};

const renderHero = (
  content: LandingContent,
  editable: boolean,
  privacyHref: string,
  options: RenderOptions,
) => {
  const { hero } = content;
  const isSide = formBesideHero(content);
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
  // Just a title (a catalog's cover): no empty block above or below it, and
  // the catalog right underneath needs no button of its own. The canvas keeps
  // the full cover, with its empty spots to fill in.
  const compact =
    !editable &&
    !isSide &&
    !hero.eyebrow.trim() &&
    !hero.subtitle.trim() &&
    !heroImage &&
    !hero.highlights.some((item) => item.trim());
  const cta =
    compact && content.carrito.activo
      ? ""
      : `<a class="btn hero-btn" href="${ctaHref(content)}"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a>`;
  return `<section class="hero${compact ? " compact" : ""}" id="s-hero">
<div class="wrap hero-inner${isSide ? " side" : " centered"}">
<div class="hero-copy">
${hero.eyebrow.trim() || editable ? `<p class="eyebrow"${editLine(editable, "hero.eyebrow")}>${esc(hero.eyebrow)}</p>` : ""}
<h1${editLine(editable, "hero.title")}>${esc(hero.title)}</h1>
${hero.subtitle.trim() || editable ? `<p class="subtitle"${editBlock(editable, "hero.subtitle")}>${esc(hero.subtitle)}</p>` : ""}
${highlights.length ? `<ul class="highlights">${highlights.join("")}</ul>` : ""}
${isSide ? "" : cta}
${image}
</div>
${isSide ? renderForm(content, editable, privacyHref, options) : ""}
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

/** The products the order block offers: the allowed ones, or every active one. */
const offeredProducts = (
  { carrito }: LandingContent,
  productos: ProductoPagina[],
) =>
  carrito.productoIds.length
    ? productos.filter((producto) => carrito.productoIds.includes(producto.id))
    : productos;

const BAG_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1 13H5L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>`;

/** Products have no picture: the first letter on a tinted square stands in for it. */
const initialOf = (name: string) =>
  esc((Array.from(name.trim())[0] ?? "•").toUpperCase());

/**
 * A product of the editor's canvas: the same card as the page, with the button
 * on. The canvas runs no script (its frame is sandboxed), so a touch on it only
 * says where the cart can be tried; the editor listens for `data-cart-preview`.
 */
const previewProduct = (producto: ProductoPagina) => {
  const description = producto.descripcion?.trim();
  return `<li class="shop-card"><div class="shop-img" aria-hidden="true"><span>${initialOf(producto.nombre)}</span></div><div class="shop-body"><h4 class="shop-name">${esc(producto.nombre)}</h4>${description ? `<p class="shop-desc">${esc(description)}</p>` : ""}<div class="shop-price">${esc(formatCarritoMoneda(producto.precio))}</div></div><div class="shop-action"><button type="button" class="btn shop-add" data-cart-preview aria-label="Agregar ${esc(producto.nombre)} al carrito">Agregar al carrito</button></div></li>`;
};

/** «Tu carrito», the cart table of a shop: empty at first, filled by the script. */
const MINI_CART = `<aside class="mini-cart" aria-labelledby="mini-cart-title">
<h4 id="mini-cart-title" tabindex="-1">Tu carrito</h4>
<div class="mini-empty" id="cart-empty">${BAG_ICON}<p>Tu carrito está vacío</p></div>
<table class="cart-table" id="cart-table" role="table" hidden>
<caption class="sr-only">Productos de tu carrito</caption>
<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader"><span class="sr-only">Quitar</span></th><th scope="col" role="columnheader">Producto</th><th scope="col" role="columnheader" class="cell-num">Precio</th><th scope="col" role="columnheader" class="cell-num">Cantidad</th><th scope="col" role="columnheader" class="cell-num">Subtotal</th></tr></thead>
<tbody id="cart-lines" role="rowgroup"></tbody>
</table>
<div class="cart-totals" id="cart-summary" hidden><div class="row"><span>Subtotal</span><b id="cart-subtotal">$ 0,00</b></div><div class="row total"><span>Total</span><b id="cart-total">$ 0,00</b></div></div>
</aside>`;

/**
 * «1. Catálogo», inside the one form: a grid of product cards and the
 * cart table below it, full width. The published page loads the products in the browser
 * (landing_productos); the preview tab gets them in `options.productos` and
 * runs the same script without a network; the canvas shows them as static
 * cards.
 */
const renderPedido = (content: LandingContent, options: RenderOptions) => {
  if (!content.carrito.activo) return "";
  const editable = !!options.editable;
  const preview = !!options.preview || editable;
  const state = options.productos;
  const dynamic = !editable && (!preview || state?.estado === "listo");
  let main: string;
  if (dynamic) {
    main = `<p class="cart-status sr-only" id="cart-status" role="status" tabindex="-1">Cargando productos…</p>
<ul class="cart-products" id="cart-products" tabindex="-1"></ul>`;
  } else if (!state) {
    main = `<p class="cart-status">Los productos se muestran en la página publicada.</p>`;
  } else if (state.estado === "cargando") {
    main = `<p class="cart-status" role="status">Cargando productos…</p>`;
  } else if (state.estado === "error") {
    main = `<p class="cart-status" role="alert">No pudimos cargar los productos. Probá de nuevo en un momento.</p>`;
  } else {
    const listed = offeredProducts(content, state.lista);
    main = listed.length
      ? `<ul class="cart-products">${listed.map(previewProduct).join("")}</ul>`
      : `<p class="cart-status">Todavía no hay productos disponibles. Cargalos en Productos.</p>`;
  }
  return `<div class="step" id="pedido" tabindex="-1" role="group" aria-labelledby="pedido-titulo">
<h3 class="step-title" id="pedido-titulo"><span class="step-n" aria-hidden="true">1</span>Catálogo</h3>
<div class="shop"><div class="shop-main">${main}</div>${MINI_CART}</div>
${dynamic ? `<span class="sr-only" id="cart-announce" role="status"></span>` : ""}
</div>`;
};

/**
 * «3. Entrega»: the business decides (carrito.entrega), not the template. It is
 * shown once something is chosen.
 *  - "elegir": cards for shipping or pickup, and the address for shipping
 *  - "envio": no cards, only the address
 *  - "retiro": one line, «Retiro en el local»
 *  - "ninguna": no step and no field: the order stays «a coordinar»
 */
const renderEntrega = (content: LandingContent, editable: boolean) => {
  const { activo, entrega } = content.carrito;
  if (!activo || entrega === "ninguna") return "";
  const address = (label: string) =>
    `<label class="field" id="cart-address-field"><span class="field-label">${label} <span class="req">*</span></span><input type="text" name="pedido_direccion" autocomplete="street-address" maxlength="300"></label>`;
  const open = `<fieldset class="step cart-delivery-box" id="cart-delivery"${editable ? "" : " hidden"}><legend class="step-title"><span class="step-n" aria-hidden="true">3</span>Entrega</legend>`;
  if (entrega === "retiro") {
    return `${open}<p class="cart-note">Retiro en el local</p></fieldset>`;
  }
  if (entrega === "envio") {
    return `${open}${address("Dirección de envío")}</fieldset>`;
  }
  return `${open}
<div class="cart-delivery">
<label class="choice-card"><input type="radio" name="pedido_entrega" value="envio" checked><span class="cc-body"><b>Envío</b><span>A tu domicilio</span></span></label>
<label class="choice-card"><input type="radio" name="pedido_entrega" value="retiro"><span class="cc-body"><b>Retiro</b><span>Pasás a buscarlo</span></span></label>
</div>
${address("Dirección de entrega")}
</fieldset>`;
};

/** On phones, a bar that takes the visitor back to the order while they keep reading. */
const renderBarraPedido = (content: LandingContent, scripted: boolean) =>
  content.carrito.activo && scripted
    ? `<div class="cart-bar" id="cart-bar" role="region" aria-label="Resumen del pedido" hidden><span class="cart-bar-text" id="cart-bar-text"></span><a href="#pedido" id="cart-bar-link">Ver pedido</a></div>`
    : "";

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
<small class="wa-note">Al continuar aceptás nuestra <a href="${esc(privacyHref)}" target="_blank" rel="noopener">política de privacidad</a>.</small>
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
    // The preview tab: no request, no visit, nothing saved in the browser
    preview: !!options.preview,
    fields: form.fields.map(({ id, type, label, required }) => ({
      id,
      type,
      label,
      required,
    })),
    nameFieldId: nameField?.id ?? "",
    thanks: { mode: thanks.mode, url: safeUrl(thanks.url) },
    whatsapp: { phone: phoneDigits(whatsapp.phone), message: whatsapp.message },
    carrito: {
      activo: content.carrito.activo,
      // Same host and key as the form: only the function changes
      productsUrl: options.submitUrl.replace(/[^/]*$/, "landing_productos"),
      // Only the preview tab brings them; the published page asks for them
      productos:
        options.preview && options.productos?.estado === "listo"
          ? offeredProducts(content, options.productos.lista).map(
              ({ id, nombre, descripcion, precio }) => ({
                id,
                nombre,
                descripcion: descripcion ?? "",
                precio,
              }),
            )
          : null,
      // Decided by the business: "elegir", "envio", "retiro" or "ninguna"
      entrega: content.carrito.entrega,
      // One button: the form's own text, and the order's once something is chosen
      sendLabel: form.submitLabel || "Enviar",
      buttonLabel: content.carrito.tituloBoton || CARRITO_TITULO_BOTON,
      // Its own number, or the one of the WhatsApp button when left empty
      phone: carritoTelefono(content),
      template: content.carrito.plantillaMensaje,
      maxQuantity: CARRITO_MAX_CANTIDAD,
      maxLines: CARRITO_MAX_LINEAS,
    },
  };
  // "<" cannot appear inside the script: a text cannot close the tag
  const json = JSON.stringify(config).replace(/</g, "\\u003c");
  return `<script type="application/json" id="landing-config">${json}</script>
<script>
(function () {
  var config = JSON.parse(document.getElementById("landing-config").textContent);
  var noop = function () {};
  var memory = {
    // The preview tab is a blob that inherits the CRM's origin: it must not read or write its storage
    get: function (key) { if (config.preview) return null; try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set: function (key, value) { if (config.preview) return; try { sessionStorage.setItem(key, value); } catch (e) {} }
  };
  // One key per order attempt: if the send is cut off and the visitor tries again,
  // the database recognizes the order it already saved instead of creating another.
  // It is kept until a reply arrives, and cleared then so the next order is new.
  var orderKeyStore = "landing-order:" + config.slug;
  var orderKey = function () {
    var key = memory.get(orderKeyStore);
    if (!key) {
      key = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
      memory.set(orderKeyStore, key);
    }
    return key;
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
  if (!config.preview && !memory.get("landing-visit")) {
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
  var busy = false;
  var showError = function (text, field) {
    errorBox.textContent = text;
    errorBox.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("aria-describedby", "lead-error");
      field.focus();
    }
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
  // An order is never redirected away: its summary and the WhatsApp button are the thanks
  var finish = function (answers, data) {
    var thanks = config.thanks;
    var ordered = !!(data && typeof data.pedido_id === "number" && cartApi);
    if (!ordered && thanks.mode === "url" && thanks.url) {
      window.location.href = thanks.url;
      return;
    }
    if (!ordered && thanks.mode === "whatsapp" && config.whatsapp.phone) {
      window.location.href = whatsappUrl(firstWord(answers[config.nameFieldId]));
      return;
    }
    form.hidden = true;
    document.getElementById("lead-thanks").hidden = false;
    if (ordered) cartApi.showOrder(data, firstWord(answers[config.nameFieldId]));
  };
  // The cart lives inside the form: the products come from landing_productos
  // (or, in the preview tab, from the page itself) and, on send, the lines and
  // the delivery go with the answers to landing_recibir. Prices on screen are
  // only a preview; the database computes the real ones.
  var cart = config.carrito;
  var cartApi = null;
  var cartList = document.getElementById("cart-products");
  if (cart.activo && cartList) {
    var money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
    var cartStatus = document.getElementById("cart-status");
    var cartLines = document.getElementById("cart-lines");
    var cartTable = document.getElementById("cart-table");
    var cartEmpty = document.getElementById("cart-empty");
    var cartSummary = document.getElementById("cart-summary");
    var cartSubtotal = document.getElementById("cart-subtotal");
    var cartTotal = document.getElementById("cart-total");
    var cartTitle = document.getElementById("mini-cart-title");
    // Decided by the business; the page never lets the visitor change it
    var mode = cart.entrega;
    // Absent when the business has no delivery step ("ninguna") or no address to ask ("retiro")
    var deliveryBox = document.getElementById("cart-delivery");
    var addressField = document.getElementById("cart-address-field");
    var cartBar = document.getElementById("cart-bar");
    var cartBarText = document.getElementById("cart-bar-text");
    var cartAnnounce = document.getElementById("cart-announce");
    var products = [];
    var quantities = {};
    var announcedCount = 0;
    var summaryVisible = false;
    // True once the products answered: until then a send would drop the order in silence
    var loaded = false;
    var storeKey = "landing-cart:" + config.slug;
    // The preview tab (a blob with the CRM's origin) must not touch any storage
    var store = {
      get: function () { if (config.preview) return null; try { return localStorage.getItem(storeKey); } catch (e) { return null; } },
      set: function (value) { if (config.preview) return; try { localStorage.setItem(storeKey, value); } catch (e) {} },
      clear: function () { if (config.preview) return; try { localStorage.removeItem(storeKey); } catch (e) {} }
    };
    var saved = {};
    try {
      var parsed = JSON.parse(store.get() || "{}");
      if (parsed && typeof parsed === "object") saved = parsed;
    } catch (e) {}

    var element = function (tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    var initial = function (name) {
      var first = Array.from(String(name).trim())[0];
      return first ? first.toUpperCase() : "\\u2022";
    };
    var chosen = function () {
      return products.filter(function (product) { return quantities[product.id] > 0; });
    };
    var cartMessage = function (data, name) {
      var lines = data.lineas
        .map(function (line) {
          return "\\u2022 " + line.cantidad + " \\u00d7 " + line.nombre + " \\u2014 " + money.format(line.subtotal);
        })
        .join("\\n");
      var values = { pedido: String(data.pedido_id), nombre: name, lineas: lines, total: money.format(data.total) };
      return cart.template.replace(/\\{\\s*(pedido|nombre|lineas|total)\\s*\\}/g, function (all, key) {
        return values[key];
      });
    };
    var syncDelivery = function () {
      // Only shipping needs the address; with "retiro" or "ninguna" there is no field at all
      if (!addressField) return;
      var pickup = mode === "elegir" && form.elements.pedido_entrega.value === "retiro";
      addressField.hidden = pickup;
      form.elements.pedido_direccion.required = chosen().length > 0 && !pickup;
    };
    var updateBar = function () {
      cartBar.hidden = !(chosen().length > 0 && !summaryVisible && !busy);
      document.body.classList.toggle("has-cart-bar", !cartBar.hidden);
    };
    var removeLine = function (id) {
      delete quantities[id];
      refresh();
      // The line is gone with its button: the focus goes to the cart's title
      cartTitle.focus();
    };

    var refresh = function () {
      var picked = chosen();
      var count = picked.length;
      var total = 0;
      cartLines.textContent = "";
      picked.forEach(function (product) {
        var amount = quantities[product.id] * product.precio;
        total += amount;
        var row = element("tr");
        // Explicit roles: below 600px the table is laid out as blocks, which drops its semantics
        row.setAttribute("role", "row");
        var cell = function (className, label, text) {
          var node = element("td", className, text);
          node.setAttribute("role", "cell");
          if (label) node.setAttribute("data-label", label);
          row.appendChild(node);
          return node;
        };
        var removeCell = cell("cell-remove");
        var remove = element("button", "line-remove", "\\u00d7");
        remove.type = "button";
        remove.setAttribute("aria-label", "Quitar " + product.nombre + " del carrito");
        remove.addEventListener("click", function () { removeLine(product.id); });
        removeCell.appendChild(remove);
        cell("cell-name", "Producto", product.nombre);
        cell("cell-num", "Precio", money.format(product.precio));
        cell("cell-num", "Cantidad", String(quantities[product.id]));
        cell("cell-num cell-sub", "Subtotal", money.format(amount));
        cartLines.appendChild(row);
      });
      cartTable.hidden = count === 0;
      cartEmpty.hidden = count > 0;
      cartSummary.hidden = count === 0;
      if (deliveryBox) deliveryBox.hidden = count === 0;
      syncDelivery();
      cartSubtotal.textContent = money.format(total);
      cartTotal.textContent = money.format(total);
      var countText = count + (count === 1 ? " producto" : " productos");
      // Two lines so the total never gets cut: how many above, how much below
      cartBarText.textContent = "";
      cartBarText.appendChild(element("span", "cart-bar-count", countText));
      cartBarText.appendChild(element("span", "cart-bar-total", money.format(total)));
      // Announced only when the order goes from empty to filled, not on every click on the steppers
      if (count > 0 && announcedCount === 0) cartAnnounce.textContent = "Tu pedido: " + countText + " \\u00b7 " + money.format(total);
      if (count === 0) cartAnnounce.textContent = "";
      announcedCount = count;
      if (!busy) button.textContent = count > 0 ? cart.buttonLabel : cart.sendLabel;
      updateBar();
      // Until the products load, nothing is chosen yet: the saved order must survive
      if (loaded) {
        if (count) { store.set(JSON.stringify(quantities)); } else { store.clear(); }
      }
      [].slice.call(cartList.querySelectorAll("li[data-id]")).forEach(function (card) {
        var id = Number(card.getAttribute("data-id"));
        var amount = quantities[id] || 0;
        card.classList.toggle("in-cart", amount > 0);
        card.querySelector("[data-add]").hidden = amount > 0;
        card.querySelector("[data-add]").disabled = count >= cart.maxLines;
        card.querySelector(".qty").hidden = amount === 0;
        card.querySelector("output").textContent = String(amount);
        card.querySelector("[data-more]").disabled = amount >= cart.maxQuantity;
      });
    };
    var change = function (id, delta) {
      var before = quantities[id] || 0;
      var next = Math.max(0, Math.min(cart.maxQuantity, before + delta));
      if (next === 0) { delete quantities[id]; } else { quantities[id] = next; }
      refresh();
      // The control that was pressed may have been replaced: the focus follows it
      var card = cartList.querySelector('li[data-id="' + id + '"]');
      var which = next === 0 ? "[data-add]" : before === 0 ? "[data-more]" : null;
      var target = card && which ? card.querySelector(which) : null;
      if (target && !target.disabled) target.focus();
    };
    var stepper = function (label, symbol, flag, id, delta) {
      var control = element("button", "", symbol);
      control.type = "button";
      control.setAttribute(flag, "");
      control.setAttribute("aria-label", label);
      control.addEventListener("click", function () { change(id, delta); });
      return control;
    };
    var showSkeleton = function () {
      cartList.textContent = "";
      for (var index = 0; index < 3; index++) {
        var card = element("li", "shop-card skel");
        card.setAttribute("aria-hidden", "true");
        card.appendChild(element("div", "shop-img"));
        var body = element("div", "shop-body");
        body.appendChild(element("div", "bar w60"));
        body.appendChild(element("div", "bar"));
        body.appendChild(element("div", "bar w40"));
        card.appendChild(body);
        cartList.appendChild(card);
      }
    };
    var showProducts = function () {
      cartList.textContent = "";
      products.forEach(function (product) {
        var card = element("li", "shop-card");
        card.setAttribute("data-id", String(product.id));
        var picture = element("div", "shop-img");
        picture.setAttribute("aria-hidden", "true");
        picture.appendChild(element("span", "", initial(product.nombre)));
        card.appendChild(picture);
        var info = element("div", "shop-body");
        info.appendChild(element("h4", "shop-name", product.nombre));
        if (product.descripcion) info.appendChild(element("p", "shop-desc", product.descripcion));
        info.appendChild(element("div", "shop-price", money.format(product.precio)));
        card.appendChild(info);
        var action = element("div", "shop-action");
        var add = element("button", "btn shop-add", "Agregar al carrito");
        add.type = "button";
        add.setAttribute("data-add", "");
        add.setAttribute("aria-label", "Agregar " + product.nombre + " al carrito");
        add.addEventListener("click", function () { change(product.id, 1); });
        action.appendChild(add);
        var qty = element("div", "qty");
        qty.hidden = true;
        qty.appendChild(stepper("Quitar una unidad de " + product.nombre, "\\u2212", "data-less", product.id, -1));
        var shown = element("output", "", "0");
        shown.setAttribute("aria-label", "Cantidad de " + product.nombre);
        qty.appendChild(shown);
        qty.appendChild(stepper("Agregar una unidad de " + product.nombre, "+", "data-more", product.id, 1));
        action.appendChild(qty);
        card.appendChild(action);
        cartList.appendChild(card);
      });
      refresh();
    };
    var showStatus = function (text, visible, failed) {
      cartStatus.className = visible ? "cart-status" : "cart-status sr-only";
      // The node keeps role="status"; a failure raises its urgency instead of changing the role
      cartStatus.setAttribute("aria-live", failed ? "assertive" : "polite");
      cartStatus.textContent = text;
      cartStatus.hidden = false;
    };

    var applyProducts = function (list) {
      products = (Array.isArray(list) ? list : []).filter(function (product) {
        return product && typeof product.id === "number" && typeof product.nombre === "string" && isFinite(Number(product.precio));
      }).map(function (product) {
        return { id: product.id, nombre: product.nombre, descripcion: product.descripcion || "", precio: Number(product.precio) };
      });
      loaded = true;
      if (!products.length) {
        showStatus("Todav\\u00eda no hay productos disponibles.", true);
        cartList.textContent = "";
        store.clear();
        return;
      }
      // Restore the saved order: gone products drop out, amounts stay within limits
      quantities = {};
      var kept = 0;
      products.forEach(function (product) {
        var amount = Math.floor(Number(saved[product.id]));
        if (amount > 0 && kept < cart.maxLines) {
          quantities[product.id] = Math.min(cart.maxQuantity, amount);
          kept++;
        }
      });
      saved = {};
      var focusWasOnStatus = document.activeElement === cartStatus;
      cartStatus.hidden = true;
      showProducts();
      // The status is gone: keep the focus from being lost
      if (focusWasOnStatus) cartList.focus();
    };
    var loadProducts = function () {
      showSkeleton();
      showStatus("Cargando productos\\u2026", false);
      // The preview tab brings its products: no request is made
      if (cart.productos) {
        applyProducts(cart.productos);
        return;
      }
      fetch(cart.productsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: config.apiKey },
        body: JSON.stringify({ p_slug: config.slug })
      })
        .then(function (response) {
          if (!response.ok) throw new Error("products");
          return response.json();
        })
        .then(applyProducts)
        .catch(function () {
          cartList.textContent = "";
          showStatus("No pudimos cargar los productos.", true, true);
          var retry = element("button", "btn btn-sm", "Reintentar");
          retry.type = "button";
          retry.addEventListener("click", function () {
            // The button disappears with the message: focus moves to the status
            loadProducts();
            cartStatus.focus();
          });
          cartStatus.appendChild(retry);
        });
    };

    [].slice.call(form.querySelectorAll('input[name="pedido_entrega"]')).forEach(function (input) {
      input.addEventListener("change", syncDelivery);
    });

    // The bar hides only while the order summary is on screen, not while choosing products
    if (cartSummary && "IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        summaryVisible = entries[entries.length - 1].isIntersecting;
        updateBar();
      }).observe(cartSummary);
    }

    cartApi = {
      refresh: refresh,
      ready: function () { return loaded; },
      // What goes with the answers: nothing chosen is just an inquiry
      order: function () {
        var picked = chosen();
        if (!picked.length) return { lines: [] };
        var lines = picked.map(function (product) {
          return { producto_id: product.id, cantidad: quantities[product.id] };
        });
        // No delivery step: nothing about delivery is sent and the order stays «a coordinar»
        if (mode === "ninguna") return { lines: lines };
        var delivery = mode === "elegir"
          ? (form.elements.pedido_entrega.value === "retiro" ? "retiro" : "envio")
          : mode;
        var address = delivery === "envio" ? form.elements.pedido_direccion.value.trim() : "";
        if (delivery === "envio" && !address) {
          return { error: "Escribí la dirección de entrega.", field: form.elements.pedido_direccion };
        }
        return { lines: lines, delivery: delivery, address: address };
      },
      // The order is already saved: a failure drawing this must not look like a failed order
      showOrder: function (data, name) {
        quantities = {};
        store.clear();
        refresh();
        var box = document.getElementById("lead-order");
        try {
          box.textContent = "";
          box.appendChild(element("h2", "", "\\u00a1Recibimos tu pedido #" + data.pedido_id + "!"));
          if (Array.isArray(data.lineas)) {
            var list = element("ul", "order-lines");
            data.lineas.forEach(function (line) {
              var row = element("li");
              row.appendChild(element("span", "", line.cantidad + " \\u00d7 " + line.nombre));
              row.appendChild(element("span", "", money.format(line.subtotal)));
              list.appendChild(row);
            });
            box.appendChild(list);
          }
          var totals = element("div", "cart-totals");
          var totalRow = element("div", "row total");
          totalRow.appendChild(element("span", "", "Total"));
          totalRow.appendChild(element("b", "", money.format(data.total)));
          totals.appendChild(totalRow);
          box.appendChild(totals);
          if (cart.phone && Array.isArray(data.lineas)) {
            var link = element("a", "btn", "Abrir WhatsApp");
            link.setAttribute("aria-label", "Abrir WhatsApp (se abre en una pestaña nueva)");
            link.href = "https://wa.me/" + cart.phone + "?text=" + encodeURIComponent(cartMessage(data, name));
            link.target = "_blank";
            link.rel = "noopener";
            box.appendChild(link);
          }
        } catch (e) {}
        box.hidden = false;
        box.focus();
      }
    };
    syncDelivery();
    loadProducts();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy) return;
    errorBox.hidden = true;
    [].slice.call(form.querySelectorAll("[aria-invalid]")).forEach(function (field) {
      field.removeAttribute("aria-invalid");
      field.removeAttribute("aria-describedby");
    });
    var answers = {};
    var missing = null;
    config.fields.forEach(function (field) {
      var value = valueOf(field);
      answers[field.id] = value;
      if (field.required && !value.length && !missing) missing = field.label;
    });
    if (missing) {
      showError("Completá este campo: " + missing);
      return;
    }
    // Products still loading or failed: a send now would go as an inquiry, without the order
    if (cartApi && !cartApi.ready()) {
      showError("Esperá a que carguen los productos o tocá Reintentar.");
      return;
    }
    var order = cartApi ? cartApi.order() : { lines: [] };
    if (order.error) {
      showError(order.error, order.field);
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (config.preview) {
      showError("Vista previa: acá no se envía nada.");
      return;
    }
    var consent = form.elements.consent;
    var original = button.textContent;
    var payload = {
      answers: answers,
      consent: consent ? consent.checked : false,
      utm: utm,
      website: form.elements.website.value
    };
    if (order.lines.length) {
      payload.lineas = order.lines;
      // The same key goes on every retry of this attempt: the database dedupes it
      payload.clave = orderKey();
      if (order.delivery) {
        payload.entrega = order.delivery;
        payload.direccion = order.address;
      }
    }
    busy = true;
    button.disabled = true;
    button.textContent = "Enviando\\u2026";
    post(payload)
      .then(function (response) {
        return response
          .json()
          .catch(function () { return {}; })
          .then(function (body) {
            if (!response.ok) throw body;
            return body;
          });
      })
      .then(function (body) {
        // Answered: the order is in, so the next one starts with a fresh key
        if (payload.clave) memory.set(orderKeyStore, "");
        trackLead();
        finish(answers, body);
      })
      .catch(function (body) {
        busy = false;
        button.disabled = false;
        if (cartApi) { cartApi.refresh(); } else { button.textContent = original; }
        showError(
          body && body.message === "rate_limited"
            ? "Recibimos varios envíos desde tu conexión. Volvé a intentarlo en unos minutos."
            : body && body.hint === "landing_pedido" && typeof body.message === "string" && body.message.length > 0 && body.message.length <= 160
              ? body.message
              : "No pudimos enviar tus datos. Revisá el formulario e intentalo de nuevo."
        );
      });
  });

  // The bar on phones steps aside while the form is on screen
  var bar = document.getElementById("sticky-cta");
  // The form, and the catalog inside it when there is one
  var watched = [document.getElementById("formulario"), document.getElementById("pedido")].filter(Boolean);
  if (bar && watched.length && window.IntersectionObserver) {
    var visible = [];
    var stickyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var at = visible.indexOf(entry.target);
        if (entry.isIntersecting && at === -1) visible.push(entry.target);
        if (!entry.isIntersecting && at !== -1) visible.splice(at, 1);
      });
      bar.classList.toggle("away", visible.length > 0);
    });
    watched.forEach(function (node) { stickyObserver.observe(node); });
  }

  var opener = document.getElementById("wa-open");
  var dialog = document.getElementById("wa-dialog");
  if (opener && dialog && dialog.showModal && !config.preview) {
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
        waError.textContent = "Escribí tu nombre y un número válido.";
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

/**
 * With a cart the form goes below the page, wide enough for the shop: a
 * product grid does not fit in the narrow column next to the hero.
 */
const formBesideHero = ({ design, carrito }: LandingContent) =>
  design.formPosition === "side" && !carrito.activo;

/**
 * Where a script runs: the published page, and the preview tab of a page with
 * a cart (it brings its products and sends nothing). The editor's canvas is
 * sandboxed without scripts, and thumbnails are inert.
 */
const isScripted = (content: LandingContent, options: RenderOptions) =>
  !options.editable &&
  (!options.preview ||
    (content.carrito.activo && options.productos?.estado === "listo"));

export const renderLandingPage = (
  content: LandingContent,
  options: RenderOptions,
) => {
  const { hero, seo } = content;
  const isSide = formBesideHero(content);
  const editable = !!options.editable;
  const preview = !!options.preview || editable;
  const scripted = isScripted(content, options);
  const privacyHref = landingPrivacyPath(options.slug);
  return `<!doctype html>
<html lang="es">
<head>
${head(content, seo.title || hero.title, seo.description || hero.subtitle)}
${preview ? "" : trackingHead(content)}
</head>
<body>
${renderHeader(content, editable)}
${renderHero(content, editable, privacyHref, options)}
${renderSections(content, editable)}
${isSide ? "" : `<section class="section tint" id="s-form"><div class="wrap"><div class="form-below${content.carrito.activo ? " wide" : ""}">${renderForm(content, editable, privacyHref, options)}</div></div></section>`}
${renderFooter(content, editable, privacyHref)}
<div class="sticky-cta" id="sticky-cta"><a class="btn" href="${ctaHref(content)}"${editLine(editable, "hero.ctaLabel")}>${esc(ctaLabel(content))}</a></div>
${renderBarraPedido(content, scripted)}
${renderWhatsapp(content, preview, editable, privacyHref)}
${scripted ? pageScript(content, options) : ""}
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
