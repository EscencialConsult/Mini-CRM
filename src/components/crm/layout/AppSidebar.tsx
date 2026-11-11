import {
  Briefcase,
  Globe,
  Home,
  ListChecks,
  ScrollText,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useCanAccess, useUserMenu } from "ra-core";
import { useState } from "react";
import { Link, matchPath, useLocation } from "react-router";

import { ThemeModeToggle } from "@/components/admin/theme-mode-toggle";
import { UserMenu } from "@/components/admin/user-menu";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import logoClaro from "@/assets/logo_atomic_crm_light.svg";
import logoOscuro from "@/assets/logo_atomic_crm_dark.svg";

import { nombreDe, ROLES } from "../domain/options";
import { useCrmIdentity } from "../providers/authProvider";
import { APP_TITLE } from "../root/config";
import { PerfilDialog } from "./PerfilDialog";
import { RemindersBell } from "./RemindersBell";
import { useRecordatorios } from "./useRecordatorios";

interface ItemNavegacion {
  to: string;
  etiqueta: string;
  Icono: LucideIcon;
  activo: boolean;
  /** Cantidad pendiente (punto rojo / globo). */
  aviso?: number;
}

const PerfilMenuItem = ({ onAbrir }: { onAbrir: () => void }) => {
  const menu = useUserMenu();
  return (
    <DropdownMenuItem
      className="cursor-pointer"
      onSelect={() => {
        menu?.onClose();
        onAbrir();
      }}
    >
      <User />
      Mi perfil
    </DropdownMenuItem>
  );
};

export const AppSidebar = () => {
  const { pathname } = useLocation();
  const { identity } = useCrmIdentity();
  const { conteo } = useRecordatorios();
  const { toggleSidebar } = useSidebar();
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const { canAccess: puedeVerUsuarios } = useCanAccess({
    resource: "usuarios",
    action: "list",
  });
  const { canAccess: puedeVerAuditoria } = useCanAccess({
    resource: "auditoria",
    action: "list",
  });

  const estaEn = (ruta: string) => !!matchPath(`${ruta}/*`, pathname);

  const principales: ItemNavegacion[] = [
    { to: "/", etiqueta: "Panel", Icono: Home, activo: pathname === "/" },
    {
      to: "/clientes",
      etiqueta: "Clientes",
      Icono: Users,
      activo: estaEn("/clientes"),
    },
    {
      to: "/oportunidades",
      etiqueta: "Oportunidades",
      Icono: Briefcase,
      activo: estaEn("/oportunidades"),
    },
    {
      to: "/actividades",
      etiqueta: "Actividades",
      Icono: ListChecks,
      activo: estaEn("/actividades"),
      aviso: conteo.actividades_vencidas,
    },
    {
      to: "/landings",
      etiqueta: "Landings",
      Icono: Globe,
      activo: estaEn("/landings"),
    },
  ];
  const administracion: ItemNavegacion[] = [
    ...(puedeVerUsuarios
      ? [
          {
            to: "/usuarios",
            etiqueta: "Usuarios",
            Icono: UserCog,
            activo: estaEn("/usuarios"),
          },
        ]
      : []),
    ...(puedeVerAuditoria
      ? [
          {
            to: "/auditoria",
            etiqueta: "Auditoría",
            Icono: ScrollText,
            activo: estaEn("/auditoria"),
          },
        ]
      : []),
  ];

  const logo = (
    <>
      <img
        className="size-8 shrink-0 [.dark_&]:hidden"
        src={logoClaro}
        alt=""
      />
      <img
        className="hidden size-8 shrink-0 [.dark_&]:block"
        src={logoOscuro}
        alt=""
      />
    </>
  );

  const renderGrupo = (items: ItemNavegacion[], etiquetaGrupo: string) =>
    items.length > 0 && (
      <SidebarGroup className="px-3 py-1.5 group-data-[collapsible=icon]:px-2">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1" aria-label={etiquetaGrupo}>
            {items.map(({ to, etiqueta, Icono, activo, aviso }) => (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton
                  asChild
                  isActive={activo}
                  tooltip={etiqueta}
                  className="relative h-10 gap-3 px-3 text-[15px] font-medium group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-xl group-data-[collapsible=icon]:p-0! [&>svg]:size-5"
                >
                  <Link to={to} aria-current={activo ? "page" : undefined}>
                    <Icono />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {etiqueta}
                    </span>
                    {!!aviso && (
                      <span
                        aria-hidden
                        className="absolute right-2 top-2 hidden size-2.5 rounded-full bg-destructive ring-2 ring-sidebar group-data-[collapsible=icon]:block"
                      />
                    )}
                  </Link>
                </SidebarMenuButton>
                {!!aviso && (
                  <SidebarMenuBadge className="rounded-full bg-destructive text-white">
                    {aviso}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="flex-row items-center justify-between px-4 py-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-3 text-sidebar-foreground no-underline group-data-[collapsible=icon]:hidden"
          >
            {logo}
            <span className="truncate text-xl font-semibold">{APP_TITLE}</span>
          </Link>
          <SidebarTrigger
            className="size-9 shrink-0 text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden"
            aria-label="Plegar o desplegar el menú"
          />
          {/* Plegado: el logo vuelve a desplegar el menú */}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Desplegar el menú"
            className="hidden size-11 cursor-pointer items-center justify-center rounded-md hover:bg-sidebar-accent group-data-[collapsible=icon]:flex"
          >
            {logo}
          </button>
        </SidebarHeader>

        <SidebarContent className="gap-0" aria-label="Navegación principal">
          {renderGrupo(principales, "Secciones")}
          {renderGrupo(administracion, "Administración")}
        </SidebarContent>

        <SidebarFooter className="gap-1 p-3 group-data-[collapsible=icon]:px-2">
          <div className="flex flex-wrap items-center gap-1 group-data-[collapsible=icon]:flex-col-reverse group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:border-t group-data-[collapsible=icon]:pt-3 group-data-[collapsible=icon]:[&_button]:size-12 group-data-[collapsible=icon]:[&_button]:rounded-xl group-data-[collapsible=icon]:[&_svg]:size-5">
            <div className="order-1 flex w-full items-center justify-end border-b pb-1 group-data-[collapsible=icon]:order-none group-data-[collapsible=icon]:w-auto group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:border-b-0 group-data-[collapsible=icon]:pb-0">
              <RemindersBell />
              <ThemeModeToggle />
            </div>
            <div className="order-2 group-data-[collapsible=icon]:order-none">
              <UserMenu>
                <PerfilMenuItem onAbrir={() => setPerfilAbierto(true)} />
              </UserMenu>
            </div>
            {/* Quién sos y con qué rol, sin abrir el menú */}
            <div className="order-3 ml-1 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium leading-tight">
                {identity?.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {nombreDe(ROLES, identity?.rol)}
              </p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>
      {perfilAbierto && (
        <PerfilDialog onClose={() => setPerfilAbierto(false)} />
      )}
    </>
  );
};
