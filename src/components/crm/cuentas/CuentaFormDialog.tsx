import { Ban, RefreshCw, RotateCcw } from "lucide-react";
import { required, useNotify, useRecordContext } from "ra-core";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";

import { BooleanInput } from "@/components/admin/boolean-input";
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
import { DIAS_DE_PRUEBA, estadoPrueba } from "../domain/prueba";
import type { Cuenta } from "../domain/types";
import { validarClave, validarEmailObligatorio } from "../domain/validators";
import { useCrmDataProvider } from "../providers/dataProvider";
import { GuardarCon } from "../shared/RecordForm";
import { SeccionFormulario } from "../shared/SeccionFormulario";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { ModulosInput } from "../usuarios/ModulosInput";
import { CopiarBoton } from "./CopiarBoton";
import { AccesoTitular } from "./AccesoTitular";
import { publicarAcceso, type CredencialesCuenta } from "./acceso";
import { PlanesInput } from "./PlanesInput";
import { PLANES } from "./planes";
import { SeccionPrueba } from "./SeccionPrueba";
import { buscarTelefono } from "./telefonos";
import {
  marcarAltaHecha,
  useSolicitudes,
  type Solicitud,
} from "./useSolicitudes";

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : "No se pudo completar la operación";

/** Cupo vacío = sin límite. */
const aMaximo = (valor: unknown): number | null =>
  valor === "" || valor === null || valor === undefined ? null : Number(valor);

const CampoNombre = () => (
  <TextInput
    source="nombre"
    label="Nombre de la cuenta"
    validate={required()}
    helperText="La empresa que contrata el sistema."
  />
);

