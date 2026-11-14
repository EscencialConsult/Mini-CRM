/**
 * Fondo del login: una cinta de líneas finas que ondula (como un "blend" entre
 * dos curvas) y racimos de hexágonos de trazo fino y grueso con nodos llenos.
 * Todo es geometría fija calculada una vez: estático, sin animación. Las ondas
 * solo ocupan la franja superior (máscara vertical) para no pasar por detrás
 * del isotipo ni del contenido.
 */
const ANCHO = 1600;
const ALTO = 900;

type Punto = readonly [number, number];

/** Spline de Catmull-Rom → curvas de Bézier cúbicas. */
const suavizar = (p: Punto[]) => {
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(i - 1, 0)];
    const b = p[i];
    const c = p[i + 1];
    const e = p[Math.min(i + 2, p.length - 1)];
    const c1 = [b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6];
    const c2 = [c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${c[0].toFixed(1)},${c[1].toFixed(1)}`;
  }
  return d;
};

interface ParamsOnda {
  base: number;
  pendiente: number;
  amplitud: number;
  frecuencia: number;
  fase: number;
  ancho: number;
  lineas: number;
}

/** Líneas intermedias entre un borde y otro; se juntan hacia el borde brillante. */
const crearOnda = (o: ParamsOnda) => {
  const pasos = 9;
  const borde = (k: number, extra: number): Punto => {
    const x = -120 + (k * (ANCHO + 240)) / (pasos - 1);
    const y =
      o.base +
      k * o.pendiente +
      o.amplitud * Math.sin(k * o.frecuencia + o.fase) +
      extra;
    return [x, y];
  };
  return Array.from({ length: o.lineas }, (_, i) => {
    const t = i / (o.lineas - 1);
    const puntos = Array.from({ length: pasos }, (_, k) => {
      const ancho = o.ancho * (0.65 + 0.55 * Math.sin(k * 0.75 + o.fase + 1));
      return borde(k, ancho * t ** 1.35);
    });
    return { d: suavizar(puntos), opacidad: 0.1 + 0.65 * t ** 1.6 };
  });
};

const ONDAS = [
  crearOnda({
    base: -90,
    pendiente: 38,
    amplitud: 120,
    frecuencia: 0.85,
    fase: 0,
    ancho: 300,
    lineas: 56,
  }),
  crearOnda({
    base: 20,
    pendiente: -10,
    amplitud: 80,
    frecuencia: 1.0,
    fase: 2.2,
    ancho: 190,
    lineas: 40,
  }),
];

interface Hexagono {
  cx: number;
  cy: number;
  r: number;
  /** Grosor del trazo: finos (1.4) y gruesos (6–9), como en la referencia. */
  w: number;
}
interface Nodo {
  cx: number;
  cy: number;
  r: number;
}

const HEXAGONOS: Hexagono[] = [
  { cx: 60, cy: 470, r: 78, w: 1.4 },
  { cx: 215, cy: 565, r: 62, w: 1.4 },
  { cx: 90, cy: 655, r: 70, w: 9 },
  { cx: 235, cy: 745, r: 60, w: 1.4 },
  { cx: 395, cy: 715, r: 54, w: 7 },
  { cx: 345, cy: 835, r: 50, w: 1.4 },
  { cx: 125, cy: 815, r: 92, w: 1.4 },
  { cx: 480, cy: 800, r: 56, w: 1.4 },
  { cx: 560, cy: 905, r: 50, w: 7 },
  { cx: 300, cy: 905, r: 64, w: 9 },
  { cx: 28, cy: 340, r: 34, w: 6 },
  { cx: 170, cy: 385, r: 46, w: 1.4 },
  { cx: 1500, cy: 110, r: 62, w: 1.4 },
  { cx: 1385, cy: 55, r: 40, w: 6 },
  { cx: 1545, cy: 265, r: 46, w: 1.4 },
  { cx: 1430, cy: 220, r: 30, w: 1.4 },
];

const NODOS: Nodo[] = [
  { cx: 205, cy: 462, r: 11 },
  { cx: 112, cy: 566, r: 9 },
  { cx: 310, cy: 655, r: 7 },
  { cx: 468, cy: 690, r: 6 },
  { cx: 262, cy: 828, r: 5 },
  { cx: 1440, cy: 165, r: 8 },
  { cx: 1560, cy: 190, r: 5 },
];

const poligono = ({ cx, cy, r }: Hexagono) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

const Degrade = () => (
  <defs>
    <linearGradient
      id="fondo-login-degrade"
      gradientUnits="userSpaceOnUse"
      x1="0"
      y1="0"
      x2={ANCHO}
      y2={ALTO}
    >
      <stop offset="0" style={{ stopColor: "var(--marca-1)" }} />
      <stop offset="0.55" style={{ stopColor: "var(--marca-2)" }} />
      <stop offset="1" style={{ stopColor: "var(--marca-3)" }} />
    </linearGradient>
  </defs>
);

const capa = "pointer-events-none absolute inset-0 hidden size-full md:block";

const GRUPOS_HEXAGONOS = [
  {
    gruesos: false,
    opacidad: "opacity-60",
  },
  {
    gruesos: true,
    opacidad: "opacity-90",
  },
];

export const FondoLogin = () => (
  <div
    aria-hidden
    className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,0.3)_0%,black_75%)]"
  >
    <div className="absolute inset-0 [mask-image:linear-gradient(to_bottom,black_0%,black_12%,transparent_32%)]">
      {ONDAS.map((lineas, i) => (
        <svg
          key={i}
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          preserveAspectRatio="xMidYMid slice"
          className={`${capa} ${i === 0 ? "opacity-90" : "opacity-60"}`}
        >
          <Degrade />
          {lineas.map((l, j) => (
            <path
              key={j}
              d={l.d}
              fill="none"
              stroke="url(#fondo-login-degrade)"
              strokeWidth={0.8}
              strokeOpacity={l.opacidad}
            />
          ))}
        </svg>
      ))}
    </div>

    {/* Hexágonos finos y gruesos */}
    {GRUPOS_HEXAGONOS.map((grupo, i) => (
      <svg
        key={i}
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        preserveAspectRatio="xMidYMid slice"
        className={`${capa} ${grupo.opacidad}`}
      >
        <Degrade />
        {HEXAGONOS.filter((h) => h.w >= 3 === grupo.gruesos).map((h, j) => (
          <polygon
            key={j}
            points={poligono(h)}
            fill="none"
            stroke="url(#fondo-login-degrade)"
            strokeWidth={h.w}
            strokeLinejoin="miter"
          />
        ))}
        {grupo.gruesos &&
          NODOS.map((n, j) => (
            <circle
              key={j}
              cx={n.cx}
              cy={n.cy}
              r={n.r}
              fill="url(#fondo-login-degrade)"
            />
          ))}
      </svg>
    ))}
  </div>
);
