import { describe, expect, it } from "vitest";
import {
  duration,
  formatPhone,
  formatPlate,
  isValidCpf,
  isValidPlate,
  money,
  normalizePhone,
  normalizePlate,
  parseMoney,
  whatsappLink,
} from "@/lib/format";

describe("placa", () => {
  it("normaliza e valida padrão antigo e Mercosul", () => {
    expect(normalizePlate("abc-1d23")).toBe("ABC1D23");
    expect(isValidPlate("ABC1D23")).toBe(true);
    expect(isValidPlate("abc 1234")).toBe(true);
    expect(isValidPlate("AB1234")).toBe(false);
    expect(isValidPlate("ABCD123")).toBe(false);
    expect(formatPlate("ABC1234")).toBe("ABC-1234");
    expect(formatPlate("ABC1D23")).toBe("ABC1D23");
  });
});

describe("telefone", () => {
  it("converte para E.164 brasileiro", () => {
    expect(normalizePhone("(91) 98888-7777")).toBe("+5591988887777");
    expect(normalizePhone("91 3721-0000")).toBe("+559137210000");
    expect(normalizePhone("+55 91 98888 7777")).toBe("+5591988887777");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("(00) 98888-7777")).toBeNull();
  });
  it("formata e gera link oficial wa.me", () => {
    expect(formatPhone("+5591988887777")).toBe("(91) 98888-7777");
    expect(whatsappLink("+5591988887777", "Olá, Maria")).toBe("https://wa.me/5591988887777?text=Ol%C3%A1%2C%20Maria");
  });
});

describe("CPF", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
});

describe("dinheiro e tempo", () => {
  it("converte valores digitados para centavos", () => {
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("180")).toBe(18000);
    expect(parseMoney("R$ 90,5")).toBe(9050);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
  });
  it("formata reais e durações", () => {
    expect(money(39000).replace(/\s/g, " ")).toBe("R$ 390,00");
    expect(duration(0.5)).toBe("30 min");
    expect(duration(3.25)).toBe("3 h 15 min");
    expect(duration(50)).toBe("2 d 2 h");
  });
});
