import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { date, dateTime, formatCpf, formatPhone, formatPlate, km, money, osNumber } from "../format";
import { APPROVAL_METHOD, CHECKLIST_RESULT, EXECUTION, FUEL, PRIORITY, STATUS_META, type ChecklistResult, type OsStatus, type Priority } from "../status";
import type { ReportData } from "./data";

import { brand } from "../brand";

const RED = brand.primary;
const INK = "#0d0d0d";
const GRAY = "#6b6b6b";
const LINE = "#e4e4e7";

const s = StyleSheet.create({
  page: { padding: 32, paddingBottom: 48, fontSize: 9.5, fontFamily: "Helvetica", color: INK },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 3, borderBottomColor: RED, paddingBottom: 8, marginBottom: 12 },
  brand: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  brandSub: { fontSize: 8, color: RED, letterSpacing: 2, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "right" },
  muted: { color: GRAY },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", backgroundColor: INK, color: "#fff", paddingVertical: 4, paddingHorizontal: 6, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: "row" },
  col: { flex: 1 },
  label: { fontSize: 7.5, color: GRAY, textTransform: "uppercase", marginBottom: 1 },
  value: { marginBottom: 5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 3 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8, color: GRAY },
  badge: { fontSize: 7.5, fontFamily: "Helvetica-Bold", paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3, color: "#fff" },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: GRAY, borderTopWidth: 0.5, borderTopColor: LINE, paddingTop: 4 },
  photo: { width: "31.5%", marginBottom: 8 },
});

const RESULT_COLOR: Record<ChecklistResult, string> = { ok: "#15803d", atencao: "#b45309", necessita_reparo: RED, nao_avaliado: "#a1a1aa" };

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={s.value}>
      <Text style={s.label}>{label}</Text>
      <Text>{value || "—"}</Text>
    </View>
  );
}

