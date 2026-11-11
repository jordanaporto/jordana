import Link from "next/link";
import { Bell, Building2, ListChecks, MessageSquareText, ShieldCheck, UserCog, History } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { ADMIN } from "@/lib/roles";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Administração" };

const LINKS = [
  { href: "/admin/usuarios", icon: UserCog, title: "Usuários", text: "Criar logins, perfis, desativar, redefinir senha" },
  { href: "/admin/checklist", icon: ListChecks, title: "Checklist", text: "Categorias e itens da inspeção" },
  { href: "/admin/mensagens", icon: MessageSquareText, title: "Mensagens do WhatsApp", text: "Textos automáticos por etapa" },
  { href: "/admin/alertas", icon: Bell, title: "Alertas", text: "Limites de tempo de cada alerta" },
  { href: "/admin/empresa", icon: Building2, title: "Empresa e integração", text: "Dados do relatório e provedor do WhatsApp" },
  { href: "/admin/auditoria", icon: History, title: "Auditoria", text: "Histórico completo de alterações" },
  { href: "/admin/lgpd", icon: ShieldCheck, title: "Privacidade (LGPD)", text: "Exportar ou anonimizar dados de cliente" },
];

export default async function AdminConfigPage() {
  await requireUser(ADMIN);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Administração" />
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="flex gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-400">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-ink text-white">
              <Icon className="size-6" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-zinc-600">{text}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
