import { QueryClient } from "@tanstack/react-query";
import { CanAccess, localStorageStore, Navigate, Resource } from "ra-core";
import { lazy, type ComponentType } from "react";

import { Admin } from "@/components/admin/admin";

import { ActividadesPage } from "../actividades/ActividadesPage";
import { ClientesPage } from "../clientes/ClientesPage";
import { Layout } from "../layout/Layout";
import { LoginPage } from "../login/LoginPage";
import { OportunidadesPage } from "../oportunidades/OportunidadesPage";
import { getAuthProvider } from "../providers/authProvider";
import { getDataProvider } from "../providers/dataProvider";
import { i18nProvider } from "../providers/i18nProvider";
import { APP_TITLE } from "./config";

// Pantallas que no se visitan todo el tiempo: fuera del paquete principal
const Dashboard = lazy(() => import("../dashboard/Dashboard"));
const AuditoriaPage = lazy(() => import("../auditoria/AuditoriaPage"));
const LandingList = lazy(() =>
  import("../landings/LandingList").then((modulo) => ({
    default: modulo.LandingList,
  })),
);
const LandingCreate = lazy(() =>
  import("../landings/LandingCreate").then((modulo) => ({
    default: modulo.LandingCreate,
  })),
);
const LandingEditPage = lazy(() => import("../landings/LandingEditPage"));
const EtiquetasPage = lazy(() =>
  import("../etiquetas/EtiquetasPage").then((modulo) => ({
    default: modulo.EtiquetasPage,
  })),
);
const ProductosPage = lazy(() =>
  import("../productos/ProductosPage").then((modulo) => ({
    default: modulo.ProductosPage,
  })),
);
const VentasPage = lazy(() =>
  import("../ventas/VentasPage").then((modulo) => ({
    default: modulo.VentasPage,
  })),
);
const CanalesPage = lazy(() =>
  import("../canales/CanalesPage").then((modulo) => ({
    default: modulo.CanalesPage,
  })),
);
const UsuariosPage = lazy(() =>
  import("../usuarios/UsuariosPage").then((modulo) => ({
    default: modulo.UsuariosPage,
  })),
);

/**
 * La página solo se monta si el usuario puede listar el recurso (tiene su
 * módulo): escribir la ruta a mano lleva a "Acceso denegado". La base igual
 * rechaza los datos; esto evita una pantalla rota. Un mismo componente por
 * recurso: listado, alta y detalle no se vuelven a montar al pasar entre ellos.
 */
const conAcceso = (resource: string, Pagina: ComponentType) => {
  const PaginaConAcceso = () => (
    <CanAccess
      resource={resource}
      action="list"
      accessDenied={<Navigate to="/access-denied" replace />}
    >
      <Pagina />
    </CanAccess>
  );
  PaginaConAcceso.displayName = `ConAcceso(${resource})`;
  return PaginaConAcceso;
};

const Clientes = conAcceso("clientes", ClientesPage);
const Oportunidades = conAcceso("oportunidades", OportunidadesPage);
const Actividades = conAcceso("actividades", ActividadesPage);
const Usuarios = conAcceso("usuarios", UsuariosPage);
const Landings = conAcceso("landings", LandingList);
const NuevaLanding = conAcceso("landings", LandingCreate);
const EditarLanding = conAcceso("landings", LandingEditPage);
const Etiquetas = conAcceso("etiquetas", EtiquetasPage);
const Productos = conAcceso("productos", ProductosPage);
const Canales = conAcceso("canales", CanalesPage);
const Ventas = conAcceso("ventas", VentasPage);
const Auditoria = conAcceso("auditoria", AuditoriaPage);

const dataProvider = getDataProvider();
const authProvider = getAuthProvider();
const store = localStorageStore(undefined, "MiniCRM");
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1 } },
});

/**
 * Cada recurso usa la misma página para listado, alta y detalle: el alta
 * (`/recurso/create`) y el detalle (`/recurso/:id`) se abren como modal sobre
 * el listado, que no se vuelve a montar. Las landings son la excepción: su
 * editor es una página entera.
 */
export const CRM = () => (
  <Admin
    dataProvider={dataProvider}
    authProvider={authProvider}
    i18nProvider={i18nProvider}
    queryClient={queryClient}
    store={store}
    title={APP_TITLE}
    layout={Layout}
    loginPage={LoginPage}
    dashboard={Dashboard}
    requireAuth
    disableTelemetry
  >
    <Resource
      name="clientes"
      list={Clientes}
      create={Clientes}
      edit={Clientes}
    />
    <Resource
      name="oportunidades"
      list={Oportunidades}
      create={Oportunidades}
      edit={Oportunidades}
    />
    <Resource
      name="actividades"
      list={Actividades}
      create={Actividades}
      edit={Actividades}
    />
    <Resource
      name="usuarios"
      list={Usuarios}
      create={Usuarios}
      edit={Usuarios}
    />
    <Resource
      name="landings"
      list={Landings}
      create={NuevaLanding}
      edit={EditarLanding}
    />
    <Resource
      name="etiquetas"
      list={Etiquetas}
      create={Etiquetas}
      edit={Etiquetas}
    />
    <Resource
      name="productos"
      list={Productos}
      create={Productos}
      edit={Productos}
    />
    <Resource name="canales" list={Canales} create={Canales} edit={Canales} />
    <Resource name="ventas" list={Ventas} />
    <Resource name="auditoria" list={Auditoria} show={Auditoria} />
  </Admin>
);
