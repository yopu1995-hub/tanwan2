import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Calendar } from "lucide-react";
import { useMemo } from "react";
import { useStore, productUnitCost, type MarketEvent } from "@/lib/store";

export const Route = createFileRoute("/compare")({
  head: () => ({ meta: [{ title: "对比 — 摊玩" }] }),
  component: ComparePage,
});

interface EventStat {
  ev: MarketEvent;
  net: number;
  qty: number;
  orders: number;
  cost: number;
  profit: number;
  avg: number;
}

function r2(n: number) { return Math.round(n * 100) / 100; }

function statsFor(ev: MarketEvent): EventStat {
  const productMap = new Map(ev.products.map((p) => [p.id, p]));
  const gross = ev.sales.reduce((s, x) => s + x.price * x.qty, 0);
  const discount = ev.sales.reduce((s, x) => s + x.discount, 0);
  const net = gross - discount;
  const qty = ev.sales.reduce((s, x) => s + x.qty, 0);
  const cost = ev.sales.reduce((s, x) => {
    const p = productMap.get(x.productId);
    return s + (p ? productUnitCost(p) * x.qty : 0);
  }, 0);
  const orderIds = new Set(ev.sales.map((s) => s.orderId));
  const orders = orderIds.size;
  return { ev, net: r2(net), qty, orders, cost: r2(cost), profit: r2(net - cost), avg: r2(orders > 0 ? net / orders : 0) };
}

function ComparePage() {
  const { events } = useStore();
  const stats = useMemo(() => events.map(statsFor).sort((a, b) => b.net - a.net), [events]);
  const maxNet = Math.max(1, ...stats.map((s) => s.net));
  const maxQty = Math.max(1, ...stats.map((s) => s.qty));
  const totals = useMemo(() => stats.reduce(
    (acc, s) => ({ net: acc.net + s.net, qty: acc.qty + s.qty, orders: acc.orders + s.orders, profit: acc.profit + s.profit }),
    { net: 0, qty: 0, orders: 0, profit: 0 },
  ), [stats]);

  return (
    <div className="app-shell pb-12">
      <header className="px-5 pt-6 pb-5 bg-gradient-to-b from-accent/60 to-transparent">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground -ml-1 mb-3">
          <ArrowLeft className="size-4" /> 我的集市
        </Link>
        <h1 className="text-2xl font-semibold">集市对比</h1>
        <p className="mt-1 text-xs text-muted-foreground">跨集市的销售与利润对比</p>
      </header>

      <main className="px-5 space-y-4">
        {stats.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
            还没有集市数据
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Card label="总净营收" value={`¥${r2(totals.net)}`} accent />
              <Card label="总净利润" value={`¥${r2(totals.profit)}`} accent />
              <Card label="总订单数" value={totals.orders} />
              <Card label="总售出件数" value={totals.qty} />
            </div>

            <Section title="营收对比">
              <ul className="space-y-3">
                {stats.map((s) => (
                  <li key={s.ev.id}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="truncate font-medium">{s.ev.name}</span>
                      <span className="tabular-nums text-primary font-semibold">¥{s.net}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <Calendar className="size-3" />{s.ev.date || "—"}
                      <span>· {s.orders} 单</span>
                      <span>· 件均 ¥{s.avg}</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(s.net / maxNet) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="售出件数对比">
              <ul className="space-y-2">
                {stats.map((s) => (
                  <li key={s.ev.id}>
                    <div className="flex justify-between text-sm">
                      <span className="truncate">{s.ev.name}</span>
                      <span className="tabular-nums text-muted-foreground">{s.qty} 件</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-foreground/70" style={{ width: `${(s.qty / maxQty) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="利润排行">
              <ul className="space-y-1">
                {[...stats].sort((a, b) => b.profit - a.profit).map((s, i) => (
                  <li key={s.ev.id} className="flex items-center justify-between text-sm py-1.5">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground text-xs w-4 tabular-nums">{i + 1}</span>
                      <span className="truncate">{s.ev.name}</span>
                    </span>
                    <span className={`tabular-nums font-medium ${s.profit >= 0 ? "text-primary" : "text-destructive"}`}>
                      ¥{s.profit}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {children}
    </section>
  );
}
