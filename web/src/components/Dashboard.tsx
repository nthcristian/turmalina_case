import { useEffect, useState } from "react";

type Store = {
  id_loja: string;
  nome_loja: string;
  cidade_uf: string;
  formato: string;
  modelo: string;
  data_abertura: string;
  status: boolean;
};

type Product = {
  name: string;
  quantity_sold: number;
  estimated_sales: string;
};

type Indicator = {
  store_id: string;
  intervention_score: number;
  days_without_opening: number;
  net_sales_per_calendar_day: string;
  net_sales_per_calendar_day_change_pct: string;
  ingredient_margin_pct: string;
  ingredient_margin_change_percentage_points: string;
  net_sales_per_team_hour: string | null;
  net_sales_per_team_hour_change_pct: string | null;
  waste_pct_of_net_sales: string | null;
  average_net_ticket: string | null;
  valid_rating_count: number;
  average_rating: string | null;
  median_wait_time_minutes: number | null;
  top_selling_products: Product[];
};

type DashboardStore = Store & { indicator: Indicator };

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function value(input: string | null): number | null {
  return input === null ? null : Number(input);
}

function signedPercent(input: string | null, suffix = "%") {
  const metric = value(input);
  if (metric === null || Number.isNaN(metric)) return "—";
  return `${metric > 0 ? "+" : ""}${number.format(metric)}${suffix}`;
}

function metricClass(input: string | null, inverse = false) {
  const metric = value(input);
  if (metric === null || metric === 0) return "text-slate-500";
  const positive = inverse ? metric < 0 : metric > 0;
  return positive ? "text-emerald-700" : "text-rose-700";
}

function average(values: Array<number | null>): number | null {
  const available = values.filter((metric): metric is number => metric !== null && !Number.isNaN(metric));
  return available.length ? available.reduce((total, metric) => total + metric, 0) / available.length : null;
}

