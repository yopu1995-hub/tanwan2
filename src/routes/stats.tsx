import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarChart3, Palette } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  ALL_EVENTS,
  aggregateProductRanks,
  aggregateProfitMargins,
  computeDashboard,
  computeHourlyRevenue,
  filterEvents,
  hasAnyProductCost,
  HEATMAP_HOURS,
  totalSalesCount,
  type ProductRankRow,
} from "@/lib/stats";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/stats")({
  head: () => ({ meta: [{ title: "统计 — 摊玩" }] }),
  component: StatsPage,
});

type RankSort = "revenue" | "qty";

function StatsPage() {
  const events = useStore().events ?? [];
  const [filterId, setFilterId] = useState(ALL_EVENTS);
  const [rankSort, setRankSort] = useState<RankSort>("revenue");

  const filtered = useMemo(() => filterEvents(events, filterId), [events, filterId]);

  const dashboard = useMemo(() => computeDashboard(filtered), [filtered]);
  const productRanks = useMemo(() => aggregateProductRanks(filtered), [filtered]);
  const hourly = useMemo(() => computeHourlyRevenue(filtered), [filtered]);
  const profitRows = useMemo(() => aggregateProfitMargins(filtered), [filtered]);
  const anyCost = useMemo(() => hasAnyProductCost(filtered), [filtered]);
  const hasSales = totalSalesCount(filtered) > 0;

  const topProducts = useMemo(() => {
    const sorted = [...productRanks].sort((a, b) =>
      rankSort === "revenue" ? b.net - a.net : b.qty - a.qty,
    );
    return sorted.slice(0, 10);
  }, [productRanks, rankSort]);

  const rankMax = useMemo(() => {
    if (topProducts.length === 0) return 1;
    return Math.max(
      1,
      ...topProducts.map((p) => (rankSort === "revenue" ? p.net : p.qty)),
    );
  }, [topProducts, rankSort]);

  const hourMax = useMemo(() => {
    return Math.max(1, ...HEATMAP_HOURS.map((h) => hourly.get(h) ?? 0));
  }, [hourly]);

  return (
    <div className="app-shell pb-20">
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-primary">
          <BarChart3 className="size-4" />
          <span className="text-xs tracking-wide">数据总览</span>
        </div>
        <h1 className="mt-1 text-base font-medium text-foreground">销售统计</h1>
        <p className="mt-1 text-sm text-muted-foreground">查看营收、排行与时段分布</p>
      </header>

      <main className="px-4 space-y-4">
        {events.length > 0 && (
          <Select value={filterId} onValueChange={setFilterId}>
            <SelectTrigger className="w-full h-10 rounded-lg border border-[#E6EBE5] bg-white shadow-none">
              <SelectValue placeholder="选择集市" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EVENTS}>全部集市</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!hasSales ? (
          <EmptySales />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="净营收" value={`¥${dashboard.net}`} />
              <MetricCard label="净利润" value={`¥${dashboard.profit}`} />
              <MetricCard label="订单数" value={`${dashboard.orders} 单`} />
              <MetricCard label="售出件数" value={`${dashboard.qty} 件`} />
            </div>

            <Section
              title="商品排行"
              action={
                <RankToggle sort={rankSort} onChange={setRankSort} />
              }
            >
              {topProducts.length === 0 ? (
                <p className="text-sm text-[#8B9D8E] text-center py-4">暂无商品销售数据</p>
              ) : (
                <ul className="space-y-3">
                  {topProducts.map((row, i) => (
                    <ProductRankItem
                      key={row.key}
                      row={row}
                      rank={i + 1}
                      barPct={
                        ((rankSort === "revenue" ? row.net : row.qty) / rankMax) * 100
                      }
                      sort={rankSort}
                    />
                  ))}
                </ul>
              )}
            </Section>

            <Section title="时段分布">
              <div className="flex items-end gap-0.5 h-32">
                {HEATMAP_HOURS.map((h) => {
                  const value = hourly.get(h) ?? 0;
                  const hasData = value > 0;
                  const heightPct = hasData ? (value / hourMax) * 100 : 0;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center gap-1 min-w-0 h-full justify-end">
                      <div
                        className={cn(
                          "w-full rounded-t min-h-[2px] transition-all",
                          hasData ? "bg-[#4A7C59]" : "bg-[#EDF3EE]",
                        )}
                        style={{ height: hasData ? `max(2px, ${heightPct}%)` : "2px" }}
                        title={hasData ? `¥${value}` : undefined}
                      />
                      <span className="text-[9px] text-[#8B9D8E] tabular-nums">{h}</span>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title="单品利润率">
              {!anyCost ? (
                <p className="text-sm text-[#8B9D8E] text-center py-6">
                  填写商品成本后查看利润率分析
                </p>
              ) : profitRows.length === 0 ? (
                <p className="text-sm text-[#8B9D8E] text-center py-6">暂无商品数据</p>
              ) : (
                <ul className="space-y-2">
                  {profitRows.map((row) => (
                    <li
                      key={row.key}
                      className="rounded-lg border border-[#E6EBE5] bg-[#F7F9F6] px-3 py-2 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-[#2C3E30] truncate">{row.name}</span>
                        <span className={cn("font-mono text-xs font-medium tabular-nums shrink-0", marginColor(row.marginPct))}>
                          {row.marginPct}%
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#8B9D8E] font-mono tabular-nums">
                        <span>成本 ¥{row.cost}</span>
                        <span>售价 ¥{row.price}</span>
                        <span className={marginColor(row.marginPct)}>利润 ¥{row.profit}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function marginColor(pct: number): string {
  if (pct < 0) return "text-red-600";
  if (pct >= 30) return "text-[#4A7C59]";
  return "text-[#8B9D8E]";
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white border border-[#E6EBE5] rounded-xl p-3 shadow-sm">
      <div className="text-xs text-[#8B9D8E]">{label}</div>
      <div className="mt-0.5 text-lg font-mono tabular-nums text-[#4A7C59] font-medium">{value}</div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-[#E6EBE5] rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-medium text-[#2C3E30]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RankToggle({ sort, onChange }: { sort: RankSort; onChange: (s: RankSort) => void }) {
  return (
    <div className="flex rounded-lg border border-[#E6EBE5] overflow-hidden text-[10px]">
      <button
        type="button"
        onClick={() => onChange("qty")}
        className={cn(
          "px-2 py-1 transition-colors",
          sort === "qty" ? "bg-[#4A7C59] text-white" : "bg-white text-[#8B9D8E]",
        )}
      >
        按销量
      </button>
      <button
        type="button"
        onClick={() => onChange("revenue")}
        className={cn(
          "px-2 py-1 transition-colors",
          sort === "revenue" ? "bg-[#4A7C59] text-white" : "bg-white text-[#8B9D8E]",
        )}
      >
        按营收
      </button>
    </div>
  );
}

function ProductRankItem({
  row,
  rank,
  barPct,
  sort,
}: {
  row: ProductRankRow;
  rank: number;
  barPct: number;
  sort: RankSort;
}) {
  const isFirst = rank === 1;
  return (
    <li>
      <div className="flex items-center justify-between gap-2 text-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={cn("text-xs w-4 tabular-nums shrink-0", isFirst ? "text-[#4A7C59] font-medium" : "text-[#8B9D8E]")}>
            {rank}
          </span>
          <div className="min-w-0">
            <div className={cn("truncate font-medium", isFirst ? "text-[#4A7C59]" : "text-[#2C3E30]")}>
              {row.name}
            </div>
            <span className="text-[10px] text-[#8B9D8E] border border-[#E6EBE5] rounded px-1.5 py-0.5 inline-block mt-0.5">
              {row.categoryName}
            </span>
          </div>
        </div>
        <div className="text-right text-xs font-mono tabular-nums shrink-0 text-[#8B9D8E]">
          <div>
            销量 {row.qty}
            {sort === "revenue" && <span className="ml-1.5 text-[#4A7C59]">¥{row.net}</span>}
          </div>
          {sort === "qty" && <div className="text-[#4A7C59]">¥{row.net}</div>}
        </div>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-[#EDF3EE] overflow-hidden">
        <div className="h-full bg-[#4A7C59] rounded-full" style={{ width: `${barPct}%` }} />
      </div>
    </li>
  );
}

function EmptySales() {
  return (
    <div className="border border-dashed border-[#E6EBE5] rounded-xl py-12 text-center bg-white">
      <Palette className="size-10 mx-auto text-[#8B9D8E]" strokeWidth={1.5} />
      <p className="mt-3 text-sm font-medium text-[#2C3E30]">还没有销售数据</p>
      <p className="mt-1 text-xs text-[#8B9D8E]">出摊后这里会自动汇总</p>
    </div>
  );
}
