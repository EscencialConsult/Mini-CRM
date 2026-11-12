import { CircleAlert, MessageCircle } from "lucide-react";
import { useTranslate } from "ra-core";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { enlaceWhatsApp, formatMoneda, plural } from "../domain/format";
import type { Landing, Producto } from "../domain/types";
import { useProductos } from "../productos/useProductos";
import {
  EditorSection,
  type PatchLanding,
  Segmented,
  SwitchField,
  TextField,
} from "./landingControls";
import { SETTINGS_ANCHORS } from "./landingChecklist";
import {
  armarMensajeCarrito,
  CARRITO_ENTREGAS,
  CARRITO_MAX_PRODUCTOS,
  carritoTelefono,
  CARRITO_PLANTILLA_MENSAJE,
  CARRITO_TITULO_BOTON,
  type LandingContent,
  type LineaCarritoMensaje,
  normalizeLandingContent,
  phoneDigits,
} from "./pagina/schema.ts";

const CART = "resources.landings.editor.cart";
const VARIABLES = ["pedido", "nombre", "lineas", "total"] as const;

const sinTildes = (texto: string) =>
  texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Hasta dos productos reales (o uno inventado) para que la vista previa se parezca a la landing. */
const lineasDeEjemplo = (productos: Producto[]): LineaCarritoMensaje[] => {
  if (!productos.length) {
    return [
      {
        nombre: "Producto de ejemplo",
        cantidad: 2,
        precio: 1500,
        subtotal: 3000,
      },
    ];
  }
  return productos.slice(0, 2).map((producto, indice) => {
    const cantidad = indice === 0 ? 2 : 1;
    return {
      nombre: producto.nombre,
      cantidad,
      precio: producto.precio,
      subtotal: Math.round(cantidad * producto.precio * 100) / 100,
    };
  });
};

/** Aviso que no bloquea nada: usa los tokens de advertencia del tema. */
const Aviso = ({ children }: { children: ReactNode }) => (
  <div
    role="status"
    className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/20 p-3 text-sm text-warning-foreground"
  >
    <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
    <span>{children}</span>
  </div>
);

