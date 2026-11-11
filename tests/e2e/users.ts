import type { Page } from "@playwright/test";

export const USERS = {
  admin: { username: "admin", name: "Admin Teste", role: "admin", password: "Admin12345" },
  ana: { username: "ana", name: "Ana Atendimento", role: "atendimento", password: "Ana123456" },
  joao: { username: "joao", name: "João Mecânico", role: "mecanico", password: "Joao12345" },
  pedro: { username: "pedro", name: "Pedro Mecânico", role: "mecanico", password: "Pedro12345" },
  dono: { username: "dono", name: "Dono Gestão", role: "gestao", password: "Dono12345" },
} as const;

export async function login(page: Page, who: keyof typeof USERS) {
  const u = USERS[who];
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill("input[name=username]", u.username);
  await page.fill("input[name=password]", u.password);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
}
