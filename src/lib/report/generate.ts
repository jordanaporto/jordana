import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { asUser } from "../db";
import type { SessionUser } from "../auth/session";
import { storage } from "../storage";
import { loadReportData, loadReportImages } from "./data";
import { ReportDocument } from "./document";

/** Gera o PDF, guarda no armazenamento privado e registra a versão. */
export async function generateReport(user: SessionUser, orderId: string) {
  const prepared = await asUser(user.id, async (sql) => {
    const data = await loadReportData(sql, orderId);
    if (!data) return null;
    const [{ v }] = await sql`select app.next_report_version(${orderId}) as v`;
    return { data, version: v as number };
  });
  if (!prepared) throw Object.assign(new Error("OS não encontrada"), { code: "P0001" });

  const images = await loadReportImages(prepared.data.photos as never);
  const pdf = await renderToBuffer(
    ReportDocument({ data: prepared.data, images, version: prepared.version, generatedBy: user.fullName }),
  );
  const key = `relatorios/${orderId}/v${prepared.version}-${Date.now()}.pdf`;
  await storage().put(key, pdf, "application/pdf");
  try {
    await asUser(user.id, (sql) => sql`select app.register_report(${orderId}, ${prepared.version}, ${key})`);
  } catch (e) {
    await storage().remove(key).catch(() => {});
    throw e;
  }
  return { version: prepared.version, size: pdf.length };
}
