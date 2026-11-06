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
type Metric = string | number;
type ProductComparison = {
    name: string;
    current_quantity_sold: number;
    previous_quantity_sold: number | null;
    quantity_change_pct: Metric | null;
    current_average_price: Metric;
    previous_average_price: Metric | null;
    price_change_pct: Metric | null;
    current_estimated_sales: Metric;
    previous_estimated_sales: Metric | null;
    estimated_sales_change_pct: Metric | null;
    is_new_in_current_month: boolean;
};
type ProductMissingFromCurrentMonth = {
    name: string;
    previous_quantity_sold: number;
    previous_average_price: Metric;
    previous_estimated_sales: Metric;
};
type StoreProductAnalysis = {
    store_id: string;
    current_reference_month: string;
    previous_reference_month: string;
    top_selling_products: ProductComparison[];
    least_selling_products: ProductComparison[];
    products: ProductComparison[];
    missing_from_current_month: ProductMissingFromCurrentMonth[];
};
type Indicator = {
    store_id: string;
    intervention_score: number;
    score_reasons: string[];
    days_without_opening: number;
    net_sales_per_calendar_day: Metric;
    net_sales_per_calendar_day_change_pct: Metric;
    ingredient_margin_pct: Metric;
    ingredient_margin_change_percentage_points: Metric;
    net_sales_per_team_hour: Metric | null;
    net_sales_per_team_hour_change_pct: Metric | null;
    waste_pct_of_net_sales: Metric | null;
    average_net_ticket: Metric | null;
    valid_rating_count: number;
    average_rating: Metric | null;
    median_wait_time_minutes: number | null;
    current_period_discounts_amount: Metric;
    discounts_total?: Metric;
    discounts_pct_of_gross_sales?: Metric;
    discounts_change_pct?: Metric;
    discounts_change_percentage_points?: Metric;
    [key: `discounts_${string}`]: Metric | null | undefined;
};
type DashboardStore = Store & { indicator: Indicator };
type DataQuality = {
    duplicate_daily_sales: number;
    invalid_ratings: number;
    implausible_wait_times: number;
    missing_unit_costs: number;
};
type DailySalesPoint = { date: string; net_sales: Metric };
type DashboardMetadata = {
    current_period_start?: string;
    current_period_end?: string;
    previous_period_start?: string;
    previous_period_end?: string;
    latest_data_date?: string;
    data_date?: string;
    period_start?: string;
    period_end?: string;
    comparison_period_start?: string;
    comparison_period_end?: string;
};
type Tab = "overview" | "stores" | "products" | "margin" | "team" | "expansion";

const API_URL = import.meta.env.PUBLIC_API_URL ?? "http://127.0.0.1:3000";
const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
});
const fallbackPeriod = {
    currentStart: "2026-06-03",
    currentEnd: "2026-06-30",
    previousStart: "2026-05-06",
    previousEnd: "2026-06-02",
    dataDate: "2026-06-30",
};
const tabs: Array<[Tab, string]> = [
    ["overview", "Visão geral"],
    ["stores", "Lojas"],
    ["products", "Produtos"],
    ["margin", "Margem e desperdício"],
    ["team", "Equipe e cliente"],
    ["expansion", "Expansão e qualidade"],
];

function value(input: Metric | null | undefined) {
    const parsed = Number(input);
    return input === null || input === undefined || Number.isNaN(parsed)
        ? null
        : parsed;
}
function average(values: Array<number | null>) {
    const valid = values.filter((item): item is number => item !== null);
    return valid.length
        ? valid.reduce((sum, item) => sum + item, 0) / valid.length
        : null;
}
function percent(input: Metric | null, suffix = "%") {
    const metric = value(input);
    return metric === null
        ? "—"
        : `${metric > 0 ? "+" : ""}${number.format(metric)}${suffix}`;
}
function metricClass(input: Metric | null, inverse = false) {
    const metric = value(input);
    return metric === null || metric === 0
        ? "text-slate-500"
        : (inverse ? metric < 0 : metric > 0)
          ? "text-emerald-700"
          : "text-rose-700";
}

function formatDate(input: string) {
    return date.format(new Date(`${input}T00:00:00`));
}
function getMetadata(input: unknown): DashboardMetadata | null {
    if (!input || typeof input !== "object") return null;
    const data = input as Record<string, unknown>;
    const current = data.current_period as Record<string, unknown> | undefined;
    const previous = data.previous_period as
        Record<string, unknown> | undefined;
    const string = (item: unknown) =>
        typeof item === "string" && item ? item : undefined;
    return {
        current_period_start: string(
            data.current_period_start ?? data.period_start ?? current?.start,
        ),
        current_period_end: string(
            data.current_period_end ?? data.period_end ?? current?.end,
        ),
        previous_period_start: string(
            data.previous_period_start ??
                data.comparison_period_start ??
                previous?.start,
        ),
        previous_period_end: string(
            data.previous_period_end ??
                data.comparison_period_end ??
                previous?.end,
        ),
        latest_data_date: string(data.latest_data_date ?? data.data_as_of),
        data_date: string(data.data_date),
    };
}
function isRecentStore(openingDate: string, dataDate: string) {
    const cutoff = new Date(`${dataDate}T00:00:00`);
    cutoff.setMonth(cutoff.getMonth() - 10);
    return new Date(`${openingDate}T00:00:00`) > cutoff;
}
const reasonLabels: Record<string, string> = {
    sales_per_day_decline: "Queda material em vendas/dia",
    ingredient_margin_decline: "Queda material na margem após insumos",
    sales_per_team_hour_decline: "Queda material em vendas por hora",
    high_waste_vs_network: "Desperdício no pior quartil da rede madura",
    poor_customer_experience_vs_network:
        "Experiência de cliente no pior quartil da rede madura",
};

