import { expect, test } from "@playwright/test";
import { login } from "./users";

function belemDay(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(d);
}

test.describe.serial("agenda", () => {
  test("atendimento agenda cliente novo; confirmação vai para a fila e lembretes ficam programados", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "ana");
    await page.getByRole("link", { name: "Agenda" }).first().click();
    await page.waitForURL(/\/agenda/);
    await page.getByRole("link", { name: "+ Agendar" }).click();
    await page.fill("input[name=q]", "91977776666");
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("link", { name: "+ Cliente novo" }).click();
    await page.waitForURL(/\/clientes\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=name]", "Roberto Lima");
    await expect(page.locator("input[name=whatsapp]")).toHaveValue("91977776666");
    await page.check("input[name=whatsapp_opt_in]");
    await page.getByRole("button", { name: /Salvar e cadastrar veículo/ }).click();
    await page.waitForURL(/\/veiculos\/novo/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=plate]", "OTP4B56");
    await page.fill("input[name=brand]", "Fiat");
    await page.fill("input[name=model]", "Strada");
    await page.getByRole("button", { name: /Salvar e agendar/ }).click();

    await page.waitForURL(/\/agenda\/novo\?veiculo=/);
    await page.waitForLoadState("networkidle");
    const day = belemDay(3);
    await page.fill("input[name=date]", day);
    await page.fill("input[name=time]", "09:30");
    await page.fill("input[name=service]", "Revisão de 60 mil km");
    await page.getByRole("button", { name: "Agendar e avisar o cliente" }).click();
    await page.waitForURL(new RegExp(`/agenda\\?dia=${day}`));
    await expect(page.getByText("Horário agendado.")).toBeVisible();
    await expect(page.getByText("Revisão de 60 mil km")).toBeVisible();
    await expect(page.getByText("09:30", { exact: true })).toBeVisible();
    await expect(page.getByText(/Lembrete 1 dia: \d\d\/\d\d 09:30/)).toBeVisible();
    await expect(page.getByText(/Lembrete 2 h: \d\d\/\d\d 07:30/)).toBeVisible();

    await page.goto("/mensagens");
    await expect(page.getByText(/Olá, Roberto! Seu horário na .+ está marcado para .+ às 09:30: Revisão de 60 mil km no seu Strada/)).toBeVisible();
    await page.goto("/mensagens?aba=programadas");
    await expect(page.getByText(/Passando para lembrar do seu horário amanhã, .+ às 09:30/)).toBeVisible();
    await expect(page.getByText(/seu horário na .+ é hoje às 09:30/)).toBeVisible();
    await page.context().close();
  });

  test("reagendar refaz os lembretes; cliente chega e vira OS", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "ana");
    const day = belemDay(3);
    await page.goto(`/agenda?dia=${day}`);
    await page.getByRole("link", { name: "Reagendar" }).click();
    await page.waitForURL(/\/editar/);
    await page.waitForLoadState("networkidle");
    await page.fill("input[name=time]", "14:00");
    await page.getByRole("button", { name: "Salvar novo horário" }).click();
    await page.waitForURL(/\/agenda\?dia=/);
    await expect(page.getByText("Horário alterado.")).toBeVisible();
    await expect(page.getByText(/Lembrete 2 h: \d\d\/\d\d 12:00/)).toBeVisible();

    await page.getByRole("button", { name: "Cliente confirmou" }).click();
    await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Chegou → abrir OS" }).click();
    await page.fill("input[name=entry_km]", "60120");
    await page.selectOption("select[name=mechanic_id]", { label: "João Mecânico" });
    await page.getByRole("button", { name: "Abrir ordem de serviço" }).click();
    await page.waitForURL(/\/os\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Revisão de 60 mil km").first()).toBeVisible();
    await expect(page.getByText("60.120 km").first()).toBeVisible();

    await page.goto(`/agenda?dia=${day}`);
    await expect(page.getByText("Chegou · OS aberta")).toBeVisible();
    // lembretes pendentes cancelados após a chegada
    await page.goto("/mensagens?aba=programadas");
    await expect(page.getByText(/seu horário na .+ é hoje às 14:00/)).toHaveCount(0);
    await page.context().close();
  });

  test("mecânico não acessa a agenda; perfil mostra a opção de avisos no celular", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await login(page, "joao");
    await page.goto("/agenda");
    await expect(page).toHaveURL(/\/meus-carros/);
    await page.goto("/perfil");
    await expect(page.getByText("Avisos no celular")).toBeVisible();
    await page.context().close();
  });
});
