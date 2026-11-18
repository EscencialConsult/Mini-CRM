import { MessageCircle } from "lucide-react";
import { useNotify, useRecordContext, useRefresh } from "ra-core";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { formatFechaHora, plural } from "../domain/format";
import {
  DIAS_DE_PRUEBA,
  diasRestantes,
  estadoPrueba,
  type AccionPrueba,
  type EstadoPrueba,
} from "../domain/prueba";
import type { Cuenta } from "../domain/types";
import { enlaceWhatsapp } from "../domain/whatsapp";
import { useCrmIdentity } from "../providers/authProvider";
import { useCrmDataProvider } from "../providers/dataProvider";
import { Pill } from "../shared/badges";
import { useAhora } from "../shared/useAhora";
import { CopiarBoton } from "./CopiarBoton";
import { mensajeSeguimientoPrueba } from "./seguimientoPrueba";
import { buscarTelefono } from "./telefonos";

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

const EXITO: Record<AccionPrueba, string> = {
  iniciar: "Cuenta puesta en prueba",
  extender: "Prueba extendida",
  cortar: "Prueba cortada",
  convertir:
    "La cuenta pasó a ser paga. El plan no cambió: si corresponde otro, elegilo abajo y guardá.",
};

interface Confirmacion {
  pregunta: string;
  etiquetaSi: string;
  variante: "default" | "destructive";
}

const CONFIRMACIONES: Record<AccionPrueba, Confirmacion> = {
  iniciar: {
    pregunta: `Esta cuenta hoy no tiene límite. Si la ponés en prueba, en ${DIAS_DE_PRUEBA} días queda bloqueada y sus usuarios dejan de ver y cambiar datos, salvo que la pases a cuenta paga.`,
    etiquetaSi: "Sí, ponerla en prueba",
    variante: "destructive",
  },
  extender: {
    pregunta: `¿Darle ${DIAS_DE_PRUEBA} días más? La cuenta se desbloquea ahora y se vuelve a cortar sola cuando pasen.`,
    etiquetaSi: `Sí, darle ${DIAS_DE_PRUEBA} días más`,
    variante: "default",
  },
  cortar: {
    pregunta:
      "¿Cortarla ahora? Sus usuarios dejan de ver y cambiar datos al instante.",
    etiquetaSi: "Sí, cortar ahora",
    variante: "destructive",
  },
  convertir: {
    pregunta:
      "¿Pasarla a cuenta paga? Se quita el límite de días y la cuenta queda desbloqueada con el plan que tiene hoy. Si corresponde otro plan, elegilo abajo y guardá.",
    etiquetaSi: "Sí, pasarla a paga",
    variante: "default",
  },
};

/** Confirmaciones que tienen sentido en cada estado (si el estado cambia, las otras se descartan). */
const CONFIRMABLES: Record<EstadoPrueba, readonly AccionPrueba[]> = {
  sin_prueba: ["iniciar"],
  en_prueba: ["cortar", "convertir"],
  terminada: ["extender", "convertir"],
};

/** Seguimiento por WhatsApp de una prueba terminada: teléfono y mensaje editables. */
const SeguimientoPrueba = ({
  cuenta,
  titular,
}: {
  cuenta: Cuenta;
  titular: NonNullable<Cuenta["titular"]>;
}) => {
  const idTelefono = useId();
  const idMensaje = useId();
  const idAyuda = useId();
  const [telefono, setTelefono] = useState("");
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(() =>
    mensajeSeguimientoPrueba({
      nombre: titular.nombre,
      empresa: cuenta.nombre,
    }),
  );
  const enlace = enlaceWhatsapp(telefono, mensaje);
  const email = titular.email;

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    buscarTelefono(email)
      .then((encontrado) => {
        if (vigente) setTelefono(encontrado);
      })
      .catch((error: unknown) => console.warn(error))
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [email]);

  return (
    <div className="space-y-2 rounded-md border p-4">
      <p className="text-sm font-medium">Preguntarle si le interesó</p>
      <Label htmlFor={idTelefono}>WhatsApp del titular</Label>
      <Input
        id={idTelefono}
        type="tel"
        value={telefono}
        disabled={cargando}
        onChange={(evento) => setTelefono(evento.target.value)}
        // Está dentro del formulario de la cuenta: Enter lo enviaría y guardaría
        // lo que haya a medio editar.
        onKeyDown={(evento) => {
          if (evento.key === "Enter") evento.preventDefault();
        }}
        placeholder={cargando ? "Buscando el teléfono…" : "+54 9 11 5555 1234"}
      />
      <Label htmlFor={idMensaje}>Mensaje</Label>
      <Textarea
        id={idMensaje}
        value={mensaje}
        onChange={(evento) => setMensaje(evento.target.value)}
        rows={6}
      />
      <div className="flex flex-wrap gap-2">
        {enlace ? (
          <Button asChild className="min-h-10">
            <a href={enlace} target="_blank" rel="noopener noreferrer">
              <MessageCircle />
              Enviar por WhatsApp
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            aria-describedby={idAyuda}
            className="min-h-10"
          >
            <MessageCircle />
            Enviar por WhatsApp
          </Button>
        )}
        <CopiarBoton
          texto={mensaje}
          etiqueta="Copiar mensaje"
          className="min-h-10"
        />
      </div>
      {!enlace && (
        <p id={idAyuda} className="text-sm text-muted-foreground">
          {cargando
            ? "Buscando el teléfono…"
            : "Escribí el número con el código de país para abrir el chat."}
        </p>
      )}
    </div>
  );
};

/**
 * Prueba gratis en la ficha de la cuenta: estado, vencimiento y las acciones de la
 * plataforma (poner en prueba, extender, cortar, pasar a paga) más, cuando terminó,
 * el mensaje de seguimiento por WhatsApp.
 */
