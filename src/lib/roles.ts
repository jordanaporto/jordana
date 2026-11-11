export const ROLES = ["mecanico", "atendimento", "admin", "gestao"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  mecanico: "Mecânico",
  atendimento: "Atendimento",
  admin: "Administrador",
  gestao: "Gestão",
};

/** Perfis que leem tudo (clientes, valores, todas as OS) */
export const READ_ALL: readonly Role[] = ["atendimento", "admin", "gestao"];
/** Perfis que cadastram clientes, abrem OS, precificam e registram aprovações */
export const STAFF: readonly Role[] = ["atendimento", "admin"];
export const ADMIN: readonly Role[] = ["admin"];
export const MANAGEMENT: readonly Role[] = ["admin", "gestao"];

export const can = {
  readAll: (r: Role) => READ_ALL.includes(r),
  staff: (r: Role) => STAFF.includes(r),
  admin: (r: Role) => r === "admin",
  management: (r: Role) => MANAGEMENT.includes(r),
  seePrices: (r: Role) => READ_ALL.includes(r),
  editPrices: (r: Role) => STAFF.includes(r),
  recordApproval: (r: Role) => STAFF.includes(r),
  deleteMedia: (r: Role) => r === "admin",
};

export function homeFor(role: Role): string {
  switch (role) {
    case "mecanico":
      return "/meus-carros";
    case "atendimento":
      return "/patio";
    case "admin":
      return "/admin";
    case "gestao":
      return "/gestao";
  }
}

export type NavItem = { href: string; label: string; icon: string; badge?: "mensagens" | "alertas" };

export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "mecanico":
      return [
        { href: "/meus-carros", label: "Meus carros", icon: "car" },
        { href: "/buscar", label: "Buscar", icon: "search" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
    case "atendimento":
      return [
        { href: "/patio", label: "Pátio", icon: "layout", badge: "alertas" },
        { href: "/os/nova", label: "Nova OS", icon: "plus" },
        { href: "/clientes", label: "Clientes", icon: "users" },
        { href: "/mensagens", label: "Mensagens", icon: "message", badge: "mensagens" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
    case "admin":
      return [
        { href: "/admin", label: "Dashboard", icon: "chart", badge: "alertas" },
        { href: "/patio", label: "Pátio", icon: "layout" },
        { href: "/os/nova", label: "Nova OS", icon: "plus" },
        { href: "/clientes", label: "Clientes", icon: "users" },
        { href: "/mensagens", label: "Mensagens", icon: "message", badge: "mensagens" },
        { href: "/gestao", label: "Indicadores", icon: "trending" },
        { href: "/admin/config", label: "Administração", icon: "settings" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
    case "gestao":
      return [
        { href: "/gestao", label: "Indicadores", icon: "trending" },
        { href: "/admin", label: "Dashboard", icon: "chart" },
        { href: "/patio", label: "Pátio", icon: "layout" },
        { href: "/perfil", label: "Perfil", icon: "user" },
      ];
  }
}

/** Itens que cabem na barra inferior do celular (no máximo 5) */
export function mobileNavFor(role: Role): NavItem[] {
  const all = navFor(role);
  if (role === "admin") {
    return all.filter((i) => ["/admin", "/patio", "/os/nova", "/mensagens", "/admin/config"].includes(i.href));
  }
  return all.slice(0, 5);
}
