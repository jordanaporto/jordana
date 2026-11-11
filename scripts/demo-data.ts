/**
 * Cria uma equipe e alguns carros em etapas diferentes para conhecer o sistema.
 * Uso: npm run db:demo        (somente em ambiente de teste/demonstração!)
 * Senha de todos os usuários de demonstração: Injecar2026
 */
import postgres from "postgres";
import { hashPassword } from "../src/lib/auth/password";
import { loadEnv } from "./env";
import { adminDatabaseUrl } from "../src/lib/db-url";

loadEnv();

const TEAM = [
  { username: "ana", full_name: "Ana Paula (Atendimento)", role: "atendimento" },
  { username: "joao", full_name: "João Silva", role: "mecanico" },
  { username: "carlos", full_name: "Carlos Mendes", role: "mecanico" },
  { username: "dono", full_name: "Proprietário", role: "gestao" },
] as const;

const CARS = [
  { name: "Maria Souza", phone: "91988887777", plate: "QZX1A23", brand: "Chevrolet", model: "Onix", year: 2021, km: 72450, complaint: "Barulho na suspensão dianteira", mech: "joao", to: ["em_inspecao"] },
  { name: "Roberto Lima", phone: "91987776655", plate: "OTP4B56", brand: "Fiat", model: "Strada", year: 2019, km: 98320, complaint: "Luz da injeção acesa e falhando", mech: "carlos", to: ["em_diagnostico"] },
  { name: "Juliana Castro", phone: "91986665544", plate: "PDX7C89", brand: "Hyundai", model: "HB20", year: 2020, km: 61200, complaint: "Freio fazendo barulho", mech: "joao", to: ["em_inspecao", "em_diagnostico", "diagnostico_concluido", "orcamento_em_preparacao", "aguardando_aprovacao"], items: true },
  { name: "Fernando Alves", phone: "91985554433", plate: "QAB2D34", brand: "Toyota", model: "Corolla", year: 2018, km: 120500, complaint: "Revisão de 120 mil km", mech: "carlos", to: ["em_inspecao", "em_diagnostico", "diagnostico_concluido", "orcamento_em_preparacao", "aguardando_aprovacao", "servico_aprovado", "em_manutencao", "aguardando_peca"], items: true, approve: true },
];

