import { expect, test } from "@playwright/test";
import { login } from "./users";

test.describe.serial("convite de acesso", () => {
  let invite = "";

  test("admin cadastra mecânico sem senha e recebe o link de convite pronto para o WhatsApp", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "admin");
    await page.goto("/admin/usuarios");
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=full_name]", "Rafael Costa");
    await page.fill("input[name=username]", "rafael");
    await page.selectOption("select[name=role]", "mecanico");
    await page.fill("input[name=phone]", "(91) 98111-2233");
    await page.getByRole("button", { name: "Criar usuário e gerar convite" }).click();
    await expect(page.getByText(/Usuário rafael criado. Envie o link/)).toBeVisible();
    invite = await page.locator('input[readonly][value*="/convite/"]').inputValue();
    expect(invite).toMatch(/\/convite\/[A-Za-z0-9_-]{43}$/);
    const wa = page.getByRole("link", { name: "Enviar no WhatsApp" });
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5591981112233\?text=/);
    expect(decodeURIComponent((await wa.getAttribute("href"))!)).toContain("Seu usuário: rafael");
    await page.reload();
    await expect(page.locator("details").filter({ hasText: "Rafael Costa" }).getByText("Convite enviado · aguardando criar a senha")).toBeVisible();
    await page.context().close();
  });

  test("mecânico abre o link, cria a senha e já entra; o link não serve de novo", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(invite);
    await expect(page.getByText("Olá, Rafael!")).toBeVisible();
    await expect(page.getByText("rafael", { exact: true })).toBeVisible();
    await page.fill("input[name=password]", "curta");
    await page.fill("input[name=confirm]", "curta");
    await page.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await expect(page.getByText("A senha precisa ter ao menos 8 caracteres")).toBeVisible();
    await page.fill("input[name=password]", "Rafa2026ok");
    await page.fill("input[name=confirm]", "Rafa2026xx");
    await page.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await expect(page.getByText("As senhas não são iguais")).toBeVisible();
    // por segurança os campos de senha são limpos após um erro
    await page.fill("input[name=password]", "Rafa2026ok");
    await page.fill("input[name=confirm]", "Rafa2026ok");
    await page.getByRole("button", { name: "Salvar senha e entrar" }).click();
    await page.waitForURL(/\/meus-carros/);
    await page.context().close();

    const again = await (await browser.newContext()).newPage();
    await again.goto(invite);
    await expect(again.getByText("Link expirado ou já usado")).toBeVisible();
    await again.goto("/login");
    await again.waitForLoadState("networkidle");
    await again.fill("input[name=username]", "rafael");
    await again.fill("input[name=password]", "Rafa2026ok");
    await again.click("button[type=submit]");
    await again.waitForURL(/\/meus-carros/);
    await again.context().close();
  });

  test("novo link (ex.: esqueceu a senha) cancela o anterior; cancelar convite derruba o link", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "admin");
    await page.goto("/admin/usuarios");
    const card = page.locator("details").filter({ hasText: "Rafael Costa" });
    await card.locator("summary").click();
    await card.getByRole("button", { name: "Gerar link de convite" }).click();
    const first = await card.locator('input[readonly][value*="/convite/"]').inputValue();
    await card.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(card.locator('input[readonly][value*="/convite/"]')).not.toHaveValue(first);
    const second = await card.locator('input[readonly][value*="/convite/"]').inputValue();

    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(first);
    await expect(visitor.getByText("Link expirado ou já usado")).toBeVisible();
    await visitor.goto(second);
    await expect(visitor.getByText("Olá, Rafael!")).toBeVisible();

    await card.getByRole("button", { name: "Cancelar convite" }).click();
    await expect(card.getByText("Convite cancelado")).toBeVisible();
    await visitor.reload();
    await expect(visitor.getByText("Link expirado ou já usado")).toBeVisible();
    await page.context().close();
    await visitor.context().close();
  });
});
