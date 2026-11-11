import { expect, test, type Browser, type Page } from "@playwright/test";
import path from "node:path";
import { login } from "./users";

/**
 * Fluxo real de ponta a ponta, do jeito que a oficina usa:
 * atendimento abre a OS → mecânico inspeciona, fotografa, diagnostica → atendimento
 * orça, envia, registra aprovação → mecânico executa → atendimento gera PDF e entrega.
 */

const PLATE = "ABC1D23";
const PHOTO = path.resolve("tests/e2e/fixtures/foto.jpg");
let orderUrl = "";
let mediaUrl = "";

async function as(browser: Browser, who: Parameters<typeof login>[1]) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, who);
  return page;
}

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

test.describe.serial("fluxo completo da OS", () => {
  test("atendimento cadastra cliente, veículo e abre a OS", async ({ browser }) => {
    const page = await as(browser, "ana");
    await expect(page).toHaveURL(/\/patio/);
    await page.goto(`/os/nova?q=${PLATE}`);
    await page.getByRole("link", { name: "+ Cliente novo" }).click();
    await page.waitForURL(/\/clientes\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=name]", "Maria Souza");
    await page.fill("input[name=whatsapp]", "(91) 98888-7777");
    await page.fill("input[name=cpf]", "123");
    await page.check("input[name=whatsapp_opt_in]");
    await page.getByRole("button", { name: /Salvar e cadastrar veículo/ }).click();
    await expect(page.getByText("CPF inválido")).toBeVisible();
    await page.fill("input[name=cpf]", "529.982.247-25");
    await page.getByRole("button", { name: /Salvar e cadastrar veículo/ }).click();

    await page.waitForURL(/\/veiculos\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=plate]", "abc-1d23");
    await page.fill("input[name=brand]", "Chevrolet");
    await page.fill("input[name=model]", "Onix");
    await page.fill("input[name=year]", "2021");
    await page.fill("input[name=current_km]", "70000");
    await page.getByRole("button", { name: /Salvar e abrir OS/ }).click();

    await page.waitForURL(/\/os\/nova\?veiculo=/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=entry_km]", "72450");
    await page.fill("textarea[name=complaint]", "Barulho ao frear e volante puxando");
    await page.selectOption("select[name=mechanic_id]", { label: "João Mecânico" });
    await page.getByRole("button", { name: "Abrir ordem de serviço" }).click();
    await page.waitForURL(/\/os\/[0-9a-f-]{36}$/);
    orderUrl = new URL(page.url()).pathname;
    await expect(page.getByText("Veículo recebido").first()).toBeVisible();
    await expect(page.getByText("72.450 km").first()).toBeVisible();

    // mensagem automática "veículo recebido" na fila manual
    await page.goto("/mensagens");
    await expect(page.getByText("Olá, Maria. Seu Onix foi recebido")).toBeVisible();
    const wa = page.getByRole("link", { name: "Abrir no WhatsApp" }).first();
    await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/5591988887777\?text=/);
    await page.getByRole("button", { name: "Marcar como enviada" }).first().click();
    await expect(page.getByText("Olá, Maria. Seu Onix foi recebido")).toBeHidden();
    await page.context().close();
  });

  test("mecânico inspeciona, fotografa e diagnostica", async ({ browser }) => {
    const page = await as(browser, "joao");
    await expect(page).toHaveURL(/\/meus-carros/);
    await page.getByText(PLATE).first().click();
    await page.waitForURL(/\/os\//);
    await advance(page, "Iniciar inspeção");
    await expect(page.getByText("Em inspeção").first()).toBeVisible();

    await page.goto(`${orderUrl}/checklist`);
    await page.getByRole("radiogroup", { name: "Dianteiro esquerdo" }).getByRole("radio", { name: "OK" }).click();
    await page.getByText("Freios", { exact: true }).click();
    const pastilhas = page.locator("li").filter({ has: page.getByRole("radiogroup", { name: "Pastilhas" }) });
    await pastilhas.getByRole("radio", { name: "Reparo" }).click();
    await expect(pastilhas.getByText("Necessita reparo")).toBeVisible();
    await pastilhas.getByRole("button", { name: "Nota" }).click();
    await pastilhas.locator("textarea").fill("Pastilha com 2 mm");
    await pastilhas.locator("textarea").blur();
    await pastilhas.locator('input[type=file][accept="image/*"]').setInputFiles(PHOTO);
    await expect(pastilhas.locator("img")).toHaveCount(1, { timeout: 30_000 });
    mediaUrl = (await pastilhas.locator("a").first().getAttribute("href"))!;
    expect(mediaUrl).toMatch(/^\/api\/media\//);

    // salvo no banco (recarrega)
    await page.reload();
    await page.getByText("Freios", { exact: true }).click();
    await expect(page.locator("li").filter({ has: page.getByRole("radiogroup", { name: "Pastilhas" }) }).getByRole("radio", { name: "Reparo" })).toHaveAttribute("aria-checked", "true");

    await advance(page, "Iniciar diagnóstico");
    await page.goto(`${orderUrl}/diagnostico`);
    await page.fill("textarea[name=tests_performed]", "Teste de rodagem e inspeção visual");
    await page.fill("textarea[name=root_cause]", "Pastilhas dianteiras no fim da vida útil");
    await page.fill("textarea[name=recommendation]", "Substituir pastilhas e fazer alinhamento");
    await page.getByRole("button", { name: "Salvar diagnóstico" }).click();
    await expect(page.getByText("Diagnóstico salvo")).toBeVisible();

    await page.goto(`${orderUrl}/servicos`);
    const add = page.locator("form").filter({ has: page.getByRole("button", { name: "Adicionar serviço" }) });
    await add.locator("input[name=title]").fill("Troca de pastilhas dianteiras");
    await add.locator("input[name=part_name]").fill("Jogo de pastilhas");
    await add.getByRole("button", { name: "Urgente" }).click();
    await add.getByRole("button", { name: "Adicionar serviço" }).click();
    await expect(page.getByRole("heading", { name: "Troca de pastilhas dianteiras" })).toBeVisible();
    await expect(add.locator("input[name=title]")).toHaveValue("");
    await add.locator("input[name=title]").fill("Alinhamento");
    await add.getByRole("button", { name: "Pode acompanhar" }).click();
    await add.getByRole("button", { name: "Adicionar serviço" }).click();
    await expect(page.getByRole("heading", { name: "Alinhamento" })).toBeVisible();
    // mecânico não vê valores
    await expect(page.getByText("Orçamento total")).toHaveCount(0);

    await advance(page, "Concluir diagnóstico");
    await expect(page.getByText("Diagnóstico concluído").first()).toBeVisible();
    await page.context().close();
  });

  test("atendimento orça, envia e registra a aprovação por item", async ({ browser }) => {
    const page = await as(browser, "ana");
    await advance(page, "Preparar orçamento");
    await page.goto(`${orderUrl}/servicos`);
    const prices: [string, string, string][] = [
      ["Troca de pastilhas dianteiras", "180,00", "120,00"],
      ["Alinhamento", "", "90,00"],
    ];
    for (const [title, part, labor] of prices) {
      const card = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: title }) });
      await card.getByText("Editar serviço").click();
      if (part) await card.locator("input[name=part_unit_price]").fill(part);
      await card.locator("input[name=labor_price]").fill(labor);
      await card.getByRole("button", { name: "Salvar serviço" }).click();
      await expect(card.getByText("Serviço atualizado")).toBeVisible();
    }
    await page.reload();
    await expect(page.getByText("R$ 390,00").first()).toBeVisible();

    await advance(page, "Enviar ao cliente");
    await page.goto("/mensagens");
    await expect(page.getByText("Concluímos a avaliação do seu veículo")).toBeVisible();

    await page.goto(`${orderUrl}/servicos`);
    const pads = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "Troca de pastilhas dianteiras" }) });
    await pads.getByRole("button", { name: "Cliente aprovou" }).click();
    await pads.locator("select[name=method]").selectOption("whatsapp");
    await pads.getByRole("button", { name: "Registrar aprovação" }).click();
    await expect(pads.getByText(/Aprovado\s+via WhatsApp/)).toBeVisible();

    const align = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "Alinhamento" }) });
    await align.getByRole("button", { name: "Cliente recusou" }).click();
    await align.locator("select[name=method]").selectOption("telefone");
    await align.locator("input[name=note]").fill("Vai fazer no mês que vem");
    await align.getByRole("button", { name: "Registrar recusa" }).click();
    await expect(align.getByText(/Recusado\s+via Telefone/)).toBeVisible();

    await advance(page, "Confirmar aprovação");
    await expect(page.getByText("Serviço aprovado").first()).toBeVisible();
    await page.context().close();
  });

  test("mecânico executa, testa e conclui", async ({ browser }) => {
    const page = await as(browser, "joao");
    await advance(page, "Iniciar serviços");
    await page.goto(`${orderUrl}/servicos`);
    const pads = page.locator("div.rounded-2xl").filter({ has: page.getByRole("heading", { name: "Troca de pastilhas dianteiras" }) });
    await pads.getByRole("button", { name: "✓ Executado" }).click();
    await pads.locator("input[name=notes]").fill("Pastilhas Cobreq instaladas");
    await pads.getByRole("button", { name: "Confirmar" }).click();
    await expect(pads.getByText(/Executado por João Mecânico/)).toBeVisible();
    await advance(page, "Iniciar teste");
    await advance(page, "Concluir serviço");
    await expect(page.getByText("Serviço concluído").first()).toBeVisible();
    await page.context().close();
  });

  test("atendimento libera, gera o PDF e entrega", async ({ browser }) => {
    const page = await as(browser, "ana");
    await advance(page, "Liberar para retirada");
    await page.goto("/mensagens");
    await expect(page.getByText("Seu veículo está pronto")).toBeVisible();

    await page.goto(`${orderUrl}/relatorio`);
    await page.getByRole("button", { name: "Gerar relatório em PDF" }).click();
    await expect(page.getByText(/Relatório versão 1 gerado/)).toBeVisible({ timeout: 60_000 });
    await page.reload();
    const href = await page.getByRole("link", { name: /Versão 1/ }).getAttribute("href");
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    expect(body.length).toBeGreaterThan(5000);

    await advance(page, "Registrar entrega");
    await expect(page.getByText("Entregue").first()).toBeVisible();

    // histórico do veículo
    await page.getByRole("link", { name: "Ficha do veículo" }).click();
    await expect(page.getByText("Histórico de atendimentos (1)")).toBeVisible();
    await expect(page.getByText("Troca de pastilhas dianteiras")).toBeVisible();
    await expect(page.getByText("Recomendações não realizadas")).toBeVisible();
    await page.context().close();
  });

  test("linha do tempo registra usuário, data e etapas", async ({ browser }) => {
    const page = await as(browser, "admin");
    await page.goto(`${orderUrl}/historico`);
    await expect(page.getByText("Tempo em cada etapa")).toBeVisible();
    for (const s of ["Etapa: Veículo recebido", "Etapa: Em inspeção", "Etapa: Aguardando aprovação", "Etapa: Entregue"]) {
      await expect(page.getByText(s, { exact: true })).toBeVisible();
    }
    await expect(page.getByText("Cliente recusou").first()).toBeVisible();
    await page.goto("/admin/auditoria?os=1");
    await expect(page.getByRole("cell", { name: /João Mecânico/ }).first()).toBeVisible();
    await page.goto("/gestao");
    await expect(page.getByText("R$ 300,00").first()).toBeVisible(); // faturamento executado (180 + 120)
    await page.goto("/admin");
    await expect(page.getByText("Na oficina agora")).toBeVisible();
    await page.context().close();
  });

  test("segurança: outro mecânico e visitantes não acessam a OS nem a foto", async ({ browser, request }) => {
    const anon = await request.get(mediaUrl);
    expect(anon.status()).toBe(401);
    const pdfAnon = await request.get(`/api${orderUrl}/relatorio?versao=1`, { maxRedirects: 0 });
    expect(pdfAnon.status()).toBe(401);

    const pedro = await as(browser, "pedro");
    const r = await pedro.goto(orderUrl);
    expect(r?.status()).toBe(404);
    const m = await pedro.request.get(mediaUrl);
    expect(m.status()).toBe(404);
    await pedro.goto("/admin/usuarios");
    await expect(pedro).toHaveURL(/\/meus-carros/);
    await pedro.context().close();

    const dono = await as(browser, "dono");
    const up = await dono.request.post(`/api${orderUrl}/media`, { multipart: { file: { name: "x.jpg", mimeType: "image/jpeg", buffer: Buffer.from("x") } } });
    expect(up.status()).toBe(403);
    await dono.context().close();
  });
});