export const SeccionPrueba = () => {
  const cuenta = useRecordContext<Cuenta>();
  const { identity } = useCrmIdentity();
  const dataProvider = useCrmDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [enCurso, setEnCurso] = useState<AccionPrueba | null>(null);
  const [confirmando, setConfirmando] = useState<AccionPrueba | null>(null);
  const idConfirmacion = useId();
  const ahora = useAhora();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const preguntaRef = useRef<HTMLParagraphElement>(null);
  const devolverFoco = useRef<AccionPrueba | null>(null);
  const estado = estadoPrueba(cuenta, ahora);
  const confirmacion =
    confirmando !== null && CONFIRMABLES[estado].includes(confirmando)
      ? confirmando
      : null;

  // Al abrir una confirmación el foco va a la pregunta (no al «Sí»); al cancelar,
  // vuelve al botón que la abrió.
  useEffect(() => {
    if (confirmacion !== null) {
      preguntaRef.current?.focus();
      return;
    }
    const accion = devolverFoco.current;
    devolverFoco.current = null;
    if (accion) {
      contenedorRef.current
        ?.querySelector<HTMLElement>(`[data-accion="${accion}"]`)
        ?.focus();
    }
  }, [confirmacion]);

  if (!cuenta || cuenta.id === identity?.cuenta?.id) return null;

  const ocupado = enCurso !== null;

  const ejecutar = async (accion: AccionPrueba) => {
    setEnCurso(accion);
    try {
      await dataProvider.cambiarPrueba(cuenta.id, accion);
      notify(EXITO[accion], { type: "success" });
      setConfirmando(null);
      refresh();
    } catch (error) {
      notify(mensajeDe(error), { type: "error" });
    } finally {
      setEnCurso(null);
    }
  };

  const boton = (
    accion: AccionPrueba,
    etiqueta: string,
    variante: "default" | "outline" | "destructive",
    alTocar: () => void = () => void ejecutar(accion),
  ) => (
    <Button
      type="button"
      variant={variante}
      className="min-h-10"
      data-accion={accion}
      disabled={ocupado}
      loading={enCurso === accion}
      onClick={alTocar}
    >
      {etiqueta}
    </Button>
  );

  const pedirConfirmacion = (accion: AccionPrueba) => () =>
    setConfirmando(accion);

  const cancelar = () => {
    devolverFoco.current = confirmacion;
    setConfirmando(null);
  };

  const bloqueConfirmacion = (accion: AccionPrueba) => {
    const { pregunta, etiquetaSi, variante } = CONFIRMACIONES[accion];
    return (
      <div role="group" aria-labelledby={idConfirmacion} className="space-y-2">
        <p
          id={idConfirmacion}
          ref={preguntaRef}
          tabIndex={-1}
          className="text-sm text-muted-foreground outline-none"
        >
          {pregunta}
        </p>
        <div className="flex flex-wrap gap-2">
          {boton(accion, etiquetaSi, variante)}
          <Button
            type="button"
            variant="ghost"
            className="min-h-10"
            disabled={ocupado}
            onClick={cancelar}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  };

  if (estado === "sin_prueba") {
    return (
      <div ref={contenedorRef} className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Esta cuenta no tiene prueba gratis: no se corta sola.
        </p>
        {confirmacion !== null
          ? bloqueConfirmacion(confirmacion)
          : boton(
              "iniciar",
              `Poner en prueba (${DIAS_DE_PRUEBA} días)`,
              "outline",
              pedirConfirmacion("iniciar"),
            )}
      </div>
    );
  }

  if (estado === "en_prueba") {
    const faltan = diasRestantes(cuenta, ahora) ?? 1;
    return (
      <div ref={contenedorRef} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tono="aviso">En prueba</Pill>
          <p className="text-sm">
            Vence el {formatFechaHora(cuenta.prueba_hasta)} (en{" "}
            {plural(faltan, "día", "días")}). Después se corta sola.
          </p>
        </div>
        {confirmacion !== null ? (
          bloqueConfirmacion(confirmacion)
        ) : (
          <div className="flex flex-wrap gap-2">
            {boton("extender", `Extender ${DIAS_DE_PRUEBA} días`, "outline")}
            {boton(
              "cortar",
              "Cortar ahora",
              "destructive",
              pedirConfirmacion("cortar"),
            )}
            {boton(
              "convertir",
              "Pasar a cuenta paga",
              "default",
              pedirConfirmacion("convertir"),
            )}
          </div>
        )}
        {confirmacion === null && (
          <p className="text-xs text-muted-foreground">
            Pasar a cuenta paga quita el límite de días al instante y no cambia
            el plan: si corresponde otro, elegilo abajo y guardá.
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={contenedorRef} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tono="peligro">Prueba terminada</Pill>
        <p className="text-sm">
          Terminó el {formatFechaHora(cuenta.prueba_hasta)}. La cuenta está
          bloqueada: sus usuarios no ven ni cambian datos.
        </p>
      </div>
      {confirmacion !== null ? (
        bloqueConfirmacion(confirmacion)
      ) : (
        <div className="flex flex-wrap gap-2">
          {boton(
            "extender",
            `Dar ${DIAS_DE_PRUEBA} días más`,
            "outline",
            pedirConfirmacion("extender"),
          )}
          {boton(
            "convertir",
            "Pasar a cuenta paga",
            "default",
            pedirConfirmacion("convertir"),
          )}
        </div>
      )}
      {cuenta.titular ? (
        <SeguimientoPrueba cuenta={cuenta} titular={cuenta.titular} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta cuenta no tiene titular: no hay a quién escribirle.
        </p>
      )}
    </div>
  );
};
