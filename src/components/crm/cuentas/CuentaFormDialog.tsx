import { Ban, RefreshCw, RotateCcw } from "lucide-react";
import { required, useNotify, useRecordContext } from "ra-core";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { generarClave } from "../domain/claves";
import { formatFecha } from "../domain/format";
import { MODULOS, MODULOS_OPCIONALES } from "../domain/modulos";
import type { Cuenta } from "../domain/types";
import { validarClave, validarEmailObligatorio } from "../domain/validators";
import { useCrmDataProvider } from "../providers/dataProvider";
import { GuardarCon } from "../shared/RecordForm";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { ModulosInput } from "../usuarios/ModulosInput";
import { CopiarBoton } from "./CopiarBoton";
import type { CredencialesCuenta } from "./CredencialesCuenta";
import { PLANES, type PlanComercial } from "./planes";
import {
  marcarAltaHecha,
  useSolicitudes,
  type Solicitud,
} from "./useSolicitudes";

// Los extras (asistente) se contratan aparte: no vienen marcados
const MODULOS_INICIALES = MODULOS.map((modulo) => modulo.id).filter(
  (id) => !MODULOS_OPCIONALES.includes(id),
);

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

/** Cupo vacío = sin límite. */
const aMaximo = (valor: unknown): number | null =>
  valor === "" || valor === null || valor === undefined ? null : Number(valor);

const CamposComunes = () => (
  <>
    <TextInput
      source="nombre"
      label="Nombre de la cuenta"
      validate={required()}
    />
    {/* TextInput y no NumberInput: este último convierte el vacío en 0 y acá vacío es «sin límite» */}
    <TextInput
      source="max_usuarios"
      label="Máximo de usuarios activos"
      type="number"
      min={1}
      step={1}
      parse={aMaximo}
      helperText="Vacío = sin límite. El titular no puede crear más usuarios activos que este número."
    />
    <ModulosInput plan />
  </>
);

/** Lo que el alta necesita recordar después de guardar (para la entrega y el cierre de la solicitud). */
interface AltaEnCurso {
  solicitud: Solicitud | null;
  etiquetas: Parameters<typeof marcarAltaHecha>[1] | null;
  credenciales: Omit<CredencialesCuenta, "cuenta"> | null;
}

const nombreSolicitud = (solicitud: Solicitud) =>
  `${solicitud.empresa || `${solicitud.nombre} ${solicitud.apellido}`.trim()} · ${formatFecha(solicitud.creadoEn)}`;

