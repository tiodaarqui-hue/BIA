"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Staff {
  id: string;
  name: string;
  role: string;
  barbershop?: {
    name: string;
  } | null;
}

interface SidebarProps {
  staff: Staff;
}

interface MenuItem {
  href: string;
  label: string;
  icon: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/dashboard/agenda", label: "Agenda", icon: "calendar" },
  { href: "/dashboard/clientes", label: "Clientes", icon: "users" },
  { href: "/dashboard/barbeiros", label: "Barbeiros", icon: "scissors" },
  { href: "/dashboard/servicos", label: "Serviços", icon: "list" },
  { href: "/dashboard/planos", label: "Planos", icon: "star" },
  {
    href: "/dashboard/financeiro",
    label: "Financeiro",
    icon: "dollar",
    children: [
      { href: "/dashboard/financeiro", label: "Visão Geral", icon: "chart" },
      { href: "/dashboard/pagamentos", label: "Pagamentos", icon: "credit-card" },
      { href: "/dashboard/financeiro/comissoes", label: "Comissões", icon: "percent" },
      { href: "/dashboard/financeiro/entradas", label: "Entradas", icon: "arrow-down" },
      { href: "/dashboard/financeiro/saidas", label: "Saídas", icon: "arrow-up" },
      { href: "/dashboard/financeiro/fluxo", label: "Fluxo de Caixa", icon: "refresh" },
    ],
  },
];

const superAdminMenuItems: MenuItem[] = [
  { href: "/dashboard/super-admin", label: "Super Admin", icon: "shield" },
];

const icons: Record<string, React.ReactNode> = {
  grid: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  calendar: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  scissors: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
    </svg>
  ),
  list: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  ),
  star: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  dollar: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  chart: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "arrow-down": (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  ),
  "arrow-up": (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  ),
  refresh: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  percent: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7a2 2 0 100 4 2 2 0 000-4zm6 6a2 2 0 100 4 2 2 0 000-4zM6 18L18 6" />
    </svg>
  ),
  "credit-card": (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  shield: (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  chevron: (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
    </svg>
  ),
};

export function Sidebar({ staff }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
    // Auto-expand financeiro if we're on a financeiro page
    if (pathname.startsWith("/dashboard/financeiro")) {
      setExpandedMenus(["financeiro"]);
    }
  }, [pathname]);

  function toggleSidebar() {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  }

  function toggleMenu(menuId: string) {
    setExpandedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function renderMenuItem(item: MenuItem, isChild = false) {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.label.toLowerCase());
    const isActive = pathname === item.href;
    const isParentActive = hasChildren && pathname.startsWith(item.href);

    if (hasChildren && !collapsed) {
      return (
        <div key={item.href}>
          <button
            onClick={() => toggleMenu(item.label.toLowerCase())}
            className={`w-full flex items-center justify-between gap-3 rounded-lg transition-colors px-4 py-3 ${
              isParentActive
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <div className="flex items-center gap-3">
              {icons[item.icon]}
              <span>{item.label}</span>
            </div>
            <span
              className={`transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            >
              {icons.chevron}
            </span>
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1 border-l border-border pl-3">
              {item.children!.map((child) => renderMenuItem(child, true))}
            </div>
          )}
        </div>
      );
    }

    if (hasChildren && collapsed) {
      return (
        <Link
          key={item.href}
          href={item.href}
          title={item.label}
          className={`flex items-center justify-center p-3 rounded-lg transition-colors ${
            isParentActive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {icons[item.icon]}
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 rounded-lg transition-colors ${
          collapsed ? "justify-center p-3" : isChild ? "px-3 py-2 text-sm" : "px-4 py-3"
        } ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {icons[item.icon]}
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  return (
    <aside
      className={`relative bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out ${
        collapsed ? "w-14" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="pt-4 pb-5 border-b border-border">
        {collapsed ? (
          <div className="flex justify-center">
            <div
              className="rounded-full animate-shine-logo flex items-center justify-center"
              style={{ width: "13px", height: "13px" }}
            >
              <svg width="11" height="11" viewBox="0 0 100 100">
                <polygon points="50,10 88,80 12,80" fill="#0a0a0a" />
              </svg>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-1">
              <div
                className="rounded-full animate-shine-logo flex items-center justify-center"
                style={{ width: "13px", height: "13px" }}
              >
                <svg width="11" height="11" viewBox="0 0 100 100">
                  <polygon points="50,10 88,80 12,80" fill="#0a0a0a" />
                </svg>
              </div>
              <p className="text-sm font-light tracking-widest text-transparent animate-shine">
                BIA
              </p>
            </div>
            {staff.barbershop?.name && (
              <p className="text-xl font-light tracking-wide text-center mt-1 truncate px-4">
                {staff.barbershop.name}
              </p>
            )}
          </>
        )}
      </div>

      {/* Hamburger toggle button - outside sidebar */}
      <button
        onClick={toggleSidebar}
        className="absolute top-2 -right-9 p-2 rounded-lg hover:bg-muted/50 transition-colors group z-50"
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        <div className="flex flex-col gap-1">
          <span
            className={`block h-0.5 bg-muted-foreground group-hover:bg-foreground transition-all duration-300 w-4`}
          />
          <span
            className={`block h-0.5 bg-muted-foreground group-hover:bg-foreground transition-all duration-300 ${
              collapsed ? "w-4" : "w-3"
            }`}
          />
          <span
            className={`block h-0.5 bg-muted-foreground group-hover:bg-foreground transition-all duration-300 ${
              collapsed ? "w-4" : "w-2"
            }`}
          />
        </div>
      </button>

      {/* Navigation */}
      <nav className={`flex-1 p-2 space-y-1 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
        {staff.role === "super_admin" && (
          <>
            {superAdminMenuItems.map((item) => renderMenuItem(item))}
            <div className="border-b border-border my-2" />
          </>
        )}
        {menuItems.map((item) => renderMenuItem(item))}
      </nav>

      {/* User section */}
      <div className={`p-3 pb-6 border-t border-border ${collapsed ? "px-2" : "px-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
              {staff.name.charAt(0).toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground">
                {staff.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{staff.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {staff.role === "super_admin"
                    ? "Super Admin"
                    : staff.role === "admin"
                      ? "Administrador"
                      : staff.role}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sair
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
