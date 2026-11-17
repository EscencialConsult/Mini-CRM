import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useNotify } from "ra-core";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useCanales } from "../../canales/useCanales";
import { formatNumero, plural } from "../../domain/format";
import { useEtiquetas } from "../../etiquetas/useEtiquetas";
import { useEsAdministrador } from "../../providers/authProvider";
import { useRefrescarDatos } from "../../shared/useRefrescarDatos";
import { useUsuarios } from "../../shared/useUsuarios";
import {
  cargarClientes,
  cargarExistentes,
  type ResultadoCarga,
} from "./cargarClientes";
import { aCsv, descargarArchivo, leerCsv, leerTexto } from "./csv";
import {
  interpretarArchivo,
  MAXIMO_FILAS,
  normalizarTexto,
  revisarFilas,
  type FilaRevisada,
  type Interpretacion,
} from "./interpretar";

const SIN_ELEGIR = "ninguno";
const TAMANO_MAXIMO = 2 * 1024 * 1024;

const PLANTILLA = aCsv([
  [
    "Nombre",
    "Apellido",
    "Razón social",
    "CUIT/DNI",
    "Teléfono",
    "Email",
    "Dirección",
    "Canal",
  ],
  [
    "Ana",
    "Gómez",
    "",
    "",
    "11 5555-0101",
    "ana@ejemplo.com",
    "Av. Corrientes 1234, CABA",
    "WhatsApp",
  ],
  [
    "",
    "",
    "Panadería El Sol SRL",
    "30712345671",
    "11 5555-0102",
    "contacto@elsol.com",
    "",
    "",
  ],
]);

type Paso = "inicio" | "revision" | "cargando" | "listo";

const Cifra = ({
  valor,
  etiqueta,
  destacado,
}: {
  valor: number;
  etiqueta: string;
  destacado?: boolean;
}) => (
  <div className="rounded-lg border p-3">
    <p
      className={`font-titulo text-2xl font-semibold tabular-nums ${destacado ? "" : "text-muted-foreground"}`}
    >
      {formatNumero(valor)}
    </p>
    <p className="text-xs text-muted-foreground">{etiqueta}</p>
  </div>
);

/**
 * Carga masiva de clientes/prospectos desde un CSV (el «Guardar como → CSV» de
 * Excel). Lee y revisa todo en el navegador antes de guardar nada: muestra
 * cuántos se cargan, cuántos ya existían y cuáles tienen errores, y permite
 * bajar un archivo con lo rechazado para corregirlo y volver a subirlo.
 */