/** Atajos del alta: partir de una solicitud de la landing y aplicar un plan de la propuesta. */
const SolicitudYPlan = ({ alta }: { alta: MutableRefObject<AltaEnCurso> }) => {
  const { setValue } = useFormContext();
  const { solicitudes, etiquetas, cargando } = useSolicitudes();
  const [elegida, setElegida] = useState("");
  const marcar = { shouldDirty: true, shouldValidate: true };

  const aplicarPlan = (plan: PlanComercial) => {
    setValue("modulos", plan.modulos, marcar);
    setValue("max_usuarios", plan.maxUsuarios, marcar);
  };

  const [params] = useSearchParams();
  const pedida = params.get("solicitud");
  const aplicada = useRef(false);

  const elegir = (valor: string) => {
    const solicitud = solicitudes.find((s) => String(s.clienteId) === valor);
    if (!solicitud) return;
    setElegida(valor);
    alta.current.solicitud = solicitud;
    alta.current.etiquetas = etiquetas;
    setValue(
      "nombre",
      solicitud.empresa || `${solicitud.nombre} ${solicitud.apellido}`.trim(),
      marcar,
    );
    setValue("titular.nombre", solicitud.nombre, marcar);
    setValue("titular.apellido", solicitud.apellido, marcar);
    setValue("titular.email", solicitud.email.trim().toLowerCase(), marcar);
    setValue("whatsapp_titular", solicitud.telefono, marcar);
    aplicarPlan(PLANES[0]);
  };

  // Llegó desde «Dar de alta»: la solicitud ya viene elegida y el alta, cargada
  useEffect(() => {
    if (aplicada.current || !pedida || solicitudes.length === 0) return;
    if (!solicitudes.some((s) => String(s.clienteId) === pedida)) return;
    aplicada.current = true;
    elegir(pedida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, solicitudes]);

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Desde una solicitud</p>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Buscando solicitudes…</p>
        ) : solicitudes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay solicitudes pendientes. Llegan desde la landing con la
            etiqueta «Solicitó prueba».
          </p>
        ) : (
          <Select value={elegida} onValueChange={elegir}>
            <SelectTrigger aria-label="Solicitud de prueba" className="w-full">
              <SelectValue placeholder="Elegí una solicitud para completar el alta" />
            </SelectTrigger>
            <SelectContent>
              {solicitudes.map((solicitud) => (
                <SelectItem
                  key={solicitud.clienteId}
                  value={String(solicitud.clienteId)}
                >
                  {nombreSolicitud(solicitud)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Aplicar un plan</p>
        <div className="flex flex-wrap gap-2">
          {PLANES.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => aplicarPlan(plan)}
            >
              {plan.nombre}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Marca los módulos y el máximo de usuarios del plan; después los podés
          ajustar.
        </p>
      </div>
    </div>
  );
};

/** Renueva la contraseña inicial y la copia; ya viene una generada. */
const ClaveInicial = () => {
  const { setValue } = useFormContext();
  const clave = useWatch({ name: "titular.password" }) as string | undefined;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setValue("titular.password", generarClave(), {
            shouldDirty: true,
            shouldValidate: true,
          })
        }
      >
        <RefreshCw />
        Renovar
      </Button>
      <CopiarBoton texto={clave ?? ""} />
    </div>
  );
};

/** Datos del administrador titular: la persona a la que se le habilita el acceso. */
const CamposTitular = () => (
  <div className="space-y-4 rounded-md border p-4">
    <p className="text-sm font-medium">Administrador titular</p>
    <p className="text-sm text-muted-foreground">
      Entra con su email y esta contraseña inicial. Desde «Usuarios» crea a sus
      trabajadores, con los módulos de esta cuenta.
    </p>
    <div className="grid gap-4 sm:grid-cols-2">
      <TextInput source="titular.nombre" label="Nombre" validate={required()} />
      <TextInput
        source="titular.apellido"
        label="Apellido"
        validate={required()}
      />
    </div>
    <TextInput
      source="titular.email"
      label="Email"
      type="email"
      parse={(valor: string) => valor.trim().toLowerCase()}
      validate={validarEmailObligatorio}
    />
    <div className="space-y-2">
      {/* Visible a propósito: la plataforma se la comunica al titular */}
      <TextInput
        source="titular.password"
        label="Contraseña inicial"
        autoComplete="new-password"
        validate={validarClave}
        helperText="Generada al azar: copiala o renovala. Al crear la cuenta podés mandársela por WhatsApp."
      />
      <ClaveInicial />
    </div>
    <TextInput
      source="whatsapp_titular"
      label="WhatsApp del titular (opcional)"
      type="tel"
      helperText="Con código de país, por ejemplo +54 9 11 5555 1234. Sirve para enviarle el acceso al terminar."
    />
  </div>
);

/** Cambia la contraseña del administrador titular (si la perdió). */
const RestablecerClaveTitular = () => {
  const cuenta = useRecordContext<Cuenta>();
  const dataProvider = useCrmDataProvider();
  const notify = useNotify();
  const [clave, setClave] = useState("");
  const [enCurso, setEnCurso] = useState(false);
  if (!cuenta?.titular) return null;
  const titular = cuenta.titular;
  const valida = validarClave(clave) === undefined;

  const cambiar = async () => {
    setEnCurso(true);
    try {
      await dataProvider.restablecerClaveTitular(cuenta.id, titular.id, clave);
      notify("Contraseña del titular actualizada", { type: "success" });
      setClave("");
    } catch (error) {
      notify(mensajeDe(error), { type: "error" });
    } finally {
      setEnCurso(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-4">
      <p className="text-sm font-medium">Contraseña del titular</p>
      <p className="text-sm text-muted-foreground">
        {titular.nombre} {titular.apellido} · {titular.email}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Input
          type="text"
          value={clave}
          onChange={(evento) => setClave(evento.target.value)}
          autoComplete="new-password"
          aria-label="Nueva contraseña del titular"
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setClave(generarClave())}
        >
          <RefreshCw />
          Generar
        </Button>
        <CopiarBoton texto={clave} />
        <Button
          type="button"
          disabled={!valida || enCurso}
          onClick={() => void cambiar()}
        >
          Cambiar contraseña
        </Button>
      </div>
    </div>
  );
};

/** Alta y edición de una cuenta (solo la plataforma): pasa por la Edge Function `cuentas`. */
export const CuentaFormDialog = ({
  id,
  onClose,
  onCreada,
  onSolicitudCerrada,
}: {
  id?: string;
  onClose: () => void;
  /** Al crear una cuenta: la contraseña inicial y el teléfono, para entregárselos. */
  onCreada?: (credenciales: CredencialesCuenta) => void;
  /** Cuando la solicitud de origen quedó marcada como dada de alta. */
  onSolicitudCerrada?: () => void;
}) => {
  const notify = useNotify();
  const navigate = useNavigate();
  // La contraseña inicial nace generada (estable mientras el diálogo está abierto)
  const [claveInicial] = useState(() => generarClave());
  const alta = useRef<AltaEnCurso>({
    solicitud: null,
    etiquetas: null,
    credenciales: null,
  });

  const alCrear = (cuenta: Cuenta) => {
    const { solicitud, etiquetas, credenciales } = alta.current;
    // Siempre al listado de cuentas (no «atrás»): se pudo llegar desde la ficha
    // de un cliente y acá es donde se muestran las credenciales
    navigate("/cuentas", { replace: true });
    if (credenciales) {
      onCreada?.({
        ...credenciales,
        cuenta: cuenta.nombre,
        email: cuenta.titular?.email ?? credenciales.email,
      });
    }
    if (solicitud && etiquetas) {
      marcarAltaHecha(solicitud, etiquetas)
        .then(() => onSolicitudCerrada?.())
        .catch((error: unknown) =>
          notify(
            `La cuenta se creó, pero no se pudo actualizar la solicitud: ${mensajeDe(error)}`,
            { type: "warning" },
          ),
        );
    }
  };

  return (
    <RecordFormDialog<Cuenta>
      resource="cuentas"
      id={id}
      tituloCrear="Nueva cuenta"
      tituloEditar={(cuenta) => cuenta.nombre}
      descripcion="Un cliente que contrata el sistema: su plan y el administrador que lo gestiona."
      descripcionEditar={(cuenta) =>
        cuenta.activa
          ? "Plan, cupo de usuarios y estado de la cuenta."
          : "Cuenta suspendida: sus usuarios no ven ni cambian datos hasta que la reactives."
      }
      mensajeGuardado="Cuenta guardada"
      defaultValues={{
        modulos: MODULOS_INICIALES,
        max_usuarios: null,
        titular: { password: claveInicial },
      }}
      // Solo lo que se puede cambiar: el resto del registro es de lectura
      transform={(datos) => {
        const titular = datos.titular as
          | {
              nombre?: string;
              apellido?: string;
              email?: string;
              password?: string;
            }
          | undefined;
        if (id === undefined && titular) {
          alta.current.credenciales = {
            titular: titular.nombre ?? "",
            email: titular.email ?? "",
            password: titular.password ?? "",
            telefono: String(datos.whatsapp_titular ?? ""),
          };
        }
        return {
          nombre: datos.nombre,
          modulos: datos.modulos,
          max_usuarios: aMaximo(datos.max_usuarios),
          ...(datos.activa === undefined ? {} : { activa: datos.activa }),
          ...(datos.titular && !("id" in (datos.titular as object))
            ? { titular: datos.titular }
            : {}),
        };
      }}
      onSaved={id === undefined ? alCrear : undefined}
      size="lg"
      onClose={onClose}
      guardadosExtra={(cuenta) =>
        cuenta &&
        (cuenta.activa ? (
          <GuardarCon
            etiqueta="Suspender"
            icono={<Ban />}
            variante="destructive"
            valores={{ activa: false }}
          />
        ) : (
          <GuardarCon
            etiqueta="Reactivar"
            icono={<RotateCcw />}
            valores={{ activa: true }}
          />
        ))
      }
    >
      {id === undefined && <SolicitudYPlan alta={alta} />}
      <CamposComunes />
      {id === undefined ? <CamposTitular /> : <RestablecerClaveTitular />}
    </RecordFormDialog>
  );
};