function reasons(indicator: Indicator) {
    return indicator.score_reasons.map(
        (reason) => reasonLabels[reason] ?? reason,
    );
}

export default function Dashboard() {
    const [stores, setStores] = useState<DashboardStore[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [quality, setQuality] = useState<DataQuality | null>(null);
    const [metadata, setMetadata] = useState<DashboardMetadata | null>(null);
    const [salesSeries, setSalesSeries] = useState<DailySalesPoint[]>([]);
    const [productAnalysis, setProductAnalysis] =
        useState<StoreProductAnalysis | null>(null);
    const [tab, setTab] = useState<Tab>("overview");
    const [format, setFormat] = useState("all");
    const [model, setModel] = useState("all");
    const [selectedId, setSelectedId] = useState("");
    async function loadDashboard() {
        setLoading(true);
        setError(null);
        try {
            const [
                storesResponse,
                indicatorsResponse,
                qualityResponse,
                metadataResponse,
            ] = await Promise.all([
                fetch(`${API_URL}/api/stores`),
                fetch(`${API_URL}/api/indicators`),
                fetch(`${API_URL}/api/data-quality`),
                fetch(`${API_URL}/api/metadata`).catch(() => null),
            ]);
            if (
                !storesResponse.ok ||
                !indicatorsResponse.ok ||
                !qualityResponse.ok
            )
                throw new Error("A API não respondeu com os dados esperados.");
            const [storeData, indicatorData, qualityData] = (await Promise.all([
                storesResponse.json(),
                indicatorsResponse.json(),
                qualityResponse.json(),
            ])) as [Store[], Indicator[], DataQuality];
            const metadataData = metadataResponse?.ok
                ? getMetadata(await metadataResponse.json())
                : null;
            const byId = new Map(
                storeData.map((store) => [store.id_loja.toUpperCase(), store]),
            );
            const joined = indicatorData.flatMap((indicator) => {
                const store = byId.get(indicator.store_id.toUpperCase());
                return store ? [{ ...store, indicator }] : [];
            });
            setStores(joined);
            setQuality(qualityData);
            setMetadata(metadataData);
            setSelectedId((current) => current || joined[0]?.id_loja || "");
        } catch (requestError) {
            setError(
                requestError instanceof Error
                    ? requestError.message
                    : "Não foi possível carregar o painel.",
            );
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void loadDashboard();
    }, []);
    const priorities = stores
        .filter((store) => store.indicator.intervention_score > 0)
        .slice(0, 2);
    const filtered = stores.filter(
        (store) =>
            (format === "all" || store.formato === format) &&
            (model === "all" || store.modelo === model),
    );
    const selected =
        filtered.find((store) => store.id_loja === selectedId) ?? filtered[0];
    useEffect(() => {
        if (!selected) {
            setSalesSeries([]);
            return;
        }
        void fetch(
            `${API_URL}/api/stores/${encodeURIComponent(selected.id_loja)}/sales`,
        )
            .then((response) => (response.ok ? response.json() : []))
            .then((points: DailySalesPoint[]) => setSalesSeries(points))
            .catch(() => setSalesSeries([]));
    }, [selected]);
    useEffect(() => {
        if (!selected) {
            setProductAnalysis(null);
            return;
        }
        void fetch(
            `${API_URL}/api/stores/${encodeURIComponent(selected.id_loja)}/products`,
        )
            .then((response) => (response.ok ? response.json() : null))
            .then((analysis: StoreProductAnalysis | null) =>
                setProductAnalysis(analysis),
            )
            .catch(() => setProductAnalysis(null));
    }, [selected]);
    const salesPerDay = stores.reduce(
        (total, store) =>
            total + (value(store.indicator.net_sales_per_calendar_day) ?? 0),
        0,
    );
    const margin = average(
        stores.map((store) => value(store.indicator.ingredient_margin_pct)),
    );
    const waste = average(
        stores.map((store) => value(store.indicator.waste_pct_of_net_sales)),
    );
    const productivity = average(
        stores.map((store) => value(store.indicator.net_sales_per_team_hour)),
    );
    const currentPeriodDiscounts = stores.reduce(
        (total, store) =>
            total +
            (value(store.indicator.current_period_discounts_amount) ?? 0),
        0,
    );
    const rating = average(
        stores.map((store) => value(store.indicator.average_rating)),
    );
    const closedDays = stores.reduce(
        (total, store) => total + store.indicator.days_without_opening,
        0,
    );
    const lowSample = stores.filter(
        (store) => store.indicator.valid_rating_count < 10,
    ).length;
    const period = {
        currentStart:
            metadata?.current_period_start ??
            salesSeries.at(-28)?.date ??
            fallbackPeriod.currentStart,
        currentEnd:
            metadata?.current_period_end ??
            salesSeries.at(-1)?.date ??
            fallbackPeriod.currentEnd,
        previousStart:
            metadata?.previous_period_start ??
            salesSeries[0]?.date ??
            fallbackPeriod.previousStart,
        previousEnd:
            metadata?.previous_period_end ??
            salesSeries.at(-29)?.date ??
            fallbackPeriod.previousEnd,
        dataDate:
            metadata?.latest_data_date ??
            metadata?.data_date ??
            salesSeries.at(-1)?.date ??
            fallbackPeriod.dataDate,
    };
    const recent = stores.filter((store) =>
        isRecentStore(store.data_abertura, period.dataDate),
    ).length;
    return (
        <main className="min-h-screen bg-[#f3f0e9] px-4 py-5 text-[#14261f] sm:px-7 lg:px-10">
            <div className="mx-auto max-w-7xl">
                <header className="mb-6 flex flex-col gap-4 border-b border-[#d6d0c4] pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#5a7669]">
                            Operações · segunda-feira
                        </p>
                        <h1 className="font-serif text-4xl tracking-tight text-[#12362c] sm:text-5xl">
                            Turmalina Café
                        </h1>
                        <p className="mt-2 text-sm text-slate-600">
                            Período: {formatDate(period.currentStart)} a{" "}
                            {formatDate(period.currentEnd)} versus{" "}
                            {formatDate(period.previousStart)} a{" "}
                            {formatDate(period.previousEnd)} · dados até{" "}
                            {formatDate(period.dataDate)}
                        </p>
                    </div>
                    <button
                        className="rounded-full bg-[#0c5d4d] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#084b3d] disabled:opacity-60"
                        onClick={() => void loadDashboard()}
                        disabled={loading}
                    >
                        Atualizar dados
                    </button>
                </header>
                <nav
                    className="mb-7 flex gap-2 overflow-x-auto pb-2"
                    aria-label="Seções do painel"
                    role="tablist"
                >
                    {tabs.map(([id, label]) => (
                        <button
                            key={id}
                            role="tab"
                            aria-selected={tab === id}
                            aria-controls={`${id}-panel`}
                            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${tab === id ? "bg-[#173c30] text-white" : "bg-white text-[#436457] shadow-sm hover:bg-[#dce9e1]"}`}
                            onClick={() => setTab(id)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>
                <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {loading
                        ? "Carregando dados da operação"
                        : error
                          ? `Erro: ${error}`
                          : "Dados da operação atualizados"}
                </div>
                {loading && (
                    <div
                        role="status"
                        className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm"
                    >
                        Lendo os dados da operação...
                    </div>
                )}
                {error && (
                    <section
                        role="alert"
                        className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950"
                    >
                        <p className="font-semibold">
                            Não foi possível carregar o painel
                        </p>
                        <p className="mt-1 text-sm text-rose-800">
                            {error} Confirme se a API está em execução em `
                            {API_URL}`.
                        </p>
                    </section>
                )}
                {!loading && !error && (
                    <>
                        {tab === "overview" && (
                            <section id="overview-panel" role="tabpanel">
                                <div className="grid gap-4 md:grid-cols-3">
                                    <Card
                                        label="Vendas líquidas/dia"
                                        value={money.format(salesPerDay)}
                                        note={`${stores.length} lojas ativas`}
                                    />
                                    <Card
                                        label="Margem após insumos"
                                        value={
                                            margin === null
                                                ? "—"
                                                : `${number.format(margin)}%`
                                        }
                                        note="Média simples da rede"
                                    />
                                    <Card
                                        label="Dias sem abertura"
                                        value={String(closedDays)}
                                        note="No período analisado"
                                    />
                                </div>
                                <section className="mt-8">
                                    <Heading
                                        eyebrow="Capacidade de intervenção"
                                        title="Lojas para olhar agora"
                                        note="Até duas, apenas quando há sinal material."
                                    />
                                    <div className="grid gap-4 lg:grid-cols-2">
                                        {priorities.map((store, index) => (
                                            <PriorityCard
                                                key={store.id_loja}
                                                store={store}
                                                position={index + 1}
                                            />
                                        ))}
                                        {priorities.length === 0 && (
                                            <Empty text="Nenhuma loja atingiu escore positivo nesta janela." />
                                        )}
                                    </div>
                                </section>
                                <section className="mt-8 grid gap-5 lg:grid-cols-2">
                                    <Quality
                                        stores={stores.length}
                                        lowSample={lowSample}
                                        closedDays={closedDays}
                                        quality={quality}
                                    />
                                    <article className="rounded-2xl bg-[#dce9e1] p-6">
                                        <Heading
                                            eyebrow="Leitura da semana"
                                            title="Antes de agir"
                                        />
                                        <p className="mt-4 text-sm leading-relaxed text-[#35564a]">
                                            O escore aponta investigação, não
                                            causa. Leia dias fechados, vendas,
                                            margem e desperdício juntos antes de
                                            alterar preço, escala ou mix.
                                        </p>
                                    </article>
                                </section>
                            </section>
                        )}
                        {tab === "stores" && (
                            <section id="stores-panel" role="tabpanel">
                                <Heading
                                    eyebrow="Rede completa"
                                    title="Comparar, filtrar e investigar"
                                />
                                <div className="mt-5 flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
                                    <Filter
                                        label="Formato"
                                        value={format}
                                        onChange={setFormat}
                                        options={[
                                            ...new Set(
                                                stores.map(
                                                    (store) => store.formato,
                                                ),
                                            ),
                                        ]}
                                    />
                                    <Filter
                                        label="Modelo"
                                        value={model}
                                        onChange={setModel}
                                        options={[
                                            ...new Set(
                                                stores.map(
                                                    (store) => store.modelo,
                                                ),
                                            ),
                                        ]}
                                    />
                                </div>
                                <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                                    <StoreMatrix
                                        stores={filtered}
                                        selectedId={selected?.id_loja}
                                        onSelect={setSelectedId}
                                    />
                                    <StoreDetail
                                        store={selected}
                                        sales={salesSeries}
                                    />
                                </div>
                                <StoreTable stores={filtered} />
                            </section>
                        )}
                        {tab === "products" && (
                            <section id="products-panel" role="tabpanel">
                                <Heading
                                    eyebrow="Giro e preço"
                                    title="Produtos por loja"
                                    note="A competência mais recente é comparada à anterior. Quantidade define os rankings; preço é apresentado sem julgamento de positivo ou negativo."
                                />
                                <div className="mt-5 flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-sm">
                                    <Filter
                                        label="Formato"
                                        value={format}
                                        onChange={setFormat}
                                        options={[
                                            ...new Set(
                                                stores.map(
                                                    (store) => store.formato,
                                                ),
                                            ),
                                        ]}
                                    />
                                    <Filter
                                        label="Modelo"
                                        value={model}
                                        onChange={setModel}
                                        options={[
                                            ...new Set(
                                                stores.map(
                                                    (store) => store.modelo,
                                                ),
                                            ),
                                        ]}
                                    />
                                    <StoreSelector
                                        stores={filtered}
                                        value={selected?.id_loja ?? ""}
                                        onChange={setSelectedId}
                                    />
                                </div>
                                <ProductAnalysisView
                                    analysis={productAnalysis}
                                    store={selected}
                                />
                            </section>
                        )}
                        {tab === "margin" && (
                            <section id="margin-panel" role="tabpanel">
                                <Heading
                                    eyebrow="Rentabilidade operacional"
                                    title="Margem e desperdício"
                                    note="Margem após insumos não é lucro: não inclui mão de obra, aluguel, impostos ou custos fixos."
                                />
                                <div className="mt-5 grid gap-4 md:grid-cols-4">
                                    <Card
                                        label="Margem média"
                                        value={
                                            margin === null
                                                ? "—"
                                                : `${number.format(margin)}%`
                                        }
                                        note="Após insumos"
                                    />
                                    <Card
                                        label="Desperdício médio"
                                        value={
                                            waste === null
                                                ? "—"
                                                : `${number.format(waste)}%`
                                        }
                                        note="Sobre vendas líquidas"
                                    />
                                    <Card
                                        label="Descontos concedidos"
                                        value={money.format(
                                            currentPeriodDiscounts,
                                        )}
                                        note="Total na janela atual de 28 dias"
                                    />
                                    <Card
                                        label="Dias sem abertura"
                                        value={String(closedDays)}
                                        note="Vendas zero na janela"
                                    />
                                </div>
                                <StoreTable stores={stores} columns="margin" />
                            </section>
                        )}
                        {tab === "team" && (
                            <section id="team-panel" role="tabpanel">
                                <Heading
                                    eyebrow="Capacidade e experiência"
                                    title="Equipe e cliente"
                                />
                                <div className="mt-5 grid gap-4 md:grid-cols-3">
                                    <Card
                                        label="Vendas por hora"
                                        value={
                                            productivity === null
                                                ? "—"
                                                : `${money.format(productivity)}/h`
                                        }
                                        note="Média simples"
                                    />
                                    <Card
                                        label="Nota média"
                                        value={
                                            rating === null
                                                ? "—"
                                                : `${number.format(rating)} / 5`
                                        }
                                        note={`${stores.length - lowSample} lojas com amostra válida`}
                                    />
                                    <Card
                                        label="Amostra insuficiente"
                                        value={`${lowSample} lojas`}
                                        note="Menos de 10 avaliações válidas"
                                    />
                                </div>
                                <StoreTable stores={stores} columns="team" />
                            </section>
                        )}
                        {tab === "expansion" && (
                            <section id="expansion-panel" role="tabpanel">
                                <Heading
                                    eyebrow="Prontidão, não recomendação"
                                    title="Expansão e qualidade dos dados"
                                    note="Os dados não permitem recomendar expandir ou desacelerar sem investimento, custos fixos, demanda local, canibalização e capacidade de gestão."
                                />
                                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                                    <article className="rounded-2xl bg-[#16362c] p-6 text-white">
                                        <h3 className="font-serif text-2xl">
                                            Checklist visível
                                        </h3>
                                        <ul className="mt-5 space-y-3 text-sm text-[#d8e6dd]">
                                            <li>
                                                {recent} lojas recentes:
                                                comparar com cautela.
                                            </li>
                                            <li>
                                                {closedDays} dias sem abertura:
                                                ausência de venda foi tratada
                                                como zero.
                                            </li>
                                            <li>
                                                Margem considera somente
                                                insumos, não lucro.
                                            </li>
                                            <li>
                                                Não há dados de investimento,
                                                mercado ou canibalização.
                                            </li>
                                        </ul>
                                    </article>
                                    <Quality
                                        stores={stores.length}
                                        lowSample={lowSample}
                                        closedDays={closedDays}
                                        quality={quality}
                                    />
                                    <RecentStoreEvolution
                                        stores={stores.filter((store) =>
                                            isRecentStore(
                                                store.data_abertura,
                                                period.dataDate,
                                            ),
                                        )}
                                    />
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function Heading({
    eyebrow,
    title,
    note,
}: {
    eyebrow: string;
    title: string;
    note?: string;
}) {
    return (
        <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5a7669]">
                {eyebrow}
            </p>
            <h2 className="mt-1 font-serif text-3xl text-[#173c30]">{title}</h2>
            {note && (
                <p className="mt-2 max-w-3xl text-sm text-slate-600">{note}</p>
            )}
        </div>
    );
}
function Card({
    label,
    value,
    note,
}: {
    label: string;
    value: string;
    note: string;
}) {
    return (
        <article className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#173c30]">
                {value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{note}</p>
        </article>
    );
}
function Empty({ text }: { text: string }) {
    return (
        <p className="rounded-2xl border border-dashed border-[#b9c9bf] bg-white/60 p-6 text-sm text-[#436457]">
            {text}
        </p>
    );
}
function Filter({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
}) {
    return (
        <label className="text-sm font-medium text-[#35564a]">
            {label}
            <select
                className="ml-2 rounded-lg border border-[#cbd8d0] bg-white px-3 py-2 text-[#173c30]"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="all">Todos</option>
                {options.map((option) => (
                    <option key={option}>{option}</option>
                ))}
            </select>
        </label>
    );
}
function StoreSelector({
    stores,
    value: selectedStoreId,
    onChange,
}: {
    stores: DashboardStore[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="text-sm font-medium text-[#35564a]">
            Loja
            <select
                className="ml-2 rounded-lg border border-[#cbd8d0] bg-white px-3 py-2 text-[#173c30]"
                value={selectedStoreId}
                onChange={(event) => onChange(event.target.value)}
            >
                {stores.map((store) => (
                    <option key={store.id_loja} value={store.id_loja}>
                        {store.nome_loja}
                    </option>
                ))}
            </select>
        </label>
    );
}
function ProductAnalysisView({
    analysis,
    store,
}: {
    analysis: StoreProductAnalysis | null;
    store?: DashboardStore;
}) {
    if (!store)
        return <Empty text="Nenhuma loja atende aos filtros selecionados." />;
    if (!analysis)
        return <Empty text="Carregando a análise mensal de produtos..." />;

    return (
        <div className="mt-5 space-y-5">
            <p className="text-sm text-slate-600">
                {store.nome_loja} ·{" "}
                {formatDate(analysis.current_reference_month)} versus{" "}
                {formatDate(analysis.previous_reference_month)}
            </p>
            <div className="grid gap-5 lg:grid-cols-2">
                <ProductRanking
                    title="Cinco mais vendidos"
                    note="Maior quantidade na competência atual"
                    products={analysis.top_selling_products}
                />
                <ProductRanking
                    title="Cinco menos vendidos"
                    note="Menor quantidade entre produtos registrados na competência atual"
                    products={analysis.least_selling_products}
                />
            </div>
            <ProductTable products={analysis.products} />
            <article className="rounded-2xl bg-[#fffaf0] p-5 ring-1 ring-[#ead8b8]">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a25]">
                    Produtos sem registro na competência atual
                </p>
                {analysis.missing_from_current_month.length === 0 ? (
                    <p className="mt-3 text-sm text-[#765a38]">
                        Nenhum produto da competência anterior ficou sem
                        registro.
                    </p>
                ) : (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {analysis.missing_from_current_month.map((product) => (
                            <li
                                className="rounded-xl bg-white/70 p-3 text-sm text-[#573a1a]"
                                key={product.name}
                            >
                                <b>{product.name}</b>
                                <span className="mt-1 block text-xs">
                                    {number.format(
                                        product.previous_quantity_sold,
                                    )}{" "}
                                    unidades ·{" "}
                                    {money.format(
                                        value(
                                            product.previous_estimated_sales,
                                        ) ?? 0,
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-4 text-xs text-[#765a38]">
                    Ausência não é venda zero, descontinuação ou
                    indisponibilidade.
                </p>
            </article>
        </div>
    );
}
function ProductRanking({
    title,
    note,
    products,
}: {
    title: string;
    note: string;
    products: ProductComparison[];
}) {
    return (
        <article className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-serif text-2xl text-[#173c30]">{title}</h3>
            <p className="mt-1 text-xs text-slate-500">{note}</p>
            <ol className="mt-4 space-y-2">
                {products.map((product, index) => (
                    <li
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f8f5] p-3"
                        key={product.name}
                    >
                        <div className="min-w-0">
                            <span className="mr-2 text-xs font-bold text-[#5a7669]">
                                {index + 1}
                            </span>
                            <b className="text-sm text-[#173c30]">
                                {product.name}
                            </b>
                            <ProductStatus product={product} />
                        </div>
                        <div className="text-right">
                            <b className="block text-sm text-[#173c30]">
                                {number.format(product.current_quantity_sold)}
                            </b>
                            <span
                                className={`text-xs ${metricClass(product.quantity_change_pct)}`}
                            >
                                {percent(product.quantity_change_pct)}
                            </span>
                        </div>
                    </li>
                ))}
            </ol>
        </article>
    );
}
function ProductStatus({ product }: { product: ProductComparison }) {
    return product.is_new_in_current_month ? (
        <span className="ml-2 rounded-full bg-[#e8b65f] px-2 py-0.5 text-[10px] font-bold uppercase text-[#573a1a]">
            Novo
        </span>
    ) : null;
}
function ProductTable({ products }: { products: ProductComparison[] }) {
    return (
        <section className="rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-serif text-2xl text-[#173c30]">
                    Todos os produtos registrados
                </h3>
                <p className="text-xs text-slate-500">
                    Preço médio tem leitura neutra; quantidade e valor estimado
                    mostram variação contra a competência anterior.
                </p>
            </div>
            <div
                className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0c5d4d]"
                tabIndex={0}
                role="region"
                aria-label="Tabela de comparação de produtos"
            >
                <table className="w-full min-w-245 text-left text-sm">
                    <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Produto</th>
                            <th className="px-3 py-3">Quantidade</th>
                            <th className="px-3 py-3">Δ quantidade</th>
                            <th className="px-3 py-3">Preço médio</th>
                            <th className="px-3 py-3">Δ preço</th>
                            <th className="px-5 py-3">Valor estimado</th>
                            <th className="px-5 py-3">Δ valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map((product) => (
                            <tr
                                className="hover:bg-[#faf9f5]"
                                key={product.name}
                            >
                                <td className="px-5 py-4 font-semibold text-[#173c30]">
                                    {product.name}
                                    <ProductStatus product={product} />
                                </td>
                                <td className="px-3 py-4">
                                    {number.format(
                                        product.current_quantity_sold,
                                    )}
                                </td>
                                <td
                                    className={`px-3 py-4 font-medium ${metricClass(product.quantity_change_pct)}`}
                                >
                                    {product.is_new_in_current_month
                                        ? "Novo na competência"
                                        : percent(product.quantity_change_pct)}
                                </td>
                                <td className="px-3 py-4">
                                    {money.format(
                                        value(product.current_average_price) ??
                                            0,
                                    )}
                                </td>
                                <td className="px-3 py-4 text-slate-600">
                                    {product.is_new_in_current_month
                                        ? "Novo na competência"
                                        : percent(product.price_change_pct)}
                                </td>
                                <td className="px-5 py-4">
                                    {money.format(
                                        value(
                                            product.current_estimated_sales,
                                        ) ?? 0,
                                    )}
                                </td>
                                <td
                                    className={`px-5 py-4 font-medium ${metricClass(product.estimated_sales_change_pct)}`}
                                >
                                    {product.is_new_in_current_month
                                        ? "Novo na competência"
                                        : percent(
                                              product.estimated_sales_change_pct,
                                          )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
function Quality({
    stores,
    lowSample,
    closedDays,
    quality,
}: {
    stores: number;
    lowSample: number;
    closedDays: number;
    quality: DataQuality | null;
}) {
    return (
        <article className="rounded-2xl bg-white p-6 shadow-sm">
            <Heading
                eyebrow="Qualidade da evidência"
                title="Limites que entram na decisão"
            />
            <dl className="mt-5 divide-y divide-slate-100 text-sm">
                <Data
                    label="Cliente com amostra insuficiente"
                    value={`${lowSample} de ${stores} lojas`}
                />
                <Data
                    label="Dias sem abertura registrados"
                    value={`${closedDays} dias`}
                />
                <Data
                    label="Duplicatas de venda detectadas"
                    value={
                        quality
                            ? `${quality.duplicate_daily_sales} linha(s); primeira ocorrência mantida`
                            : "—"
                    }
                />
                <Data
                    label="Esperas implausíveis excluídas"
                    value={
                        quality
                            ? `${quality.implausible_wait_times} registros`
                            : "—"
                    }
                />
                <Data
                    label="Notas inválidas excluídas"
                    value={
                        quality ? `${quality.invalid_ratings} registros` : "—"
                    }
                />
                <Data
                    label="Custos unitários ausentes"
                    value={
                        quality ? `${quality.missing_unit_costs} linhas` : "—"
                    }
                />
            </dl>
        </article>
    );
}
function RecentStoreEvolution({ stores }: { stores: DashboardStore[] }) {
    return (
        <article className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <Heading
                eyebrow="Lojas recentes"
                title="Evolução operacional disponível"
                note="Variação do período atual contra os 28 dias anteriores; interpretar sem comparação com a rede madura."
            />
            {stores.length ? (
                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-150 text-left text-sm">
                        <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="pb-3 pr-4">Loja</th>
                                <th className="px-3 pb-3">Abertura</th>
                                <th className="px-3 pb-3">Vendas/dia</th>
                                <th className="px-3 pb-3">Δ margem</th>
                                <th className="px-3 pb-3">Δ vendas/hora</th>
                                <th className="px-3 pb-3">Dias fechada</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {stores.map((store) => {
                                const i = store.indicator;
                                return (
                                    <tr key={store.id_loja}>
                                        <td className="py-3 pr-4 font-semibold text-[#173c30]">
                                            {store.nome_loja}
                                        </td>
                                        <td className="px-3 py-3">
                                            {formatDate(store.data_abertura)}
                                        </td>
                                        <td
                                            className={`px-3 py-3 font-medium ${metricClass(i.net_sales_per_calendar_day_change_pct)}`}
                                        >
                                            {percent(
                                                i.net_sales_per_calendar_day_change_pct,
                                            )}
                                        </td>
                                        <td
                                            className={`px-3 py-3 font-medium ${metricClass(i.ingredient_margin_change_percentage_points)}`}
                                        >
                                            {percent(
                                                i.ingredient_margin_change_percentage_points,
                                                " pp",
                                            )}
                                        </td>
                                        <td
                                            className={`px-3 py-3 font-medium ${metricClass(i.net_sales_per_team_hour_change_pct)}`}
                                        >
                                            {percent(
                                                i.net_sales_per_team_hour_change_pct,
                                            )}
                                        </td>
                                        <td className="px-3 py-3">
                                            {i.days_without_opening}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="mt-5 text-sm text-slate-500">
                    Não há lojas com menos de 10 meses de operação nesta data.
                </p>
            )}
        </article>
    );
}
function Data({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-4 py-3">
            <dt className="text-slate-600">{label}</dt>
            <dd className="text-right text-xs font-bold text-[#173c30]">
                {value}
            </dd>
        </div>
    );
}
function PriorityCard({
    store,
    position,
}: {
    store: DashboardStore;
    position: number;
}) {
    const { indicator } = store;
    return (
        <article className="overflow-hidden rounded-2xl border border-[#d8c9af] bg-[#193c31] text-white shadow-[0_14px_30px_rgba(25,60,49,0.18)]">
            <div className="flex justify-between p-6">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#cdbb98]">
                        Prioridade {position}
                    </p>
                    <h3 className="mt-2 font-serif text-3xl">
                        {store.nome_loja.replace("Turmalina ", "")}
                    </h3>
                    <p className="mt-1 text-sm text-[#d9e4dd]">
                        {store.cidade_uf} · {store.formato}
                    </p>
                </div>
                <div className="h-fit rounded-full bg-[#e8b65f] px-3 py-2 text-center text-[#193c31]">
                    <b className="block text-xl">
                        {indicator.intervention_score}
                    </b>
                    <span className="text-[10px] font-bold uppercase">
                        de 5
                    </span>
                </div>
            </div>
            <div className="border-y border-white/15 bg-black/10 px-6 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#cdbb98]">
                    Por que cada ponto
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                    {reasons(indicator).map((reason, index) => (
                        <li
                            key={`${index}-${reason}`}
                            className="rounded-full bg-white/10 px-3 py-1 text-xs"
                        >
                            {index + 1}. {reason}
                        </li>
                    ))}
                </ul>
            </div>
        </article>
    );
}
function StoreMatrix({
    stores,
    selectedId,
    onSelect,
}: {
    stores: DashboardStore[];
    selectedId?: string;
    onSelect: (id: string) => void;
}) {
    return (
        <article className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-[#173c30]">
                Matriz: vendas/dia × variação
            </p>
            <p className="mt-1 text-xs text-slate-500">
                Selecione uma loja para ver o detalhe. A cor marca o escore.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stores.map((store) => (
                    <button
                        key={store.id_loja}
                        onClick={() => onSelect(store.id_loja)}
                        className={`rounded-xl border p-3 text-left transition ${selectedId === store.id_loja ? "border-[#0c5d4d] bg-[#dce9e1]" : "border-slate-100 hover:border-[#8aaf9e]"}`}
                    >
                        <span className="flex justify-between text-xs text-slate-500">
                            <span>{store.formato}</span>
                            <b>{store.indicator.intervention_score}/5</b>
                        </span>
                        <strong className="mt-3 block text-sm text-[#173c30]">
                            {store.nome_loja.replace("Turmalina ", "")}
                        </strong>
                        <span
                            className={`mt-1 block text-xs ${metricClass(store.indicator.net_sales_per_calendar_day_change_pct)}`}
                        >
                            {percent(
                                store.indicator
                                    .net_sales_per_calendar_day_change_pct,
                            )}
                        </span>
                    </button>
                ))}
            </div>
        </article>
    );
}
function StoreDetail({
    store,
    sales,
}: {
    store?: DashboardStore;
    sales: DailySalesPoint[];
}) {
    if (!store)
        return <Empty text="Nenhuma loja atende aos filtros selecionados." />;
    const i = store.indicator;
    return (
        <article className="rounded-2xl bg-[#fffaf0] p-6 ring-1 ring-[#ead8b8]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a5a25]">
                Loja selecionada
            </p>
            <h3 className="mt-1 font-serif text-2xl text-[#573a1a]">
                {store.nome_loja}
            </h3>
            <p className="text-sm text-[#765a38]">
                {store.cidade_uf} · {store.formato} · {store.modelo}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-3">
                <Data
                    label="Vendas/dia"
                    value={money.format(
                        value(i.net_sales_per_calendar_day) ?? 0,
                    )}
                />
                <Data
                    label="Margem"
                    value={`${number.format(value(i.ingredient_margin_pct) ?? 0)}%`}
                />
                <Data
                    label="Variação de margem"
                    value={percent(
                        i.ingredient_margin_change_percentage_points,
                        " pp",
                    )}
                />
                <Data
                    label="Desperdício"
                    value={
                        i.waste_pct_of_net_sales
                            ? `${number.format(value(i.waste_pct_of_net_sales) ?? 0)}%`
                            : "—"
                    }
                />
                <Data
                    label="Fechada"
                    value={`${i.days_without_opening} dias`}
                />
                <Data
                    label="Ticket médio"
                    value={
                        i.average_net_ticket
                            ? money.format(value(i.average_net_ticket) ?? 0)
                            : "—"
                    }
                />
                <Data
                    label="Vendas por hora"
                    value={
                        i.net_sales_per_team_hour
                            ? `${money.format(value(i.net_sales_per_team_hour) ?? 0)}/h`
                            : "—"
                    }
                />
                <Data
                    label="Variação vendas/h"
                    value={percent(i.net_sales_per_team_hour_change_pct)}
                />
                <Data
                    label="Espera mediana"
                    value={
                        i.median_wait_time_minutes === null
                            ? "—"
                            : `${i.median_wait_time_minutes} min`
                    }
                />
                <Data
                    label="Nota média"
                    value={
                        i.average_rating
                            ? `${number.format(value(i.average_rating) ?? 0)}/5`
                            : "—"
                    }
                />
                <Data
                    label="Amostra de avaliações"
                    value={`${i.valid_rating_count} válidas`}
                />
            </dl>
            <p className="mt-4 text-xs font-semibold text-[#765a38]">
                Sinais: {reasons(i).join(" · ") || "Sem sinal material"}
            </p>
            <DailySalesStrip points={sales} />
        </article>
    );
}

function DailySalesStrip({ points }: { points: DailySalesPoint[] }) {
    const recent = points.slice(-28);
    const highest = Math.max(
        ...recent.map((point) => value(point.net_sales) ?? 0),
        1,
    );
    return (
        <div className="mt-5 border-t border-[#ead8b8] pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#8a5a25]">
                Série diária de vendas líquidas · 28 dias
            </p>
            <div
                className="mt-3 flex h-20 items-end gap-1"
                aria-label="Série diária de vendas líquidas"
            >
                {recent.map((point) => {
                    const netSales = value(point.net_sales) ?? 0;
                    return (
                        <div
                            className="group relative h-full min-w-0 flex-1"
                            key={point.date}
                        >
                            <div
                                className="w-full rounded-t bg-[#b47a37] transition group-hover:bg-[#80501d]"
                                style={{
                                    height: `${(netSales / highest) * 100}%`,
                                }}
                            />
                            <span className="sr-only">
                                {point.date}: {money.format(netSales)}
                            </span>
                        </div>
                    );
                })}
            </div>
            <p className="mt-2 text-[11px] text-[#765a38]">
                Cada barra representa um dia; ausência de venda não forma barra.
            </p>
        </div>
    );
}
function StoreTable({
    stores,
    columns = "all",
}: {
    stores: DashboardStore[];
    columns?: "all" | "margin" | "team";
}) {
    const showMargin = columns !== "team";
    const showTeam = columns !== "margin";
    return (
        <section className="mt-5 rounded-2xl bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-serif text-2xl text-[#173c30]">
                    Comparação por loja
                </h3>
                <p className="text-xs text-slate-500">
                    Use a rolagem horizontal para acessar todas as métricas.
                </p>
            </div>
            <div
                className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#0c5d4d]"
                tabIndex={0}
                role="region"
                aria-label="Tabela comparativa de lojas"
            >
                <table className="w-full min-w-250 text-left text-sm">
                    <thead className="bg-[#f8f7f3] text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-5 py-3">Loja</th>
                            <th className="px-3 py-3">Escore</th>
                            <th className="px-3 py-3">Vendas/dia</th>
                            <th className="px-3 py-3">Variação</th>
                            <th className="px-3 py-3">Ticket médio</th>
                            {showMargin && (
                                <>
                                    <th className="px-3 py-3">Margem</th>
                                    <th className="px-3 py-3">Δ margem</th>
                                    <th className="px-3 py-3">Descontos</th>
                                    <th className="px-3 py-3">Desperdício</th>
                                </>
                            )}
                            {showTeam && (
                                <>
                                    <th className="px-3 py-3">Vendas/hora</th>
                                    <th className="px-3 py-3">Δ vendas/hora</th>
                                    <th className="px-3 py-3">
                                        Cliente / amostra
                                    </th>
                                    <th className="px-3 py-3">
                                        Espera mediana
                                    </th>
                                </>
                            )}
                            <th className="px-5 py-3">Fechada</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stores.map((store) => {
                            const i = store.indicator;
                            return (
                                <tr
                                    key={store.id_loja}
                                    className="hover:bg-[#faf9f5]"
                                >
                                    <td className="px-5 py-4">
                                        <b className="text-[#173c30]">
                                            {store.nome_loja}
                                        </b>
                                        <span className="block text-xs text-slate-500">
                                            {store.cidade_uf}
                                        </span>
                                    </td>
                                    <td className="px-3 py-4 font-bold">
                                        {i.intervention_score}
                                    </td>
                                    <td className="px-3 py-4">
                                        {money.format(
                                            value(
                                                i.net_sales_per_calendar_day,
                                            ) ?? 0,
                                        )}
                                    </td>
                                    <td
                                        className={`px-3 py-4 font-medium ${metricClass(i.net_sales_per_calendar_day_change_pct)}`}
                                    >
                                        {percent(
                                            i.net_sales_per_calendar_day_change_pct,
                                        )}
                                    </td>
                                    <td className="px-3 py-4">
                                        {i.average_net_ticket
                                            ? money.format(
                                                  value(i.average_net_ticket) ??
                                                      0,
                                              )
                                            : "—"}
                                    </td>
                                    {showMargin && (
                                        <>
                                            <td className="px-3 py-4">
                                                {number.format(
                                                    value(
                                                        i.ingredient_margin_pct,
                                                    ) ?? 0,
                                                )}
                                                %
                                            </td>
                                            <td
                                                className={`px-3 py-4 font-medium ${metricClass(i.ingredient_margin_change_percentage_points)}`}
                                            >
                                                {percent(
                                                    i.ingredient_margin_change_percentage_points,
                                                    " pp",
                                                )}
                                            </td>
                                            <td className="px-3 py-4">
                                                {money.format(
                                                    value(
                                                        i.current_period_discounts_amount,
                                                    ) ?? 0,
                                                )}
                                            </td>
                                            <td className="px-3 py-4">
                                                {i.waste_pct_of_net_sales
                                                    ? `${number.format(value(i.waste_pct_of_net_sales) ?? 0)}%`
                                                    : "—"}
                                            </td>
                                        </>
                                    )}
                                    {showTeam && (
                                        <>
                                            <td className="px-3 py-4">
                                                {i.net_sales_per_team_hour
                                                    ? `${money.format(value(i.net_sales_per_team_hour) ?? 0)}/h`
                                                    : "—"}
                                            </td>
                                            <td
                                                className={`px-3 py-4 font-medium ${metricClass(i.net_sales_per_team_hour_change_pct)}`}
                                            >
                                                {percent(
                                                    i.net_sales_per_team_hour_change_pct,
                                                )}
                                            </td>
                                            <td className="px-3 py-4">
                                                {i.average_rating
                                                    ? `${number.format(value(i.average_rating) ?? 0)}/5 · n=${i.valid_rating_count}`
                                                    : `n=${i.valid_rating_count}`}
                                            </td>
                                            <td className="px-3 py-4">
                                                {i.median_wait_time_minutes ===
                                                null
                                                    ? "—"
                                                    : `${i.median_wait_time_minutes} min`}
                                            </td>
                                        </>
                                    )}
                                    <td className="px-5 py-4">
                                        {i.days_without_opening || "—"}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