export default function Dashboard() {
  const [stores, setStores] = useState<DashboardStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);

    try {
      const [storesResponse, indicatorsResponse] = await Promise.all([
        fetch(`${API_URL}/api/stores`),
        fetch(`${API_URL}/api/indicators`),
      ]);
      if (!storesResponse.ok || !indicatorsResponse.ok) {
        throw new Error("A API não respondeu com os dados esperados.");
      }

      const [storeData, indicatorData] = (await Promise.all([
        storesResponse.json(),
        indicatorsResponse.json(),
      ])) as [Store[], Indicator[]];
      const storesById = new Map(storeData.map((store) => [store.id_loja.toUpperCase(), store]));

      setStores(
        indicatorData.flatMap((indicator) => {
          const store = storesById.get(indicator.store_id.toUpperCase());
          return store ? [{ ...store, indicator }] : [];
        }),
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const priorities = stores.slice(0, 2);
  const salesPerDay = stores.reduce((total, store) => total + value(store.indicator.net_sales_per_calendar_day)!, 0);
  const averageMargin = stores.length
    ? stores.reduce((total, store) => total + value(store.indicator.ingredient_margin_pct)!, 0) / stores.length
    : 0;
  const closedDays = stores.reduce((total, store) => total + store.indicator.days_without_opening, 0);
  const averageTicket = average(stores.map((store) => value(store.indicator.average_net_ticket)));
  const averageProductivity = average(stores.map((store) => value(store.indicator.net_sales_per_team_hour)));
  const averageWaste = average(stores.map((store) => value(store.indicator.waste_pct_of_net_sales)));
  const ratedStores = stores.filter((store) => store.indicator.average_rating !== null);
  const averageRating = average(ratedStores.map((store) => value(store.indicator.average_rating)));
  const averageWait = average(stores.map((store) => store.indicator.median_wait_time_minutes));
  const lowSampleStores = stores.filter((store) => store.indicator.valid_rating_count < 10);
  const recentStores = stores.filter((store) => new Date(store.data_abertura) >= new Date("2025-08-30"));

  return (
    <main className="min-h-screen bg-[#f3f0e9] px-4 py-5 text-[#14261f] sm:px-7 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-7 flex flex-col gap-5 border-b border-[#d6d0c4] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#5a7669]">Operações · segunda-feira</p>
            <h1 className="font-serif text-4xl tracking-tight text-[#12362c] sm:text-5xl">Turmalina Café</h1>
            <p className="mt-2 text-sm text-slate-600">Painel de decisão semanal · últimos 28 dias versus período anterior</p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#0c5d4d] bg-[#0c5d4d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#084b3d] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            <span className="text-lg leading-none">↻</span> Atualizar dados
          </button>
        </header>

        <nav className="mb-7 flex gap-2 overflow-x-auto pb-1 text-sm font-semibold text-[#436457]" aria-label="Seções do painel">
          {[
            ["#resumo", "Resumo"],
            ["#prioridades", "Prioridades"],
            ["#operacao", "Operação"],
            ["#cliente", "Cliente"],
            ["#expansao", "Expansão"],
            ["#lojas", "Lojas"],
          ].map(([href, label]) => <a className="whitespace-nowrap rounded-full bg-white px-4 py-2 shadow-sm transition hover:bg-[#dce9e1]" href={href} key={href}>{label}</a>)}
        </nav>

        {loading && <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">Lendo os dados da operação...</div>}

        {error && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
            <p className="font-semibold">Não foi possível carregar o painel</p>
            <p className="mt-1 text-sm text-rose-800">{error} Confirme se a API está em execução em `{API_URL}`.</p>
          </section>
        )}

        {!loading && !error && (
          <>
            <section className="grid gap-4 md:grid-cols-3" id="resumo">
              <SummaryCard label="Vendas líquidas/dia" value={money.format(salesPerDay)} note={`${stores.length} lojas ativas`} />
              <SummaryCard label="Margem após insumos" value={`${number.format(averageMargin)}%`} note="Média simples da rede" />
              <SummaryCard label="Dias sem abertura" value={String(closedDays)} note="No período analisado" highlight={closedDays > 0} />
            </section>

            <section className="mt-8" id="prioridades">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a25]">Capacidade de intervenção</p>
                  <h2 className="mt-1 font-serif text-3xl text-[#173c30]">Duas lojas para olhar agora</h2>
                </div>
                <span className="hidden text-sm text-slate-500 sm:block">Ordenado por escore e menor venda/dia</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {priorities.map((store, index) => <PriorityCard key={store.id_loja} store={store} position={index + 1} />)}
              </div>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-[1.45fr_1fr]" id="operacao">
              <div className="rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(33,54,44,0.08)]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7669]">Margem, equipe e desperdício</p>
                <h2 className="mt-1 font-serif text-3xl text-[#173c30]">Saúde operacional da rede</h2>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <MetricCard label="Ticket médio" value={averageTicket === null ? "—" : money.format(averageTicket)} note="Venda líquida por ticket" />
                  <MetricCard label="Vendas por hora" value={averageProductivity === null ? "—" : money.format(averageProductivity)} note="Hora trabalhada de equipe" />
                  <MetricCard label="Desperdício" value={averageWaste === null ? "—" : `${number.format(averageWaste)}%`} note="Média simples sobre vendas" tone="warm" />
                </div>
                <p className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">A margem exibida considera somente vendas líquidas e insumos. Ela não é lucro e não inclui mão de obra, aluguel ou custos fixos.</p>
              </div>
              <aside className="rounded-2xl bg-[#dce9e1] p-6 text-[#173c30]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#527265]">Leitura da semana</p>
                <h3 className="mt-2 font-serif text-2xl">Onde investigar antes de agir</h3>
                <ul className="mt-5 space-y-3 text-sm leading-relaxed">
                  <li className="border-l-2 border-[#0c5d4d] pl-3">Use vendas/dia para separar queda comercial de efeito de dias sem abertura.</li>
                  <li className="border-l-2 border-[#0c5d4d] pl-3">Leia desperdício e margem juntos antes de mexer em preço ou mix.</li>
                  <li className="border-l-2 border-[#0c5d4d] pl-3">Vendas/hora aponta onde revisar escala, não custo de mão de obra.</li>
                </ul>
              </aside>
            </section>

            <section className="mt-8 grid gap-5 lg:grid-cols-2" id="cliente">
              <article className="rounded-2xl bg-[#fffaf0] p-6 shadow-sm ring-1 ring-[#ead8b8]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a25]">Experiência do cliente</p>
                <h2 className="mt-1 font-serif text-3xl text-[#573a1a]">O que a clientela está sinalizando</h2>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <MetricCard label="Nota média" value={averageRating === null ? "—" : `${number.format(averageRating)} / 5`} note={`${ratedStores.length} lojas com amostra válida`} />
                  <MetricCard label="Espera mediana" value={averageWait === null ? "—" : `${number.format(averageWait)} min`} note="Somente esperas válidas" />
                </div>
                <p className="mt-5 text-xs leading-relaxed text-[#765a38]">A experiência só entra no escore com ao menos 10 avaliações válidas nos últimos 90 dias. Notas e espera são sinais de investigação, não uma medida de toda a clientela.</p>
              </article>
              <article className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7669]">Qualidade da evidência</p>
                <h2 className="mt-1 font-serif text-3xl text-[#173c30]">Limites que aparecem na decisão</h2>
                <div className="mt-5 divide-y divide-slate-100 text-sm">
                  <EvidenceRow label="Lojas sem amostra suficiente de cliente" value={`${lowSampleStores.length} de ${stores.length}`} />
                  <EvidenceRow label="Dias sem abertura registrados" value={`${closedDays} dias`} />
                  <EvidenceRow label="Custo por produto" value="Não usado para ranking" />
                </div>
              </article>
            </section>

            <section className="mt-8 rounded-2xl bg-[#16362c] p-6 text-white shadow-[0_12px_40px_rgba(22,54,44,0.15)]" id="expansao">
              <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cdbb98]">Expansão e prontidão</p>
                  <h2 className="mt-2 font-serif text-3xl">Sinais para discutir antes de abrir</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#d8e6dd]">{recentStores.length} lojas têm menos de 10 meses de operação. Esta página não recomenda expandir ou desacelerar: os dados não contêm investimento, custos fixos, capacidade de gestão, demanda local ou canibalização.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DarkMetric value={`${recentStores.length}`} label="Lojas recentes" />
                  <DarkMetric value={`${stores.filter((store) => store.indicator.intervention_score > 0).length}`} label="Lojas com sinal" />
                  <DarkMetric value={`${number.format(averageMargin)}%`} label="Margem após insumos" />
                  <DarkMetric value={`${closedDays}`} label="Dias sem abertura" />
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-2xl bg-white shadow-[0_12px_40px_rgba(33,54,44,0.08)]" id="lojas">
              <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7669]">Rede completa</p>
                  <h2 className="mt-1 font-serif text-2xl text-[#173c30]">Sinais por loja</h2>
                </div>
                <p className="text-xs text-slate-500">Verde indica melhora; vermelho, piora.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Loja</th>
                      <th className="px-3 py-3 font-semibold">Escore</th>
                      <th className="px-3 py-3 font-semibold">Vendas/dia</th>
                      <th className="px-3 py-3 font-semibold">Variação</th>
                      <th className="px-3 py-3 font-semibold">Margem</th>
                      <th className="px-3 py-3 font-semibold">Desperdício</th>
                      <th className="px-3 py-3 font-semibold">Vendas/hora</th>
                      <th className="px-3 py-3 font-semibold">Ticket</th>
                      <th className="px-3 py-3 font-semibold">Cliente</th>
                      <th className="px-5 py-3 font-semibold">Fechada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stores.map((store) => <StoreRow key={store.id_loja} store={store} />)}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value, note, highlight = false }: { label: string; value: string; note: string; highlight?: boolean }) {
  return <article className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className={`mt-3 text-3xl font-semibold tracking-tight ${highlight ? "text-[#a34b27]" : "text-[#173c30]"}`}>{value}</p><p className="mt-2 text-xs text-slate-500">{note}</p></article>;
}