export async function seedDemo() {
  if (process.env.NODE_ENV === "production") throw new Error("não use dados de demonstração em produção");
  const sql = postgres(adminDatabaseUrl()!, { max: 1, onnotice: () => {} });
  try {
    const hash = await hashPassword("Injecar2026");
    const ids: Record<string, string> = {};
    for (const u of TEAM) {
      const [p] = await sql`
        insert into profiles (username, full_name, role) values (${u.username}, ${u.full_name}, ${u.role})
        on conflict (username) do update set full_name = excluded.full_name returning id`;
      await sql`insert into app.user_credentials (user_id, password_hash) values (${p.id}, ${hash})
                on conflict (user_id) do nothing`;
      ids[u.username] = p.id;
    }
    const as = <T>(user: string, fn: (tx: postgres.TransactionSql) => Promise<T>) =>
      sql.begin(async (tx) => {
        await tx`select set_config('app.user_id', ${ids[user]}, true)`;
        return fn(tx);
      }) as Promise<T>;

    for (const car of CARS) {
      const exists = await sql`select 1 from vehicles where plate = ${car.plate}`;
      if (exists.length) continue;
      const orderId = await as("ana", async (tx) => {
        const [c] = await tx`insert into customers (name, phone, whatsapp, whatsapp_opt_in)
                             values (${car.name}, ${"+55" + car.phone}, ${"+55" + car.phone}, true) returning id`;
        const [v] = await tx`insert into vehicles (customer_id, plate, brand, model, year, current_km)
                             values (${c.id}, ${car.plate}, ${car.brand}, ${car.model}, ${car.year}, ${car.km}) returning id`;
        const [o] = await tx`select app.open_service_order(${c.id}, ${v.id}, ${car.km}, ${ids[car.mech]}, ${car.complaint}, null) as id`;
        return o.id as string;
      });
      for (const st of car.to) {
        const actor = ["orcamento_em_preparacao", "aguardando_aprovacao", "servico_aprovado"].includes(st) ? "ana" : car.mech;
        if (st === "orcamento_em_preparacao" && car.items) {
          await as(car.mech, (tx) => tx`
            insert into service_items (service_order_id, title, part_name, priority) values
              (${orderId}, 'Troca de pastilhas dianteiras', 'Jogo de pastilhas', 'urgente'),
              (${orderId}, 'Troca do fluido de freio', 'Fluido DOT 4', 'recomendado'),
              (${orderId}, 'Alinhamento e balanceamento', null, 'pode_acompanhar')`);
          await tx_prices(orderId);
        }
        if (st === "servico_aprovado" && car.approve) {
          await as("ana", async (tx) => {
            const items = await tx`select id, priority from service_items where service_order_id = ${orderId}`;
            for (const it of items) {
              await tx`select app.record_decision(${it.id}, ${it.priority === "pode_acompanhar" ? "recusado" : "aprovado"}::approval_status, 'whatsapp', null)`;
            }
          });
        }
        await as(actor, (tx) => tx`select app.change_status(${orderId}, ${st}::os_status, null)`);
      }
      await as(car.mech, (tx) => tx`
        update service_order_checklist set result = 'ok'
         where service_order_id = ${orderId} and category_name in ('Pneus', 'Iluminação')`);
    }
    // agenda: alguns horários nos próximos dias (confirmação e lembretes vão para a fila)
    const [{ n: hasAppt }] = await sql`select count(*)::int as n from appointments`;
    if (!hasAppt) {
      const AGENDA = [
        { name: "Patrícia Rocha", phone: "91984443322", plate: "RTA5E67", brand: "Volkswagen", model: "Polo", year: 2022, days: 1, time: "08:00", service: "Revisão de 40 mil km" },
        { name: "Marcos Vieira", phone: "91983332211", plate: "SBC8F90", brand: "Jeep", model: "Renegade", year: 2020, days: 1, time: "10:30", service: "Alinhamento e balanceamento" },
        { name: "Lúcia Ferreira", phone: "91982221100", plate: "PQR1G23", brand: "Renault", model: "Kwid", year: 2021, days: 2, time: "14:00", service: "Ar-condicionado" },
        { name: "André Costa", phone: "91981110099", plate: "OKL4H56", brand: "Honda", model: "Civic", year: 2017, days: 4, time: "09:00", service: "Troca de óleo e filtros" },
      ];
      for (const a of AGENDA) {
        const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem" }).format(new Date(Date.now() + a.days * 86400_000));
        const at = new Date(`${day}T${a.time}:00-03:00`);
        await as("ana", async (tx) => {
          const [c] = await tx`insert into customers (name, phone, whatsapp, whatsapp_opt_in)
                               values (${a.name}, ${"+55" + a.phone}, ${"+55" + a.phone}, true) returning id`;
          const [v] = await tx`insert into vehicles (customer_id, plate, brand, model, year)
                               values (${c.id}, ${a.plate}, ${a.brand}, ${a.model}, ${a.year}) returning id`;
          await tx`select app.create_appointment(${c.id}, ${v.id}, ${at}, 60, ${a.service}, null)`;
        });
      }
    }
    console.log("✓ dados de demonstração criados. Usuários: ana, joao, carlos, dono — senha Injecar2026");

    async function tx_prices(orderId: string) {
      await as("ana", (tx) => tx`
        update service_items set
          part_unit_price_cents = case title when 'Troca de pastilhas dianteiras' then 18000 when 'Troca do fluido de freio' then 4500 else 0 end,
          labor_price_cents = case title when 'Troca de pastilhas dianteiras' then 12000 when 'Troca do fluido de freio' then 6000 else 9000 end
         where service_order_id = ${orderId}`);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("demo-data.ts")) {
  seedDemo().catch((e) => {
    console.error("✗", e.message ?? e);
    process.exit(1);
  });
}
