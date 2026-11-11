import { expect, test } from "@playwright/test";
import { login } from "./users";

test.describe.serial("administração", () => {
  test("admin cria mecânico; senha provisória obriga troca no primeiro acesso", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.goto("/admin/usuarios");
    await page.fill("input[name=full_name]", "Carla Souza");
    await page.fill("input[name=username]", "carla");
    await page.selectOption("select[name=role]", "mecanico");
    await page.fill("input[name=password]", "Provisoria1");
    await page.getByRole("button", { name: "Criar usuário" }).click();
    await expect(page.getByText(/Usuário carla criado/)).toBeVisible();
    await ctx.close();

    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await p2.goto("/login");
    await p2.waitForLoadState("networkidle");
    await p2.fill("input[name=username]", "carla");
    await p2.fill("input[name=password]", "Provisoria1");
    await p2.click("button[type=submit]");
    await p2.waitForURL(/\/perfil/);
    await expect(p2.getByText("Sua senha é provisória")).toBeVisible();
    // não consegue sair do perfil antes de trocar
    await p2.goto("/meus-carros");
    await expect(p2).toHaveURL(/\/perfil/);
    await p2.fill("input[name=current]", "Provisoria1");
    await p2.fill("input[name=password]", "MinhaSenha9");
    await p2.fill("input[name=confirm]", "MinhaSenha9");
    await p2.getByRole("button", { name: "Salvar nova senha" }).click();
    await p2.waitForURL(/\/meus-carros/);
    await c2.close();
  });

  test("admin desativa usuário e o acesso cai na hora", async ({ browser }) => {
    const c = await browser.newContext();
    const carla = await c.newPage();
    await carla.goto("/login");
    await carla.waitForLoadState("networkidle");
    await carla.fill("input[name=username]", "carla");
    await carla.fill("input[name=password]", "MinhaSenha9");
    await carla.click("button[type=submit]");
    await carla.waitForURL(/\/meus-carros/);

    const a = await browser.newContext();
    const admin = await a.newPage();
    await login(admin, "admin");
    await admin.goto("/admin/usuarios");
    const row = admin.locator("details").filter({ hasText: "Carla Souza" });
    await row.locator("summary").click();
    await row.locator("input[name=active]").uncheck();
    await row.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(row.getByText("Usuário atualizado")).toBeVisible();

    await carla.goto("/meus-carros");
    await expect(carla).toHaveURL(/\/login/);
    await a.close();
    await c.close();
  });

  test("admin cria item no checklist e edita mensagem automática com prévia", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "admin");
    await page.goto("/admin/checklist");
    const freios = page.locator("section").filter({ has: page.getByRole("heading", { name: /Freios/ }) });
    await freios.locator("input[name=name]").last().fill("Freio de mão");
    await freios.getByRole("button", { name: "+ Adicionar item" }).click();
    await expect(freios.getByText("Freio de mão")).toBeVisible();

    await page.goto("/admin/mensagens");
    const tpl = page.locator("section").filter({ hasText: "Agradecimento pela visita" });
    await tpl.locator("textarea[name=body]").fill("Oi {nome}, seu {modelo} placa {placa} está pronto!");
    await expect(tpl.getByText("Oi Maria, seu Onix placa QZX1A23 está pronto!")).toBeVisible();
    await tpl.getByRole("button", { name: "Salvar modelo" }).click();
    await expect(tpl.getByText("Modelo salvo")).toBeVisible();

    await page.goto("/admin/alertas");
    await page.fill("input[name=no_update_hours]", "6");
    await page.getByRole("button", { name: "Salvar limites" }).click();
    await expect(page.getByText("Limites dos alertas salvos")).toBeVisible();
    await ctx.close();
  });
});
