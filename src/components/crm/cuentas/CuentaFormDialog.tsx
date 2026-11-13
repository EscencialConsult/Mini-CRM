import { Ban, RotateCcw } from "lucide-react";
import { required, useNotify, useRecordContext } from "ra-core";
import { useState } from "react";

import { TextInput } from "@/components/admin/text-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { MODULOS } from "../domain/modulos";
import type { Cuenta } from "../domain/types";
import { validarClave, validarEmailObligatorio } from "../domain/validators";
import { useCrmDataProvider } from "../providers/dataProvider";
import { GuardarCon } from "../shared/RecordForm";
import { RecordFormDialog } from "../shared/RecordFormDialog";
import { GeneradorClave } from "../usuarios/UsuarioFormDialog";
import { ModulosInput } from "../usuarios/ModulosInput";

const TODOS_LOS_MODULOS = MODULOS.map((modulo) => modulo.id);

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
        helperText="Mínimo 8 caracteres. Compartísela al titular; puede cambiarla después."
      />
      <GeneradorClave />
    </div>
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
      <div className="flex flex-col gap-2 sm:flex-row">
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
}: {
  id?: string;
  onClose: () => void;
}) => (
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
    defaultValues={{ modulos: TODOS_LOS_MODULOS, max_usuarios: null }}
    // Solo lo que se puede cambiar: el resto del registro es de lectura
    transform={(datos) => ({
      nombre: datos.nombre,
      modulos: datos.modulos,
      max_usuarios: aMaximo(datos.max_usuarios),
      ...(datos.activa === undefined ? {} : { activa: datos.activa }),
      ...(datos.titular && !("id" in (datos.titular as object))
        ? { titular: datos.titular }
        : {}),
    })}
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
    <CamposComunes />
    {id === undefined ? <CamposTitular /> : <RestablecerClaveTitular />}
  </RecordFormDialog>
);
