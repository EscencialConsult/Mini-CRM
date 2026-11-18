import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNotify } from "ra-core";
import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

import { CopiarBoton } from "../cuentas/CopiarBoton";
import {
  confirmarCodigoMfa,
  desactivarMfa,
  iniciarInscripcionMfa,
  leerEstadoMfa,
} from "../providers/mfa";
import { Pill } from "../shared/badges";

interface Inscripcion {
  factorId: string;
  qr: string;
  secreto: string;
}

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

const Titulo = () => (
  <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    Verificación en dos pasos
  </h3>
);

const CampoCodigo = ({
  valor,
  alCambiar,
  invalido,
}: {
  valor: string;
  alCambiar: (valor: string) => void;
  invalido: boolean;
}) => {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Código de 6 dígitos</Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) =>
          alCambiar(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-invalid={invalido}
        className="h-10 max-w-48 font-mono tracking-widest"
      />
    </div>
  );
};

const MensajeError = ({ mensaje }: { mensaje: string | null }) =>
  mensaje ? (
    <p role="alert" className="text-sm text-destructive">
      {mensaje}
    </p>
  ) : null;

/** Vincular la aplicación de autenticación: QR, secreto y primer código. */
const Vinculando = ({
  inscripcion,
  alTerminar,
  alCancelar,
}: {
  inscripcion: Inscripcion;
  alTerminar: () => Promise<void>;
  alCancelar: () => void;
}) => {
  const [codigo, setCodigo] = useState("");
  const confirmar = useMutation({
    mutationFn: () => confirmarCodigoMfa(inscripcion.factorId, codigo.trim()),
    onSuccess: alTerminar,
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    confirmar.mutate();
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escaneá el código con tu aplicación de autenticación e ingresá el código
        que te muestra.
      </p>
      <img
        src={inscripcion.qr}
        alt="Código QR para vincular tu aplicación de autenticación"
        width={176}
        height={176}
        // Blanco fijo a propósito: sin fondo claro el QR no se puede escanear en modo oscuro.
        className="size-44 rounded-lg border bg-white p-2"
      />
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          ¿No podés escanear? Ingresá este secreto a mano:
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 rounded-md bg-muted px-2 py-1 font-mono text-sm break-all">
            {inscripcion.secreto}
          </code>
          <CopiarBoton
            texto={inscripcion.secreto}
            className="min-h-10 min-w-10"
          />
        </div>
      </div>
      <CampoCodigo
        valor={codigo}
        alCambiar={(valor) => {
          setCodigo(valor);
          if (confirmar.isError) confirmar.reset();
        }}
        invalido={confirmar.isError}
      />
      <MensajeError
        mensaje={confirmar.isError ? mensajeDe(confirmar.error) : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          className="min-h-10"
          loading={confirmar.isPending}
          disabled={codigo.length !== 6}
        >
          Confirmar y activar
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={alCancelar}
          disabled={confirmar.isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};

/** Desactivar: pide el código si la sesión no está confirmada; si no, una confirmación. */
const Desactivando = ({
  factorId,
  sesionConfirmada,
  alTerminar,
  alCancelar,
}: {
  factorId: string;
  sesionConfirmada: boolean;
  alTerminar: () => Promise<void>;
  alCancelar: () => void;
}) => {
  const [codigo, setCodigo] = useState("");
  const desactivar = useMutation({
    mutationFn: async () => {
      if (!sesionConfirmada) await confirmarCodigoMfa(factorId, codigo.trim());
      await desactivarMfa(factorId);
    },
    onSuccess: alTerminar,
  });

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    desactivar.mutate();
  };

  return (
    <form onSubmit={enviar} className="space-y-3">
      {sesionConfirmada ? (
        <p className="text-sm">¿Seguro? Se va a dejar de pedir el código.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Para desactivarla, ingresá el código de tu aplicación.
          </p>
          <CampoCodigo
            valor={codigo}
            alCambiar={(valor) => {
              setCodigo(valor);
              if (desactivar.isError) desactivar.reset();
            }}
            invalido={desactivar.isError}
          />
        </>
      )}
      <MensajeError
        mensaje={desactivar.isError ? mensajeDe(desactivar.error) : null}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          className="min-h-10"
          loading={desactivar.isPending}
          disabled={!sesionConfirmada && codigo.length !== 6}
        >
          {sesionConfirmada ? "Sí, desactivar" : "Desactivar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={alCancelar}
          disabled={desactivar.isPending}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
};

/** Verificación en dos pasos (app de autenticación) del dueño del sistema. */
export const SeccionDosPasos = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [inscripcion, setInscripcion] = useState<Inscripcion | null>(null);
  const [desactivando, setDesactivando] = useState(false);

  const estado = useQuery({
    queryKey: ["mfa", "estado"],
    queryFn: leerEstadoMfa,
  });

  const refrescar = () =>
    queryClient.invalidateQueries({ queryKey: ["mfa", "estado"] });

  const iniciar = useMutation({
    mutationFn: iniciarInscripcionMfa,
    onSuccess: setInscripcion,
  });

  let contenido;
  if (inscripcion) {
    contenido = (
      <Vinculando
        inscripcion={inscripcion}
        alCancelar={() => setInscripcion(null)}
        alTerminar={async () => {
          setInscripcion(null);
          await refrescar();
          notify("Verificación en dos pasos activada", { type: "success" });
        }}
      />
    );
  } else if (estado.isPending) {
    contenido = (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </div>
    );
  } else if (estado.isError) {
    contenido = (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {mensajeDe(estado.error)}
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={() => void estado.refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  } else if (estado.data.activada && estado.data.factorId) {
    const { factorId, sesionConfirmada } = estado.data;
    contenido = desactivando ? (
      <Desactivando
        factorId={factorId}
        sesionConfirmada={sesionConfirmada}
        alCancelar={() => setDesactivando(false)}
        alTerminar={async () => {
          setDesactivando(false);
          await refrescar();
          notify("Verificación en dos pasos desactivada", { type: "success" });
        }}
      />
    ) : (
      <div className="space-y-3">
        <Pill tono="exito">Activada</Pill>
        <p className="text-sm text-muted-foreground">
          Para administrar cuentas vas a necesitar el código de tu aplicación.
        </p>
        <Button
          type="button"
          variant="outline"
          className="min-h-10"
          onClick={() => setDesactivando(true)}
        >
          Desactivar
        </Button>
      </div>
    );
  } else {
    contenido = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Protegé la administración de cuentas: además de tu contraseña, se va a
          pedir un código de tu aplicación de autenticación.
        </p>
        <MensajeError
          mensaje={iniciar.isError ? mensajeDe(iniciar.error) : null}
        />
        <Button
          type="button"
          className="min-h-10"
          loading={iniciar.isPending}
          onClick={() => iniciar.mutate()}
        >
          Activar verificación en dos pasos
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <Titulo />
      {contenido}
      {estado.data?.activada && (
        <p className="text-xs text-muted-foreground">
          Si perdés tu aplicación, quitá el factor desde el panel de Supabase
          (Authentication → Users).
        </p>
      )}
    </section>
  );
};