export const ImportarClientesDialog = ({
  onClose,
}: {
  onClose: () => void;
}) => {
  const notify = useNotify();
  const refrescar = useRefrescarDatos();
  const esAdministrador = useEsAdministrador();
  const { opcionesActivas: vendedores } = useUsuarios();
  const { canales, opcionesPara } = useCanales();
  const { etiquetas } = useEtiquetas();
  const entrada = useRef<HTMLInputElement>(null);

  const [paso, setPaso] = useState<Paso>("inicio");
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archivo, setArchivo] = useState("");
  const [interpretacion, setInterpretacion] = useState<Interpretacion | null>(
    null,
  );
  const [filas, setFilas] = useState<FilaRevisada[]>([]);
  const [canal, setCanal] = useState(SIN_ELEGIR);
  const [etiqueta, setEtiqueta] = useState(SIN_ELEGIR);
  const [vendedor, setVendedor] = useState(SIN_ELEGIR);
  const [avance, setAvance] = useState(0);
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null);

  const nuevas = useMemo(
    () => filas.filter((fila) => fila.veredicto === "nueva"),
    [filas],
  );
  const rechazadas = useMemo(
    () => filas.filter((fila) => fila.veredicto !== "nueva"),
    [filas],
  );
  const duplicadas = rechazadas.filter((f) => f.veredicto === "duplicada");
  const invalidas = rechazadas.filter((f) => f.veredicto === "invalida");

  const elegirArchivo = async (seleccion: File | undefined) => {
    if (!seleccion) return;
    setError(null);
    if (seleccion.size > TAMANO_MAXIMO) {
      setError("El archivo pesa demasiado (máximo 2 MB). Partilo en varios.");
      return;
    }
    setLeyendo(true);
    try {
      const contenido = leerCsv(await leerTexto(seleccion));
      const lectura = interpretarArchivo(contenido);
      if (lectura.problema) {
        setError(lectura.problema);
        return;
      }
      const revisadas = revisarFilas(lectura.filas, await cargarExistentes());
      setArchivo(seleccion.name);
      setInterpretacion(lectura);
      setFilas(revisadas);
      setPaso("revision");
    } catch (causa) {
      setError(
        causa instanceof Error
          ? `No se pudo leer el archivo: ${causa.message}`
          : "No se pudo leer el archivo",
      );
    } finally {
      setLeyendo(false);
    }
  };

  const cargar = async () => {
    setPaso("cargando");
    setAvance(0);
    try {
      const canalesPorNombre = new Map(
        canales.map((c) => [normalizarTexto(c.nombre), c.id] as const),
      );
      const hecho = await cargarClientes(
        nuevas,
        {
          canalPorDefecto: canal === SIN_ELEGIR ? null : Number(canal),
          canalesPorNombre,
          etiqueta: etiqueta === SIN_ELEGIR ? null : Number(etiqueta),
          asignadoA:
            esAdministrador && vendedor !== SIN_ELEGIR ? vendedor : null,
        },
        setAvance,
      );
      setResultado(hecho);
      setPaso("listo");
      void refrescar();
      if (hecho.creados > 0) {
        notify(
          `${plural(hecho.creados, "cliente cargado", "clientes cargados")}`,
          { type: "success" },
        );
      }
    } catch (causa) {
      notify(
        causa instanceof Error ? causa.message : "No se pudo cargar el archivo",
        { type: "error" },
      );
      setPaso("revision");
    }
  };

  const bajarRechazadas = (lista: { fila: FilaRevisada; motivo: string }[]) =>
    descargarArchivo(
      "clientes-no-cargados.csv",
      aCsv([
        [...(interpretacion?.encabezado ?? []), "Motivo"],
        ...lista.map(({ fila, motivo }) => [...fila.original, motivo]),
      ]),
    );

  const todasRechazadas = [
    ...rechazadas.map((fila) => ({ fila, motivo: fila.motivo ?? "" })),
    ...(resultado?.fallidas ?? []),
  ];

  return (
    <Dialog
      open
      onOpenChange={(abierto) => !abierto && paso !== "cargando" && onClose()}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar clientes desde un archivo</DialogTitle>
          <DialogDescription>
            Subí un archivo CSV (en Excel: Guardar como → CSV) con tus
            prospectos. Antes de guardar nada te muestro qué se carga y qué no.
          </DialogDescription>
        </DialogHeader>

        {paso === "inicio" && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Cómo armar el archivo</p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  Una fila por cliente. Columnas: Nombre, Apellido (o Razón
                  social para empresas), CUIT/DNI, Teléfono, Email, Dirección y
                  Canal. Solo hacen falta el nombre y un teléfono o email.
                </li>
                <li>
                  Los repetidos (mismo email, teléfono o CUIT/DNI, dentro del
                  archivo o ya cargados) se saltean.
                </li>
                <li>
                  Si una fila trae Nombre y también Razón social, se carga como
                  persona; para una empresa dejá el Nombre vacío.
                </li>
                <li>Hasta {formatNumero(MAXIMO_FILAS)} filas por archivo.</li>
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  descargarArchivo("plantilla-clientes.csv", PLANTILLA)
                }
              >
                <Download />
                Descargar plantilla
              </Button>
            </div>

            <input
              ref={entrada}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              aria-label="Archivo CSV"
              onChange={(evento) => {
                void elegirArchivo(evento.target.files?.[0]);
                evento.target.value = "";
              }}
            />
            <Button
              type="button"
              className="w-full"
              loading={leyendo}
              onClick={() => entrada.current?.click()}
            >
              <Upload />
              Elegir archivo CSV
            </Button>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        {paso === "revision" && interpretacion && (
          <div className="space-y-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="size-4 shrink-0" />
              <span className="truncate">{archivo}</span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="ml-auto h-auto p-0"
                onClick={() => setPaso("inicio")}
              >
                Cambiar archivo
              </Button>
            </p>

            <div className="grid grid-cols-3 gap-3">
              <Cifra valor={nuevas.length} etiqueta="Se cargan" destacado />
              <Cifra valor={duplicadas.length} etiqueta="Ya existen" />
              <Cifra valor={invalidas.length} etiqueta="Con errores" />
            </div>

            {interpretacion.ignoradas.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Columnas que no reconocí y no se cargan:{" "}
                {interpretacion.ignoradas.join(", ")}.
              </p>
            )}

            {nuevas.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Canal de origen</Label>
                  <Select value={canal} onValueChange={setCanal}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ELEGIR}>
                        Sin canal / el del archivo
                      </SelectItem>
                      {opcionesPara(null).map((opcion) => (
                        <SelectItem key={opcion.id} value={String(opcion.id)}>
                          {opcion.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Etiqueta para todos</Label>
                  <Select value={etiqueta} onValueChange={setEtiqueta}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ELEGIR}>Ninguna</SelectItem>
                      {etiquetas.map((opcion) => (
                        <SelectItem key={opcion.id} value={String(opcion.id)}>
                          {opcion.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {esAdministrador && (
                  <div className="space-y-1.5">
                    <Label>Vendedor asignado</Label>
                    <Select value={vendedor} onValueChange={setVendedor}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SIN_ELEGIR}>Yo</SelectItem>
                        {vendedores.map((opcion) => (
                          <SelectItem key={opcion.id} value={opcion.id}>
                            {opcion.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {rechazadas.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">No se cargan</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      bajarRechazadas(
                        rechazadas.map((fila) => ({
                          fila,
                          motivo: fila.motivo ?? "",
                        })),
                      )
                    }
                  >
                    <Download />
                    Descargar para corregir
                  </Button>
                </div>
                <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border text-sm">
                  {rechazadas.slice(0, 50).map((fila) => (
                    <li
                      key={fila.numero}
                      className="flex items-baseline gap-2 px-3 py-1.5"
                    >
                      <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                        Fila {fila.numero}
                      </span>
                      <span className="truncate">{fila.etiqueta}</span>
                      <span className="ml-auto shrink-0 text-xs text-destructive">
                        {fila.motivo}
                      </span>
                    </li>
                  ))}
                </ul>
                {rechazadas.length > 50 && (
                  <p className="text-xs text-muted-foreground">
                    Y {rechazadas.length - 50} más en el archivo descargable.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {paso === "cargando" && (
          <div className="space-y-3 py-4" role="status" aria-live="polite">
            <Progress value={(avance / Math.max(nuevas.length, 1)) * 100} />
            <p className="text-center text-sm text-muted-foreground">
              Cargando {formatNumero(avance)} de {formatNumero(nuevas.length)}…
              No cierres esta ventana.
            </p>
          </div>
        )}

        {paso === "listo" && resultado && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Cifra valor={resultado.creados} etiqueta="Cargados" destacado />
              <Cifra valor={duplicadas.length} etiqueta="Ya existían" />
              <Cifra
                valor={invalidas.length + resultado.fallidas.length}
                etiqueta="No cargados"
              />
            </div>
            {resultado.fallidas.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {plural(
                  resultado.fallidas.length,
                  "fila la rechazó la base",
                  "filas las rechazó la base",
                )}
                : {resultado.fallidas[0].motivo}
              </p>
            )}
            {todasRechazadas.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => bajarRechazadas(todasRechazadas)}
              >
                <Download />
                Descargar los no cargados
              </Button>
            )}
          </div>
        )}

        <DialogFooter>
          {paso === "revision" && (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={nuevas.length === 0}
                onClick={() => void cargar()}
              >
                {nuevas.length === 0
                  ? "No hay nada para cargar"
                  : `Cargar ${plural(nuevas.length, "cliente", "clientes")}`}
              </Button>
            </>
          )}
          {paso === "listo" && (
            <Button type="button" onClick={onClose}>
              Listo
            </Button>
          )}
          {paso === "inicio" && (
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
