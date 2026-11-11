import { QueryClient } from "@tanstack/react-query";
import { localStorageStore, Resource } from "ra-core";
import { lazy } from "react";

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
const UsuariosPage = lazy(() =>
  import("../usuarios/UsuariosPage").then((modulo) => ({
    default: modulo.UsuariosPage,
  })),
);

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
      list={ClientesPage}
      create={ClientesPage}
      edit={ClientesPage}
    />
    <Resource
      name="oportunidades"
      list={OportunidadesPage}
      create={OportunidadesPage}
      edit={OportunidadesPage}
    />
    <Resource
      name="actividades"
      list={ActividadesPage}
      create={ActividadesPage}
      edit={ActividadesPage}
    />
    <Resource
      name="usuarios"
      list={UsuariosPage}
      create={UsuariosPage}
      edit={UsuariosPage}
    />
    <Resource
      name="landings"
      list={LandingList}
      create={LandingCreate}
      edit={LandingEditPage}
    />
    <Resource name="auditoria" list={AuditoriaPage} show={AuditoriaPage} />
  </Admin>
);