export function ReportDocument({
  data,
  images,
  version,
  generatedBy,
  logo,
}: {
  data: NonNullable<ReportData>;
  images: { data: Buffer; format: "jpg" | "png"; caption: string }[];
  version: number;
  generatedBy: string;
  logo?: Buffer | null;
}) {
  const { order, customer, vehicle, company, checklist, diagnosis, items, history, notes, technicians } = data;
  const approved = items.filter((i) => i.approval_status === "aprovado");
  const refused = items.filter((i) => i.approval_status === "recusado");
  const executed = items.filter((i) => i.execution_status === "executado");
  const sum = (arr: readonly Record<string, unknown>[]) => arr.reduce((a, i) => a + Number(i.total_cents), 0);
  const cats = Array.from(new Set(checklist.map((c) => c.category_name as string)));
  const evaluated = checklist.filter((c) => c.result !== "nao_avaliado");

  return (
    <Document title={`Relatório ${osNumber(order.number)} - ${formatPlate(order.plate)}`} author={company.name || brand.name}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            {logo ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image do PDF não tem alt
              <Image src={{ data: logo, format: "png" }} style={{ width: 130, height: 48, objectFit: "contain", marginBottom: 3 }} />
            ) : (
              <Text style={s.brand}>{(company.name || brand.name).toUpperCase()}</Text>
            )}
            <Text style={s.brandSub}>RELATÓRIO DE ATENDIMENTO</Text>
            <Text style={[s.muted, { fontSize: 7.5, marginTop: 2 }]}>
              {[company.cnpj && `CNPJ ${company.cnpj}`, company.address, company.phone].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View>
            <Text style={s.title}>{osNumber(order.number)}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Entrada: {dateTime(order.entry_at)}</Text>
            <Text style={[s.muted, { textAlign: "right" }]}>Situação: {STATUS_META[order.status as OsStatus].label}</Text>
          </View>
        </View>

        <View style={s.row}>
          <View style={[s.col, { paddingRight: 12 }]}>
            <Text style={s.h2}>Cliente</Text>
            <Field label="Nome" value={customer?.name} />
            <Field label="WhatsApp / telefone" value={formatPhone(customer?.whatsapp ?? customer?.phone)} />
            {customer?.cpf && <Field label="CPF" value={formatCpf(customer.cpf)} />}
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Veículo</Text>
            <View style={s.row}>
              <View style={s.col}>
                <Field label="Placa" value={formatPlate(vehicle.plate)} />
                <Field label="Marca / modelo" value={`${vehicle.brand} ${vehicle.model} ${vehicle.version ?? ""}`} />
                <Field label="Ano" value={vehicle.year ? String(vehicle.year) : null} />
              </View>
              <View style={s.col}>
                <Field label="Quilometragem de entrada" value={km(order.entry_km)} />
                <Field label="Motor / combustível" value={[vehicle.engine, vehicle.fuel ? FUEL[vehicle.fuel as keyof typeof FUEL] : null].filter(Boolean).join(" · ")} />
                <Field label="Cor" value={vehicle.color} />
              </View>
            </View>
          </View>
        </View>

        <Text style={s.h2}>Reclamação do cliente</Text>
        <Text>{order.complaint}</Text>
        {order.intake_notes && <Text style={[s.muted, { marginTop: 3 }]}>Observações da recepção: {order.intake_notes}</Text>}

        <Text style={s.h2}>Checklist de inspeção ({evaluated.length} de {checklist.length} itens avaliados)</Text>
        {cats.map((cat) => {
          const rows = checklist.filter((c) => c.category_name === cat);
          const done = rows.filter((c) => c.result !== "nao_avaliado");
          const skipped = rows.filter((c) => c.result === "nao_avaliado");
          return (
            <View key={cat} wrap={false} style={{ marginBottom: 5 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{cat}</Text>
              {done.map((c, i) => (
                <View key={i} style={s.tr}>
                  <Text style={{ width: "34%" }}>{c.item_name}</Text>
                  <View style={{ width: "18%" }}>
                    <Text style={[s.badge, { backgroundColor: RESULT_COLOR[c.result as ChecklistResult], alignSelf: "flex-start" }]}>
                      {CHECKLIST_RESULT[c.result as ChecklistResult].label}
                    </Text>
                  </View>
                  <Text style={{ width: "48%", color: GRAY }}>{c.note ?? ""}</Text>
                </View>
              ))}
              {skipped.length > 0 && (
                <Text style={[s.muted, { fontSize: 8, marginTop: 2 }]}>
                  Não avaliados: {skipped.map((c) => c.item_name).join(", ")}
                </Text>
              )}
            </View>
          );
        })}

        {diagnosis && (
          <View wrap={false}>
            <Text style={s.h2}>Diagnóstico técnico</Text>
            <View style={s.row}>
              <View style={[s.col, { paddingRight: 10 }]}>
                <Field label="Sintoma relatado" value={diagnosis.reported_symptom} />
                <Field label="Testes realizados" value={diagnosis.tests_performed} />
                <Field label="Resultados" value={diagnosis.results} />
              </View>
              <View style={s.col}>
                <Field label="Causa encontrada" value={diagnosis.root_cause} />
                <Field label="Componentes envolvidos" value={diagnosis.components} />
                <Field label="Recomendação" value={diagnosis.recommendation} />
              </View>
            </View>
            {diagnosis.technical_notes && <Field label="Observações técnicas" value={diagnosis.technical_notes} />}
          </View>
        )}

        <Text style={s.h2} minPresenceAhead={60}>Serviços recomendados</Text>
        <View style={[s.tr, { borderBottomColor: INK }]}>
          <Text style={[s.th, { width: "36%" }]}>Serviço / peça</Text>
          <Text style={[s.th, { width: "14%" }]}>Prioridade</Text>
          <Text style={[s.th, { width: "20%" }]}>Decisão do cliente</Text>
          <Text style={[s.th, { width: "16%" }]}>Execução</Text>
          <Text style={[s.th, { width: "14%", textAlign: "right" }]}>Valor</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <View style={{ width: "36%" }}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{it.title}</Text>
              {it.part_name && (
                <Text style={s.muted}>
                  {it.part_name} × {Number(it.quantity).toLocaleString("pt-BR")}
                </Text>
              )}
              {it.description && <Text style={s.muted}>{it.description}</Text>}
            </View>
            <Text style={{ width: "14%" }}>{PRIORITY[it.priority as Priority].label}</Text>
            <Text style={{ width: "20%" }}>
              {it.approval_status === "pendente" ? "Sem decisão" : it.approval_status === "aprovado" ? "Aprovado" : "Recusado"}
              {it.last_decision ? `\n${APPROVAL_METHOD[it.last_decision.method as keyof typeof APPROVAL_METHOD]} · ${date(it.last_decision.decided_at)}` : ""}
            </Text>
            <Text style={{ width: "16%" }}>
              {it.approval_status === "aprovado" ? EXECUTION[it.execution_status as keyof typeof EXECUTION] : "—"}
              {it.executed_by_name ? `\n${it.executed_by_name}` : ""}
            </Text>
            <Text style={{ width: "14%", textAlign: "right" }}>{money(it.total_cents)}</Text>
          </View>
        ))}
        <View style={{ marginTop: 6, alignSelf: "flex-end", width: "50%" }}>
          {[
            ["Total recomendado", sum(items)],
            ["Aprovado", sum(approved)],
            ["Recusado", sum(refused)],
            ["Executado", sum(executed)],
          ].map(([l, v]) => (
            <View key={l as string} style={[s.row, { justifyContent: "space-between", paddingVertical: 1.5 }]}>
              <Text style={l === "Executado" ? { fontFamily: "Helvetica-Bold" } : s.muted}>{l as string}</Text>
              <Text style={l === "Executado" ? { fontFamily: "Helvetica-Bold" } : {}}>{money(v as number)}</Text>
            </View>
          ))}
        </View>
        {refused.length > 0 && (
          <Text style={[s.muted, { marginTop: 6 }]}>
            Itens recusados ficam registrados no histórico do veículo como recomendação para próximas visitas.
          </Text>
        )}

        {(order.final_notes || notes.length > 0) && (
          <View>
            <Text style={s.h2} minPresenceAhead={40}>Observações</Text>
            {order.final_notes && <Text style={{ marginBottom: 4 }}>{order.final_notes}</Text>}
            {notes.map((n, i) => (
              <Text key={i} style={{ marginBottom: 2 }}>
                <Text style={s.muted}>{dateTime(n.created_at)} · {n.full_name}: </Text>
                {n.body}
              </Text>
            ))}
          </View>
        )}

        {images.length > 0 && (
          <View>
            <Text style={s.h2} minPresenceAhead={160}>Fotos do atendimento</Text>
            <View style={[s.row, { flexWrap: "wrap", justifyContent: "space-between" }]}>
              {images.map((img, i) => (
                <View key={i} style={s.photo} wrap={false}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do PDF não tem alt */}
                  <Image src={{ data: img.data, format: img.format }} style={{ width: "100%", height: 130, objectFit: "cover" }} />
                  {img.caption && <Text style={[s.muted, { fontSize: 7.5, marginTop: 2 }]}>{img.caption}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        <View>
          <Text style={s.h2} minPresenceAhead={80}>Histórico do atendimento</Text>
          {history.map((h, i) => (
            <View key={i} style={s.tr}>
              <Text style={{ width: "24%" }}>{dateTime(h.changed_at)}</Text>
              <Text style={{ width: "34%", fontFamily: "Helvetica-Bold" }}>{STATUS_META[h.to_status as OsStatus].label}</Text>
              <Text style={{ width: "42%", color: GRAY }}>
                {h.full_name ?? ""}
                {h.note ? ` — ${h.note}` : ""}
              </Text>
            </View>
          ))}
        </View>

        <View style={[s.row, { marginTop: 18 }]} wrap={false}>
          <View style={s.col}>
            <Text style={s.label}>Técnico(s) responsável(is)</Text>
            <Text>{technicians.map((t) => t.full_name).join(", ") || "—"}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.label}>Data</Text>
            <Text>{date(order.delivered_at ?? order.completed_at ?? new Date())}</Text>
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {osNumber(order.number)} · {formatPlate(order.plate)} · versão {version} · gerado por {generatedBy} em {dateTime(new Date())}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
