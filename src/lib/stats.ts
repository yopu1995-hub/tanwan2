import type { MarketEvent } from "@/lib/store";
import { productUnitCost } from "@/lib/store";

export const ALL_EVENTS = "__all__";

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Unique order count across one or more events */
export function countOrders(events: MarketEvent[]): number {
  const ids = new Set<string>();
  for (const ev of events) {
    for (const s of ev.sales) {
      ids.add(`${ev.id}:${s.orderId}`);
    }
  }
  return ids.size;
}

export interface DashboardStats {
  net: number;
  profit: number;
  orders: number;
  qty: number;
}

export function computeDashboard(events: MarketEvent[]): DashboardStats {
  let net = 0;
  let cost = 0;
  let qty = 0;

  for (const ev of events) {
    const productMap = new Map(ev.products.map((p) => [p.id, p]));
    for (const s of ev.sales) {
      net += s.price * s.qty - s.discount;
      qty += s.qty;
      const p = productMap.get(s.productId);
      cost += (p ? productUnitCost(p) : 0) * s.qty;
    }
  }

  return {
    net: r2(net),
    profit: r2(net - cost),
    orders: countOrders(events),
    qty,
  };
}

export interface ProductRankRow {
  key: string;
  name: string;
  categoryName: string;
  qty: number;
  net: number;
}

export function aggregateProductRanks(events: MarketEvent[]): ProductRankRow[] {
  const m = new Map<string, ProductRankRow>();

  for (const ev of events) {
    const catMap = new Map(ev.categories.map((c) => [c.id, c]));
    for (const s of ev.sales) {
      const key = `${ev.id}:${s.productId}`;
      const product = ev.products.find((p) => p.id === s.productId);
      const cat = product ? catMap.get(product.categoryId) : undefined;
      const cur = m.get(key) ?? {
        key,
        name: s.productName,
        categoryName: cat?.name ?? "未分类",
        qty: 0,
        net: 0,
      };
      cur.qty += s.qty;
      cur.net += s.price * s.qty - s.discount;
      m.set(key, cur);
    }
  }

  return Array.from(m.values()).map((row) => ({ ...row, net: r2(row.net) }));
}

export const HEATMAP_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

export function computeHourlyRevenue(events: MarketEvent[]): Map<number, number> {
  const buckets = new Map<number, number>();
  for (const h of HEATMAP_HOURS) buckets.set(h, 0);

  for (const ev of events) {
    for (const s of ev.sales) {
      const h = new Date(s.at).getHours();
      if (h >= 6 && h <= 22) {
        buckets.set(h, (buckets.get(h) ?? 0) + s.price * s.qty - s.discount);
      }
    }
  }

  for (const h of HEATMAP_HOURS) {
    buckets.set(h, r2(buckets.get(h) ?? 0));
  }
  return buckets;
}

export interface ProfitMarginRow {
  key: string;
  name: string;
  cost: number;
  price: number;
  profit: number;
  marginPct: number;
}

export function aggregateProfitMargins(events: MarketEvent[]): ProfitMarginRow[] {
  const rows: ProfitMarginRow[] = [];

  for (const ev of events) {
    for (const p of ev.products) {
      const cost = productUnitCost(p);
      if (cost <= 0) continue;
      const profit = p.price - cost;
      const marginPct = p.price > 0 ? r2((profit / p.price) * 100) : 0;
      rows.push({
        key: `${ev.id}:${p.id}`,
        name: p.name,
        cost: r2(cost),
        price: p.price,
        profit: r2(profit),
        marginPct,
      });
    }
  }

  return rows.sort((a, b) => b.marginPct - a.marginPct);
}

export function hasAnyProductCost(events: MarketEvent[]): boolean {
  return events.some((ev) => ev.products.some((p) => productUnitCost(p) > 0));
}

export function totalSalesCount(events: MarketEvent[]): number {
  return events.reduce((s, ev) => s + ev.sales.length, 0);
}

export function filterEvents(events: MarketEvent[], filterId: string): MarketEvent[] {
  if (filterId === ALL_EVENTS) return events;
  const ev = events.find((e) => e.id === filterId);
  return ev ? [ev] : [];
}