/** Plan elegido con un toque y, debajo, el ajuste fino: máximo de usuarios y módulos. */
const CamposPlan = () => (
  <>
    <PlanesInput />
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

/** Prueba gratis: solo en el alta; en la ficha se maneja desde «Prueba gratis». */
const CampoPrueba = () => {
  const activa = useWatch({ name: "prueba" }) === true;
  return (
    <BooleanInput
      source="prueba"
      label={`Prueba gratis de ${DIAS_DE_PRUEBA} días`}
      helperText={
        activa
          ? `Se bloquea sola a los ${DIAS_DE_PRUEBA} días. Podés cortarla antes desde su ficha.`
          : "Sin prueba: la cuenta no se corta sola."
      }
    />
  );
};

/** Lo que el alta necesita recordar después de guardar (para la entrega y el cierre de la solicitud). */
interface AltaEnCurso {
  prueba: boolean;
  solicitud: Solicitud | null;
  etiquetas: Parameters<typeof marcarAltaHecha>[1] | null;
  credenciales: CredencialesCuenta | null;
}

const nombreSolicitud = (solicitud: Solicitud) =>
  `${solicitud.empresa || `${solicitud.nombre} ${solicitud.apellido}`.trim()} · ${formatFecha(solicitud.creadoEn)}`;

const ALTA_MANUAL = "__manual";

/**
 * Primer paso del alta: de qué solicitud viene (o «alta manual»). Al elegir una
 * se cargan la empresa, el titular, su WhatsApp y el plan de prueba; todo se
 * puede corregir después.
 */
const OrigenSolicitud = ({ alta }: { alta: MutableRefObject<AltaEnCurso> }) => {
  const { setValue } = useFormContext();
  const { solicitudes, etiquetas, cargando, error, faltaEtiqueta } =
    useSolicitudes();
  const [elegida, setElegida] = useState("");
  const marcar = { shouldDirty: true, shouldValidate: true };

  const [params] = useSearchParams();
  const pedida = params.get("solicitud");
  const aplicada = useRef(false);

  const elegir = (valor: string) => {
    if (valor === ALTA_MANUAL) {
      setElegida("");
      alta.current.solicitud = null;
      alta.current.etiquetas = null;
      return;
    }
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
    setValue("modulos", PLANES[0].modulos, marcar);
    setValue("max_usuarios", PLANES[0].maxUsuarios, marcar);
    setValue("prueba", true, marcar);
  };

  // Llegó desde «Dar de alta»: la solicitud ya viene elegida y el alta, cargada
  useEffect(() => {
    if (aplicada.current || !pedida || solicitudes.length === 0) return;
    if (!solicitudes.some((s) => String(s.clienteId) === pedida)) return;
    aplicada.current = true;
    elegir(pedida);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedida, solicitudes]);

  const solicitud = solicitudes.find((s) => String(s.clienteId) === elegida);
  const persona = solicitud
    ? `${solicitud.nombre} ${solicitud.apellido}`.trim()
    : "";

  return (
    <div className="space-y-3">
      {cargando ? (
        <p className="text-sm text-muted-foreground">Buscando solicitudes…</p>
      ) : solicitudes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {error
            ? "No se pudieron leer las solicitudes de prueba. Podés seguir con un alta manual y reintentar después."
            : faltaEtiqueta
              ? "Falta la etiqueta «Solicitó prueba» en esta cuenta, por eso no se ven las solicitudes. Podés seguir con un alta manual."
              : "No hay solicitudes pendientes: esta es un alta manual. Las solicitudes llegan desde la landing con la etiqueta «Solicitó prueba»."}
          {pedida &&
            " La solicitud que abriste ya no está pendiente o no se pudo cargar: completá el alta a mano."}
        </p>
      ) : (
        <>
          <Select value={elegida || ALTA_MANUAL} onValueChange={elegir}>
            <SelectTrigger aria-label="Solicitud de prueba" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALTA_MANUAL}>
                Alta manual (sin solicitud)
              </SelectItem>
              {solicitudes.map((item) => (
                <SelectItem key={item.clienteId} value={String(item.clienteId)}>
                  {nombreSolicitud(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!solicitud && (
            <p className="text-sm text-muted-foreground">
              Elegí una solicitud y se completa el alta con sus datos.
            </p>
          )}
          {pedida &&
            !solicitudes.some((s) => String(s.clienteId) === pedida) && (
              <p role="note" className="text-sm text-muted-foreground">
                La solicitud que abriste ya no está pendiente o no está entre
                las más recientes: elegila de la lista o completá el alta a
                mano.
              </p>
            )}
        </>
      )}
      {solicitud && (
        <p className="rounded-md bg-muted/60 p-3 text-sm">
          Datos cargados de la solicitud de <strong>{persona}</strong>
          {solicitud.empresa && ` (${solicitud.empresa})`}
          {solicitud.telefono && ` · ${solicitud.telefono}`}. Revisalos y ajustá
          lo que haga falta. Al crear la cuenta, la solicitud se da por
          resuelta.
        </p>
      )}
      {solicitud?.envioFusionado && (
        <p
          role="note"
          className="rounded-md border border-warning/40 bg-warning/15 p-3 text-sm text-warning-foreground"
        >
          Ojo: esta solicitud se sumó a una ficha que ya existía, así que el
          email y el teléfono cargados son los de esa ficha.
          {solicitud.envioFusionado.datos
            ? ` Los datos del último envío son: ${solicitud.envioFusionado.datos}.`
            : ""}{" "}
          Confirmá con quién corresponde el acceso antes de crear la cuenta.
        </p>
      )}
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
  <>
    <p className="text-sm text-muted-foreground">
      Entra con su email y esta contraseña inicial; al ingresar por primera vez
      tendrá que elegir una contraseña propia. Desde «Usuarios» crea a sus
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
  </>
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
      publicarAcceso(cuenta.id, {
        titular: titular.nombre,
        email: titular.email,
        password: clave,
        telefono: await buscarTelefono(titular.email),
        origen: "cambio",
      });
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
  onSolicitudCerrada,
}: {
  id?: string;
  onClose: () => void;
  /** Cuando la solicitud de origen quedó marcada como dada de alta. */
  onSolicitudCerrada?: () => void;
}) => {
  const notify = useNotify();
  const navigate = useNavigate();
  // La contraseña inicial nace generada (estable mientras el diálogo está abierto)
  const [claveInicial] = useState(() => generarClave());
  const alta = useRef<AltaEnCurso>({
    prueba: true,
    solicitud: null,
    etiquetas: null,
    credenciales: null,
  });

  const alCrear = (cuenta: Cuenta) => {
    const { solicitud, etiquetas, credenciales, prueba } = alta.current;
    if (prueba && !cuenta.prueba_hasta) {
      notify(
        "La cuenta se creó, pero el servidor todavía no aplicó el límite de 3 días: falta aplicar la migración y desplegar la función «cuentas». Cuando esté listo, ponela en prueba desde su ficha.",
        { type: "warning" },
      );
    }
    // La ficha de la cuenta recién creada se abre sola y muestra el acceso
    // listo para mandar por WhatsApp (ahí también se puede volver a generar)
    if (credenciales) {
      publicarAcceso(cuenta.id, {
        ...credenciales,
        email: cuenta.titular?.email ?? credenciales.email,
        origen: "alta",
      });
    }
    navigate(`/cuentas/${cuenta.id}`, { replace: true });
    if (solicitud && etiquetas) {
      marcarAltaHecha(solicitud, etiquetas, cuenta.nombre)
        .catch((error: unknown) =>
          notify(
            `La cuenta se creó, pero no se pudo actualizar la solicitud: ${mensajeDe(error)}`,
            { type: "warning" },
          ),
        )
        .finally(() => onSolicitudCerrada?.());
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
        !cuenta.activa
          ? "Cuenta suspendida: sus usuarios no ven ni cambian datos hasta que la reactives."
          : estadoPrueba(cuenta) === "terminada"
            ? "Prueba gratis terminada: sus usuarios no ven ni cambian datos hasta que la pases a cuenta paga o le des más días."
            : "Plan, cupo de usuarios y estado de la cuenta."
      }
      mensajeGuardado="Cuenta guardada"
      defaultValues={{
        modulos: PLANES[0].modulos,
        max_usuarios: PLANES[0].maxUsuarios,
        prueba: true,
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
        if (id === undefined) alta.current.prueba = datos.prueba === true;
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
          ...(id === undefined ? { prueba: datos.prueba === true } : {}),
          ...(datos.activa === undefined ? {} : { activa: datos.activa }),
          ...(datos.titular && !("id" in (datos.titular as object))
            ? { titular: datos.titular }
            : {}),
        };
      }}
      onSaved={id === undefined ? alCrear : undefined}
      size="lg"
      conservarCambios
      submitLabel={id === undefined ? "Crear cuenta" : undefined}
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
      {id === undefined ? (
        <>
          <SeccionFormulario titulo="1 · ¿De dónde viene?">
            <OrigenSolicitud alta={alta} />
          </SeccionFormulario>
          <SeccionFormulario titulo="2 · La empresa">
            <CampoNombre />
          </SeccionFormulario>
          <SeccionFormulario titulo="3 · El plan">
            <CamposPlan />
            <CampoPrueba />
          </SeccionFormulario>
          <SeccionFormulario titulo="4 · Administrador titular y acceso">
            <CamposTitular />
          </SeccionFormulario>
        </>
      ) : (
        <>
          <SeccionFormulario titulo="Prueba gratis">
            <SeccionPrueba />
          </SeccionFormulario>
          <SeccionFormulario titulo="Acceso del titular">
            <AccesoTitular />
          </SeccionFormulario>
          <SeccionFormulario titulo="La empresa">
            <CampoNombre />
          </SeccionFormulario>
          <SeccionFormulario titulo="El plan">
            <CamposPlan />
          </SeccionFormulario>
          <SeccionFormulario titulo="Administrador titular">
            <RestablecerClaveTitular />
          </SeccionFormulario>
        </>
      )}
    </RecordFormDialog>
  );
};