/** Qué productos ofrece el carrito: todos los activos, o solo los que se tildan. */
const ProductosDelCarrito = ({
  ids,
  onChange,
}: {
  ids: number[];
  onChange: (ids: number[]) => void;
}) => {
  const translate = useTranslate();
  const t = (key: string, options?: object) =>
    translate(`${CART}.${key}`, options);
  const baseId = useId();
  const { productos, activos, isPending, hayError } = useProductos();
  const [quiereAlgunos, setQuiereAlgunos] = useState(ids.length > 0);
  const [busqueda, setBusqueda] = useState("");
  const soloAlgunos = quiereAlgunos || ids.length > 0;

  // Los activos y, para poder destildarlos, los elegidos que se desactivaron después
  const ofrecibles = productos.filter(
    (producto) => producto.activo || ids.includes(producto.id),
  );
  const buscado = sinTildes(busqueda.trim());
  const visibles = buscado
    ? ofrecibles.filter((producto) =>
        sinTildes(producto.nombre).includes(buscado),
      )
    : ofrecibles;
  const elegidos = ofrecibles.filter((producto) => ids.includes(producto.id));

  // Lo que ve el visitante: solo salen los activos
  const ofrecidos = soloAlgunos
    ? elegidos.filter((producto) => producto.activo).length
    : activos.length;
  const llegoAlMaximo = ids.length >= CARRITO_MAX_PRODUCTOS;
  const alternar = (id: number, tildado: boolean) => {
    if (!tildado) return onChange(ids.filter((otro) => otro !== id));
    if (!llegoAlMaximo) onChange([...ids, id]);
  };

  return (
    <div className="space-y-3">
      <Segmented
        label={t("products_mode")}
        value={soloAlgunos ? "algunos" : "todos"}
        options={[
          { value: "todos", label: t("products_all") },
          { value: "algunos", label: t("products_some") },
        ]}
        onChange={(modo) => {
          setQuiereAlgunos(modo === "algunos");
          if (modo === "todos") onChange([]);
        }}
      />
      <p className="text-xs text-muted-foreground">
        {soloAlgunos ? t("products_some_help") : t("products_all_help")}
      </p>
      {!isPending && !hayError && ofrecidos > 0 && (
        <p className="text-sm font-medium">
          {t("products_offered", { smart_count: ofrecidos })}
        </p>
      )}

      {soloAlgunos && isPending && (
        <div className="space-y-2" aria-busy="true">
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}
      {soloAlgunos && !isPending && hayError && (
        <p role="alert" className="text-sm text-destructive">
          {t("products_error")}
        </p>
      )}
      {soloAlgunos && !isPending && !hayError && !ofrecibles.length && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {t("products_empty")}
        </p>
      )}
      {soloAlgunos && !isPending && !hayError && ofrecibles.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              value={busqueda}
              placeholder={t("products_search")}
              aria-label={t("products_search")}
              className="min-h-10 min-w-0 flex-1 basis-48"
              onChange={(evento) => setBusqueda(evento.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              className="min-h-10"
              disabled={!ids.length}
              onClick={() => onChange([])}
            >
              {t("products_clear")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {elegidos.length
              ? t("products_chosen", { smart_count: elegidos.length })
              : t("products_none_chosen")}
            {llegoAlMaximo &&
              ` · ${t("products_max", { max: CARRITO_MAX_PRODUCTOS })}`}
          </p>
          {visibles.length ? (
            <ul
              aria-label={t("products_list")}
              className="max-h-64 divide-y overflow-y-auto rounded-lg border"
            >
              {visibles.map((producto) => {
                const inputId = `${baseId}-${producto.id}`;
                const tildado = ids.includes(producto.id);
                return (
                  <li
                    key={producto.id}
                    className="flex items-center gap-3 px-3"
                  >
                    <Checkbox
                      id={inputId}
                      checked={tildado}
                      disabled={!tildado && llegoAlMaximo}
                      onCheckedChange={(valor) =>
                        alternar(producto.id, valor === true)
                      }
                    />
                    <Label
                      htmlFor={inputId}
                      className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center justify-between gap-3 font-normal"
                    >
                      <span className="min-w-0 break-words">
                        {producto.nombre}
                        {!producto.activo && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({t("inactive")})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {formatMoneda(producto.precio)}
                      </span>
                    </Label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("products_no_match")}
            </p>
          )}
        </div>
      )}
      {!isPending && !hayError && ofrecidos === 0 && (
        <Aviso>{t("products_none_active")}</Aviso>
      )}
    </div>
  );
};

/**
 * El carrito de la landing: el visitante elige productos, se guarda un pedido
 * en el CRM (con los precios del catálogo) y se abre WhatsApp con el mensaje.
 * Todo va en `borrador.carrito` y se publica con la landing.
 */
export const LandingCarritoSettings = ({
  content,
  patch,
  landing,
}: {
  content: LandingContent;
  patch: PatchLanding;
  landing?: Landing;
}) => {
  const translate = useTranslate();
  const t = (key: string, options?: object) =>
    translate(`${CART}.${key}`, options);
  const { carrito } = content;
  const { activos, porId } = useProductos();
  const type = (key: string, recipe: (draft: LandingContent) => void) =>
    patch(recipe, { mergeKey: key });

  // Los visitantes ven lo publicado: el borrador con carrito no alcanza hasta publicar
  const publicado =
    landing?.estado === "publicada"
      ? normalizeLandingContent(landing.publicada).carrito
      : null;
  const faltaPublicar =
    carrito.activo &&
    (!publicado || JSON.stringify(publicado) !== JSON.stringify(carrito));
  const faltaQuitar = !carrito.activo && publicado?.activo === true;

  const digitos = phoneDigits(carrito.telefonoWhatsapp);
  const telefonoEscrito = carrito.telefonoWhatsapp.trim() !== "";
  // La landing usa los dígitos tal cual: si faltan el 54 o el 9, el chat no abre
  const sugerido =
    enlaceWhatsApp(carrito.telefonoWhatsapp)?.replace("https://wa.me/", "") ??
    "";
  const faltaCompletar = !!sugerido && sugerido !== digitos;

  const baseEjemplo = carrito.productoIds.length
    ? carrito.productoIds.flatMap((id) => porId.get(id) ?? [])
    : activos;
  const lineas = lineasDeEjemplo(baseEjemplo);
  const vistaPrevia = armarMensajeCarrito(carrito.plantillaMensaje, {
    pedido: 1024,
    nombre: "Lucía Gómez",
    lineas,
    total: lineas.reduce((suma, linea) => suma + linea.subtotal, 0),
  });

  return (
    <div id={SETTINGS_ANCHORS.cart} className="scroll-mt-24 space-y-6">
      <EditorSection title={t("title")} help={t("help")}>
        <SwitchField
          label={t("enabled")}
          hint={t("enabled_hint")}
          checked={carrito.activo}
          onChange={(activo) =>
            patch((draft) => {
              draft.carrito.activo = activo;
            })
          }
        />
        {carrito.activo && (
          <p className="text-xs text-muted-foreground">{t("test_hint")}</p>
        )}
        {faltaQuitar && <Aviso>{t("unpublish_warning")}</Aviso>}
      </EditorSection>

      {carrito.activo && (
        <>
          {faltaPublicar && <Aviso>{t("publish_warning")}</Aviso>}
          {!digitos && !carritoTelefono(content) && (
            <Aviso>{t("no_phone_warning")}</Aviso>
          )}

          <EditorSection title={t("delivery")} help={t("delivery_help")}>
            <Segmented
              label={t("delivery")}
              value={carrito.entrega}
              options={CARRITO_ENTREGAS.map((valor) => ({
                value: valor,
                label: t(`delivery_options.${valor}`),
              }))}
              onChange={(entrega) =>
                patch((draft) => {
                  draft.carrito.entrega = entrega;
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              {t(`delivery_hint.${carrito.entrega}`)}
            </p>
          </EditorSection>

          <EditorSection title={t("products")} help={t("products_help")}>
            <ProductosDelCarrito
              ids={carrito.productoIds}
              onChange={(ids) =>
                patch((draft) => {
                  draft.carrito.productoIds = ids;
                })
              }
            />
          </EditorSection>

          <EditorSection title={t("whatsapp")} help={t("whatsapp_help")}>
            <TextField
              label={t("phone")}
              hint={t("phone_hint")}
              placeholder="+54 9 11 1234-5678"
              error={
                telefonoEscrito && !digitos ? t("phone_invalid") : undefined
              }
              value={carrito.telefonoWhatsapp}
              onChange={(value) =>
                type("carrito.telefonoWhatsapp", (draft) => {
                  draft.carrito.telefonoWhatsapp = value;
                })
              }
            />
            {/* Vacío = la landing usa el número del botón de WhatsApp */}
            {!!phoneDigits(content.whatsapp.phone) &&
              content.whatsapp.phone.trim() !==
                carrito.telefonoWhatsapp.trim() &&
              (!content.whatsapp.enabled || telefonoEscrito) && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    onClick={() =>
                      patch((draft) => {
                        draft.carrito.telefonoWhatsapp = draft.whatsapp.phone;
                      })
                    }
                  >
                    {t("phone_use_button")}
                  </Button>
                </div>
              )}
            {faltaCompletar && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 basis-56 text-muted-foreground">
                  {t("phone_complete_hint", { numero: `+${sugerido}` })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10"
                  onClick={() =>
                    patch((draft) => {
                      draft.carrito.telefonoWhatsapp = `+${sugerido}`;
                    })
                  }
                >
                  {t("phone_complete", { numero: `+${sugerido}` })}
                </Button>
              </div>
            )}
            <TextField
              label={t("button_label")}
              hint={t("button_label_hint")}
              placeholder={CARRITO_TITULO_BOTON}
              value={carrito.tituloBoton}
              onChange={(value) =>
                type("carrito.tituloBoton", (draft) => {
                  draft.carrito.tituloBoton = value;
                })
              }
            />
          </EditorSection>

          <EditorSection title={t("message")} help={t("message_help")}>
            <TextField
              label={t("template")}
              multiline
              rows={5}
              value={carrito.plantillaMensaje}
              onChange={(value) =>
                type("carrito.plantillaMensaje", (draft) => {
                  draft.carrito.plantillaMensaje = value;
                })
              }
            />
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">{t("variables")}</p>
              <ul className="flex flex-wrap gap-2">
                {VARIABLES.map((variable) => (
                  <li key={variable}>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 font-mono text-xs"
                      aria-label={t("variable_add", {
                        variable: `{${variable}}`,
                        descripcion: t(`variables_help.${variable}`),
                      })}
                      title={t(`variables_help.${variable}`)}
                      onClick={() =>
                        patch((draft) => {
                          const actual = draft.carrito.plantillaMensaje;
                          draft.carrito.plantillaMensaje = `${actual}${
                            actual && !/\s$/.test(actual) ? " " : ""
                          }{${variable}}`;
                        })
                      }
                    >
                      {`{${variable}}`}
                    </Button>
                  </li>
                ))}
              </ul>
              <dl className="grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                {VARIABLES.map((variable) => (
                  <div key={variable} className="flex gap-1">
                    <dt className="font-mono">{`{${variable}}`}</dt>
                    <dd>{t(`variables_help.${variable}`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="min-h-10"
              disabled={carrito.plantillaMensaje === CARRITO_PLANTILLA_MENSAJE}
              onClick={() =>
                patch((draft) => {
                  draft.carrito.plantillaMensaje = CARRITO_PLANTILLA_MENSAJE;
                })
              }
            >
              {t("template_restore")}
            </Button>

            <figure className="space-y-1.5">
              <figcaption className="text-xs font-medium text-muted-foreground">
                {t("preview")}
              </figcaption>
              <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3">
                <MessageCircle
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                />
                <p className="min-w-0 text-sm break-words whitespace-pre-line">
                  {vistaPrevia}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("preview_note", {
                  productos: plural(lineas.length, "producto", "productos"),
                })}
              </p>
            </figure>
          </EditorSection>
        </>
      )}
    </div>
  );
};
