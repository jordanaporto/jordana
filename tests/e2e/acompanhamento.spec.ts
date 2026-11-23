import { expect, test, type Page } from "@playwright/test";
import { login } from "./users";

/**
 * Link de acompanhamento: a equipe pega o link na OS, o cliente (sem login) acompanha
 * as etapas, vê o orçamento e aprova pelo celular; a equipe vê a decisão "via Link".
 */

const PLATE = "LNK2A34";
let orderUrl = "";
let trackingUrl = "";

async function advance(page: Page, label: string | RegExp) {
  await page.goto(orderUrl);
  const primary = page.getByRole("button", { name: label }).first();
  if (await primary.isVisible().catch(() => false)) {
    await primary.click();
  } else {
    await page.getByRole("button", { name: "Mais", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: label }).click();
  }
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /^Confirmar:/ }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("link de acompanhamento do cliente", () => {
  test("atendimento abre a OS e o link vai junto na mensagem de recebimento", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "ana");
    await page.goto(`/os/nova?q=${PLATE}`);
    await page.getByRole("link", { name: "+ Cliente novo" }).click();
    await page.waitForURL(/\/clientes\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=name]", "Carla Mendes Silva");
    await page.fill("input[name=whatsapp]", "(91) 97777-1212");
    await page.check("input[name=whatsapp_opt_in]");
    await page.getByRole("button", { name: /Salvar e cadastrar veículo/ }).click();
    await page.waitForURL(/\/veiculos\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=plate]", PLATE);
    await page.fill("input[name=brand]", "Hyundai");
    await page.fill("input[name=model]", "HB20");
    await page.getByRole("button", { name: /Salvar e abrir OS/ }).click();
    await page.waitForURL(/\/os\/nova\?veiculo=/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=entry_km]", "41000");
    await page.fill("textarea[name=complaint]", "Ar-condicionado não gela");
    await page.getByRole("button", { name: "Abrir ordem de serviço" }).click();
    await page.waitForURL(/\/os\/[0-9a-f-]{36}$/);
    orderUrl = new URL(page.url()).pathname;

    await expect(page.getByText("Link de acompanhamento do cliente")).toBeVisible();
    trackingUrl = await page.locator('input[readonly][value*="/acompanhar/"]').inputValue();
    expect(trackingUrl).toMatch(/^http:\/\/localhost:\d+\/acompanhar\/[A-Za-z0-9_-]{24,64}$/);
    await expect(page.getByText("cliente ainda não ativou avisos")).toBeVisible();

    await page.goto("/mensagens");
    const msg = page.locator("li").filter({ hasText: "Olá, Carla." });
    await expect(msg.getByText(`Acompanhe o andamento do seu veículo por aqui: ${trackingUrl}`)).toBeVisible();
    await page.context().close();
  });

  test("cliente abre o link sem login e vê a etapa atual, sem dados internos", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(trackingUrl);
    await expect(page).toHaveURL(trackingUrl);
    await expect(page.getByText("Olá, Carla!")).toBeVisible();
    await expect(page.getByText(/HB20/).first()).toBeVisible();
    await expect(page.getByText(/Seu veículo foi recebido/)).toBeVisible();
    // não expõe sobrenome, telefone nem a área interna
    await expect(page.getByText("Mendes")).toHaveCount(0);
    await expect(page.getByText("97777")).toHaveCount(0);
    await page.goto("/patio");
    await expect(page).toHaveURL(/\/login/);
    // link inválido
    await page.goto("/acompanhar/link-que-nao-existe-123456789");
    await expect(page.getByText(/Link expirado ou inválido/i)).toBeVisible();
    await page.context().close();
  });

  test("orçamento enviado: cliente aprova e recusa pelo link; equipe vê a decisão", async ({ browser }) => {
    const admin = await (await browser.newContext()).newPage();
    await login(admin, "admin");
    await advance(admin, "Iniciar inspeção");
    await advance(admin, "Iniciar diagnóstico");
    await admin.goto(`${orderUrl}/servicos`);
    const add = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Adicionar serviço" }) });
    for (const [title, labor] of [["Recarga de gás do ar", "250,00"], ["Higienização do ar", "80,00"]]) {
      await add.locator("input[name=title]").fill(title);
      await add.locator("input[name=labor_price]").fill(labor);
      await add.getByRole("button", { name: "Adicionar serviço" }).click();
      await expect(admin.getByRole("heading", { name: title })).toBeVisible();
      await expect(add.locator("input[name=title]")).toHaveValue("");
    }

    // antes do envio do orçamento o cliente ainda não vê os serviços
    const client = await (await browser.newContext()).newPage();
    await client.goto(trackingUrl);
    await expect(client.getByText("Recarga de gás do ar")).toHaveCount(0);

    await advance(admin, "Concluir diagnóstico");
    await advance(admin, "Preparar orçamento");
    await advance(admin, "Enviar ao cliente");

    await client.reload();
    await expect(client.getByText(/aguarda a sua aprovação/i).first()).toBeVisible();
    const gas = client.locator("li").filter({ hasText: "Recarga de gás do ar" });
    await expect(gas.getByText("R$ 250,00")).toBeVisible();
    await gas.getByRole("button", { name: "Aprovar" }).click();
    await expect(gas.getByRole("button", { name: "✓ Aprovado" })).toBeVisible();
    const hig = client.locator("li").filter({ hasText: "Higienização do ar" });
    await hig.getByRole("button", { name: "Recusar" }).click();
    await expect(hig.getByRole("button", { name: "Recusado" })).toBeVisible();

    // decisão ficou gravada (recarrega)
    await client.reload();
    await expect(client.locator("li").filter({ hasText: "Recarga de gás do ar" }).getByRole("button", { name: "✓ Aprovado" })).toBeVisible();

    await admin.goto(`${orderUrl}/servicos`);
    const gasStaff = admin.locator("div.rounded-2xl").filter({ has: admin.getByRole("heading", { name: "Recarga de gás do ar" }) });
    await expect(gasStaff.getByText(/Aprovado\s+via Link de aprovação/)).toBeVisible();
    const higStaff = admin.locator("div.rounded-2xl").filter({ has: admin.getByRole("heading", { name: "Higienização do ar" }) });
    await expect(higStaff.getByText(/Recusado\s+via Link de aprovação/)).toBeVisible();

    // equipe pode trocar o link: o antigo para de funcionar
    await admin.goto(orderUrl);
    await admin.getByRole("button", { name: "Novo link" }).click();
    await admin.getByRole("button", { name: "Gerar novo link" }).click();
    await expect(admin.getByText("Novo link gerado.")).toBeVisible();
    await expect(admin.locator('input[readonly][value*="/acompanhar/"]')).not.toHaveValue(trackingUrl);
    await client.reload();
    await expect(client.getByText(/Link expirado ou inválido/i)).toBeVisible();
    await admin.context().close();
    await client.context().close();
  });
});
