import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, CalendarClock, LogOut, PanelLeft, Settings2, Kanban, Zap, Mail } from "lucide-react";
import React, { CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const menuItems = [
  { icon: BarChart3, label: "Resumen", path: "/", description: "Ejecución comercial" },
  { icon: CalendarClock, label: "Oportunidades", path: "/leads", description: "Embudo y seguimiento" },
  { icon: Kanban, label: "Embudo", path: "/embudo", description: "Vista visual del pipeline" },
  { icon: Zap, label: "Automatizaciones", path: "/automatizaciones", description: "Reglas y flujos automáticos" },
  { icon: Mail, label: "Email Marketing", path: "/email-marketing", description: "Campañas de email" },
  { icon: Settings2, label: "Configuración", path: "/configuracion", description: "Equipo, metas y reglas" },
];

const roleLabels: Record<string, string> = {
  guest: "Invitado",
  agent: "Agente",
  admin: "Administrador",
  superadmin: "Superadministrador",
};

const roleDescriptions: Record<string, string> = {
  guest: "Consulta y captura básica sobre sus propias oportunidades.",
  agent: "Gestiona seguimiento, actividades y avance diario del embudo comercial.",
  admin: "Administra equipo, reglas comerciales y control operativo.",
  superadmin: "Control total del CRM, permisos y configuración sensible.",
};

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_WIDTH;
    }

    const saved = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    }
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return <UnauthenticatedAccessGate />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function UnauthenticatedAccessGate() {
  const loginUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "#";
    }

    return getLoginUrl();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.04),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[32px] border border-slate-200/70 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)] sm:px-10 lg:px-12">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
              Acceso a Máquina de ventas
            </span>
            <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              El CRM comercial ya está disponible para validación con tu sesión.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Esta aplicación funciona como centro de operación comercial. Si entras sin sesión activa verás esta puerta de acceso en lugar de una pantalla vacía. Al iniciar sesión podrás revisar el resumen, ordenar oportunidades en el embudo, actualizar seguimientos y administrar reglas operativas.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={loginUrl}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-white px-6 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                  Entrar a Máquina de ventas

              </a>
              <a
                href="/"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Volver al acceso principal
              </a>
            </div>
          </section>

          <aside className="rounded-[32px] border border-slate-200/80 bg-white/90 p-7 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Qué podrás operar</p>
            <div className="mt-6 space-y-4">
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Embudo y prioridad comercial</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Captura de oportunidades con prioridad visible, puntaje comercial y valor potencial desde un solo flujo.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Seguimiento operativo</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Actualización de estado, notas, responsables y próximas acciones desde una sola vista operativa.</p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-950">Control comercial</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">Resumen con metas, ingresos, alertas y accesos directos para la ejecución diaria.</p>
              </article>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({ children, setSidebarWidth }: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location) ?? menuItems[0];
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = event.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-sidebar-border/70 bg-sidebar" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/70 px-3">
            <div className="flex items-center gap-3 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring shrink-0"
                aria-label="Alternar navegación"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/80" />
              </button>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sidebar-foreground/70">CRM comercial</p>
                  <p className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">Máquina de ventas</p>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            <SidebarMenu>
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-12 rounded-xl font-normal"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-sidebar-foreground/80"}`} />
                      <div className="flex min-w-0 flex-col text-left group-data-[collapsible=icon]:hidden">
                        <span className="truncate text-sm font-medium">{item.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border/70 p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium leading-none text-sidebar-foreground">{user?.name || "Usuario"}</p>
                      <span className="inline-flex shrink-0 rounded-full border border-sidebar-border/80 bg-sidebar-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/80">
                        {roleLabels[user?.role ?? "guest"] ?? "Usuario"}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted-foreground">{user?.email || "Sin correo"}</p>
                    <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground/90">
                      {roleDescriptions[user?.role ?? "guest"] ?? "Acceso operativo al CRM comercial."}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/20 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile ? (
          <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div>
                <p className="text-sm font-medium leading-none">{activeMenuItem.label}</p>
                <p className="text-xs text-muted-foreground">{activeMenuItem.description}</p>
              </div>
            </div>
          </div>
        ) : null}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