function MetricCard({ label, value, note, tone = "plain" }: { label: string; value: string; note: string; tone?: "plain" | "warm" }) {
  return <div className={`rounded-xl p-4 ${tone === "warm" ? "bg-[#fff6e4] text-[#714416]" : "bg-[#f5f8f5] text-[#173c30]"}`}><p className="text-xs font-medium opacity-70">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-[11px] leading-tight opacity-70">{note}</p></div>;
}

function EvidenceRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 py-3"><p className="text-slate-600">{label}</p><p className="text-right text-xs font-bold text-[#173c30]">{value}</p></div>;
}

function DarkMetric({ value, label }: { value: string; label: string }) {
  return <div className="rounded-xl bg-white/10 p-3"><p className="text-xl font-semibold text-[#f7e7c7]">{value}</p><p className="mt-1 text-[11px] leading-tight text-[#c9d8ce]">{label}</p></div>;
}

function PriorityCard({ store, position }: { store: DashboardStore; position: number }) {
  const { indicator } = store;
  return (
    <article className="overflow-hidden rounded-2xl border border-[#d8c9af] bg-[#193c31] text-white shadow-[0_14px_30px_rgba(25,60,49,0.18)]">
      <div className="flex items-start justify-between p-6 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cdbb98]">Prioridade {position}</p>
          <h3 className="mt-2 font-serif text-3xl leading-none">{store.nome_loja.replace("Turmalina ", "")}</h3>
          <p className="mt-2 text-sm text-[#d9e4dd]">{store.cidade_uf} · {store.formato}</p>
        </div>
        <div className="rounded-full bg-[#e8b65f] px-3 py-2 text-center text-[#193c31]"><strong className="block text-xl leading-none">{indicator.intervention_score}</strong><span className="text-[10px] font-bold uppercase">de 5</span></div>
      </div>
      <div className="grid grid-cols-3 border-y border-white/15 bg-black/10 px-6 py-4 text-sm">
        <div><p className="text-xs text-[#b8cbbf]">Vendas/dia</p><p className="mt-1 font-semibold">{money.format(value(indicator.net_sales_per_calendar_day) ?? 0)}</p></div>
        <div><p className="text-xs text-[#b8cbbf]">Variação</p><p className={`mt-1 font-semibold ${metricClass(indicator.net_sales_per_calendar_day_change_pct)}`}>{signedPercent(indicator.net_sales_per_calendar_day_change_pct)}</p></div>
        <div><p className="text-xs text-[#b8cbbf]">Margem</p><p className="mt-1 font-semibold">{number.format(value(indicator.ingredient_margin_pct) ?? 0)}%</p></div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-6 py-4 text-sm sm:grid-cols-4">
        <PriorityMetric label="Produtividade" value={indicator.net_sales_per_team_hour ? `${money.format(value(indicator.net_sales_per_team_hour) ?? 0)}/h` : "—"} />
        <PriorityMetric label="Desperdício" value={indicator.waste_pct_of_net_sales ? `${number.format(value(indicator.waste_pct_of_net_sales) ?? 0)}%` : "—"} />
        <PriorityMetric label="Ticket médio" value={indicator.average_net_ticket ? money.format(value(indicator.average_net_ticket) ?? 0) : "—"} />
        <PriorityMetric label="Cliente" value={indicator.average_rating ? `${number.format(value(indicator.average_rating) ?? 0)} / 5` : "Amostra insuf."} />
      </div>
      <div className="p-6 pt-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#cdbb98]">Mais vendidos · mês mais recente</p><div className="mt-3 flex flex-wrap gap-2">{indicator.top_selling_products.slice(0, 3).map((product) => <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-[#edf4ef]" key={product.name}>{product.name} <b className="ml-1 text-[#cdbb98]">{number.format(product.quantity_sold)}</b></span>)}</div></div>
    </article>
  );
}

function PriorityMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-[#b8cbbf]">{label}</p><p className="mt-0.5 font-semibold text-sm">{value}</p></div>;
}

function StoreRow({ store }: { store: DashboardStore }) {
  const { indicator } = store;
  const customer = indicator.average_rating ? `${number.format(value(indicator.average_rating) ?? 0)} / 5` : "Amostra insuficiente";
  return <tr className="transition hover:bg-[#faf9f5]"><td className="px-5 py-4"><p className="font-semibold text-[#173c30]">{store.nome_loja}</p><p className="mt-0.5 text-xs text-slate-500">{store.cidade_uf}</p></td><td className="px-3 py-4"><span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-bold ${indicator.intervention_score ? "bg-[#fae5b8] text-[#845016]" : "bg-slate-100 text-slate-500"}`}>{indicator.intervention_score}</span></td><td className="px-3 py-4 font-medium">{money.format(value(indicator.net_sales_per_calendar_day) ?? 0)}</td><td className={`px-3 py-4 font-medium ${metricClass(indicator.net_sales_per_calendar_day_change_pct)}`}>{signedPercent(indicator.net_sales_per_calendar_day_change_pct)}</td><td className="px-3 py-4">{number.format(value(indicator.ingredient_margin_pct) ?? 0)}%</td><td className="px-3 py-4">{indicator.waste_pct_of_net_sales ? `${number.format(value(indicator.waste_pct_of_net_sales) ?? 0)}%` : "—"}</td><td className="px-3 py-4">{indicator.net_sales_per_team_hour ? `${money.format(value(indicator.net_sales_per_team_hour) ?? 0)}/h` : "—"}</td><td className="px-3 py-4">{indicator.average_net_ticket ? money.format(value(indicator.average_net_ticket) ?? 0) : "—"}</td><td className="px-3 py-4 text-slate-600">{customer}</td><td className="px-5 py-4">{indicator.days_without_opening ? <span className="font-semibold text-[#a34b27]">{indicator.days_without_opening} dia(s)</span> : <span className="text-slate-400">—</span>}</td></tr>;
}
