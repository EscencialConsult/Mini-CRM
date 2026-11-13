import { useState, type FormEvent } from "react";
import { Bot, Check, Loader2, Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { formatMoneda } from "../domain/format";
import { useCrmIdentity } from "../providers/authProvider";
import { getSupabaseClient } from "../providers/supabase";

type Propuesta = {
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
  descripcion?: string;
  productoId: number;
  productoNombre: string;
  precio: number;
};

type Mensaje = { role: "user" | "assistant"; content: string; propuesta?: Propuesta };

type Cuerpo = { mensajes: Mensaje[] } | { confirmar: Propuesta };

type RespuestaAsistente = { respuesta: string; propuesta?: Propuesta; error?: string };

const MAX_CARACTERES = 2000;

const llamarAsistente = async (cuerpo: Cuerpo): Promise<RespuestaAsistente> => {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");

  // Del historial sólo viaja el texto: la tarjeta de propuesta es sólo visual.
  const payload =
    "mensajes" in cuerpo
      ? { mensajes: cuerpo.mensajes.map(({ role, content }) => ({ role, content })) }
      : cuerpo;

  const res = await fetch("/api/asistente", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const salida = (await res.json().catch(() => null)) as RespuestaAsistente | null;
  if (!res.ok || !salida?.respuesta) {
    throw new Error(salida?.error ?? "No se pudo obtener respuesta del asistente.");
  }
  return salida;
};

export const AsistenteFlotante = () => {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { identity } = useCrmIdentity();

  // Sólo administradores activos: el servidor lo vuelve a validar.
  if (identity?.rol !== "administrador") return null;

  const correr = async (base: Mensaje[], cuerpo: Cuerpo) => {
    setCargando(true);
    setError(null);
    try {
      const salida = await llamarAsistente(cuerpo);
      setMensajes([...base, { role: "assistant", content: salida.respuesta, propuesta: salida.propuesta }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
    } finally {
      setCargando(false);
    }
  };

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const consulta = texto.trim();
    if (!consulta || cargando) return;
    const nuevos: Mensaje[] = [...mensajes, { role: "user", content: consulta }];
    setMensajes(nuevos);
    setTexto("");
    void correr(nuevos, { mensajes: nuevos });
  };

  const confirmar = (indice: number) => {
    const propuesta = mensajes[indice]?.propuesta;
    if (!propuesta || cargando) return;
    const base = mensajes.map((m, i) => (i === indice ? { ...m, propuesta: undefined } : m));
    setMensajes(base);
    void correr(base, { confirmar: propuesta });
  };

  const cancelar = (indice: number) => {
    setMensajes([
      ...mensajes.map((m, i) => (i === indice ? { ...m, propuesta: undefined } : m)),
      { role: "assistant", content: "Cancelado. No registré nada." },
    ]);
  };

  return (
    <>
      <Button
        type="button"
        size="icon"
        aria-label="Abrir asistente"
        onClick={() => setAbierto(true)}
        className="fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full shadow-lg"
      >
        <Bot className="size-5" aria-hidden="true" />
      </Button>

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Asistente</SheetTitle>
            <SheetDescription>Consultá el CRM y registrá prospectos en lenguaje natural.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {mensajes.length === 0 && !cargando && (
              <p className="text-sm text-muted-foreground">
                Ejemplos: "¿qué oportunidades tengo en negociación?", "¿de qué producto tengo más clientes?" o
                "registrá un prospecto llamado Ana Gómez, interesada en Coaching ejecutivo".
              </p>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className="space-y-2">
                <div
                  className={
                    m.role === "user"
                      ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.content}
                </div>

                {m.propuesta && (
                  <div className="mr-auto w-full max-w-[90%] space-y-3 rounded-lg border bg-card p-3 text-sm">
                    <p className="font-medium">Registrar prospecto</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                      <dt className="text-muted-foreground">Nombre</dt>
                      <dd>{[m.propuesta.nombre, m.propuesta.apellido].filter(Boolean).join(" ")}</dd>
                      {m.propuesta.telefono && (
                        <>
                          <dt className="text-muted-foreground">Teléfono</dt>
                          <dd>{m.propuesta.telefono}</dd>
                        </>
                      )}
                      {m.propuesta.email && (
                        <>
                          <dt className="text-muted-foreground">Email</dt>
                          <dd className="break-all">{m.propuesta.email}</dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">Producto</dt>
                      <dd>
                        {m.propuesta.productoNombre} ({formatMoneda(m.propuesta.precio)})
                      </dd>
                      {m.propuesta.descripcion && (
                        <>
                          <dt className="text-muted-foreground">Nota</dt>
                          <dd className="whitespace-pre-wrap">{m.propuesta.descripcion}</dd>
                        </>
                      )}
                    </dl>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="h-10 flex-1"
                        onClick={() => confirmar(i)}
                        disabled={cargando}
                      >
                        <Check aria-hidden="true" />
                        Confirmar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 flex-1"
                        onClick={() => cancelar(i)}
                        disabled={cargando}
                      >
                        <X aria-hidden="true" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {cargando && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Consultando…
              </div>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <form onSubmit={enviar} className="flex items-end gap-2 border-t p-4">
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MAX_CARACTERES}
              placeholder="Escribí tu consulta"
              aria-label="Consulta para el asistente"
              rows={2}
              className="min-h-10 resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Enviar consulta"
              disabled={cargando || !texto.trim()}
              className="h-10 w-10 shrink-0"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
};
