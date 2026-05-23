import { useSyncExternalStore } from "react";

/** Legacy enum kept for migration only. */
export type ProductCategory = "print" | "craft";
export type PaymentMethod = "cash" | "wechat" | "alipay" | "other";

export interface Category {
  id: string;
  name: string;
  emoji?: string;
  /** data URL for SVG / uploaded icon image. Takes precedence over emoji. */
  iconImage?: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  /** 出摊库存（catalog 中恒为 0；event.products 中为本次活动携带量） */
  stock: number;
  /** 总备货量（家中库存，以 catalog 为准） */
  totalStock: number;
  categoryId: string;
  emoji?: string;
  images?: string[];
  /** per-unit material cost */
  materialCost?: number;
  /** per-unit labor cost */
  laborCost?: number;
  /** per-unit other cost */
  otherCost?: number;
}

export interface SaleRecord {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  price: number;
  qty: number;
  at: number;
  paymentMethod: PaymentMethod;
  discount: number;
  note?: string;
  /** optional checkout photo (data URL) */
  photo?: string;
}

export interface MarketEvent {
  id: string;
  name: string;
  location: string;
  date: string;
  createdAt: number;
  categories: Category[];
  products: Product[];
  sales: SaleRecord[];
  /** 是否已收摊退回剩余库存 */
  returned: boolean;
  /** 旧数据已迁移到全局商品池 */
  migrated?: boolean;
}

interface State {
  events: MarketEvent[];
  catalog: Product[];
}

const KEY_V1 = "huatan_store_v1";
const KEY = "huatan_store_v2";

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "print", name: "版画", emoji: "🖼️" },
  { id: "craft", name: "文创", emoji: "✨" },
];

function normalizeProduct(p: Record<string, unknown>, fallbackCategoryId?: string): Product {
  const categoryId =
    (p.categoryId as string) ??
    (p.category === "print" || p.category === "craft" ? (p.category as string) : fallbackCategoryId) ??
    DEFAULT_CATEGORIES[0]!.id;
  const stock = Number(p.stock) || 0;
  const totalStock = p.totalStock != null ? Number(p.totalStock) || 0 : stock;
  return {
    id: p.id as string,
    name: p.name as string,
    price: Number(p.price) || 0,
    stock,
    totalStock,
    categoryId,
    emoji: p.emoji as string | undefined,
    images: (p.images as string[] | undefined) ?? [],
    materialCost: Number(p.materialCost) || 0,
    laborCost: Number(p.laborCost) || 0,
    otherCost: Number(p.otherCost) || 0,
  };
}

function catalogEntryFromProduct(p: Product): Product {
  return { ...p, stock: 0, totalStock: p.totalStock };
}

function eventCopyFromCatalog(cat: Product, eventStock: number): Product {
  return { ...cat, stock: eventStock, totalStock: 0 };
}

function migrateCatalog(state: State): State {
  const catalog = state.catalog ?? [];

  if (catalog.length > 0) {
    return {
      catalog: catalog.map((p) =>
        catalogEntryFromProduct(normalizeProduct(p as unknown as Record<string, unknown>)),
      ),
      events: (state.events ?? []).map((e) => ({
        ...e,
        returned: e.returned ?? false,
        products: (e.products ?? []).map((p) =>
          normalizeProduct(p as unknown as Record<string, unknown>, e.categories?.[0]?.id),
        ),
      })),
    };
  }

  if (!state.events?.length) {
    return { events: [], catalog: [] };
  }

  const catalogMap = new Map<string, Product>();

  for (const ev of state.events) {
    const fallbackCat = ev.categories?.[0]?.id;
    for (const raw of ev.products ?? []) {
      const p = normalizeProduct(raw as unknown as Record<string, unknown>, fallbackCat);
      const existing = catalogMap.get(p.id);
      if (existing) {
        existing.totalStock += p.stock;
      } else {
        catalogMap.set(p.id, { ...p, stock: 0, totalStock: p.stock });
      }
    }
  }

  return {
    catalog: Array.from(catalogMap.values()),
    events: state.events.map((e) => ({
      ...e,
      returned: e.returned ?? false,
      migrated: true,
      products: (e.products ?? []).map((p) =>
        normalizeProduct(p as unknown as Record<string, unknown>, e.categories?.[0]?.id),
      ),
    })),
  };
}

function migrateEvents(parsed: { events?: MarketEvent[] }): State {
  const events = (parsed.events ?? []).map((e: MarketEvent & { products?: unknown[]; sales?: unknown[] }) => {
    if (!Array.isArray(e.categories) || e.categories.length === 0) {
      e.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    }
    e.products = (e.products ?? []).map((p) =>
      normalizeProduct(p as Record<string, unknown>, e.categories[0]?.id),
    );
    e.sales = (e.sales ?? []).map((s: Record<string, unknown>) => ({
      orderId: (s.orderId as string) ?? (s.id as string),
      paymentMethod: (s.paymentMethod as PaymentMethod) ?? "cash",
      discount: (s.discount as number) ?? 0,
      note: s.note as string | undefined,
      ...s,
    })) as SaleRecord[];
    e.returned = e.returned ?? false;
    return e;
  });
  return migrateCatalog({ events, catalog: (parsed as State).catalog ?? [] });
}

function load(): State {
  if (typeof localStorage === "undefined") return { events: [], catalog: [] };
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = localStorage.getItem(KEY_V1);
    }
    if (!raw) return { events: [], catalog: [] };
    const parsed = JSON.parse(raw) as State & { events?: MarketEvent[] };
    return migrateEvents(parsed);
  } catch {
    return { events: [], catalog: [] };
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Persist failed (likely localStorage quota)", e);
    }
  }
  listeners.forEach((l) => l());
}

function setState(updater: (s: State) => State) {
  state = updater(state);
  persist();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

const emptyState: State = { events: [], catalog: [] };

export function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, () => emptyState);
}

export function getCatalogProduct(productId: string): Product | undefined {
  return state.catalog.find((p) => p.id === productId);
}

/** 合并全局商品信息与活动出摊库存，用于展示与收银 */
export function mergeEventProduct(eventProduct: Product, catalog = state.catalog): Product {
  const cat = catalog.find((c) => c.id === eventProduct.id);
  if (!cat) return eventProduct;
  return { ...cat, ...eventProduct, stock: eventProduct.stock, totalStock: cat.totalStock };
}

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: "现金",
  wechat: "微信",
  alipay: "支付宝",
  other: "其他",
};
export const PAYMENT_EMOJI: Record<PaymentMethod, string> = {
  cash: "💴",
  wechat: "💚",
  alipay: "🅰️",
  other: "💳",
};

export const actions = {
  createEvent(input: { name: string; location: string; date: string }): MarketEvent {
    const ev: MarketEvent = {
      id: crypto.randomUUID(),
      name: input.name,
      location: input.location,
      date: input.date,
      createdAt: Date.now(),
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      products: [],
      sales: [],
      returned: false,
    };
    setState((s) => ({ ...s, events: [ev, ...s.events] }));
    return ev;
  },
  deleteEvent(id: string) {
    setState((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }));
  },
  addCategory(eventId: string, input: { name: string; emoji?: string; iconImage?: string }): Category {
    const cat: Category = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      emoji: input.emoji?.trim() || undefined,
      iconImage: input.iconImage,
    };
    setState((s) => ({
      ...s,
      events: s.events.map((e) => (e.id === eventId ? { ...e, categories: [...e.categories, cat] } : e)),
    }));
    return cat;
  },
  updateCategory(eventId: string, categoryId: string, patch: Partial<Category>) {
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId
          ? { ...e, categories: e.categories.map((c) => (c.id === categoryId ? { ...c, ...patch } : c)) }
          : e,
      ),
    }));
  },
  deleteCategory(eventId: string, categoryId: string) {
    setState((s) => {
      const ev = s.events.find((e) => e.id === eventId);
      if (!ev || ev.categories.length <= 1) return s;
      const fallback = ev.categories.find((c) => c.id !== categoryId)!;
      return {
        ...s,
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          return {
            ...e,
            categories: e.categories.filter((c) => c.id !== categoryId),
            products: e.products.map((p) =>
              p.categoryId === categoryId ? { ...p, categoryId: fallback.id } : p,
            ),
          };
        }),
        catalog: s.catalog.map((p) =>
          p.categoryId === categoryId ? { ...p, categoryId: fallback.id } : p,
        ),
      };
    });
  },
  addToCatalog(p: Omit<Product, "id">): Product {
    const item: Product = catalogEntryFromProduct({
      ...p,
      id: crypto.randomUUID(),
      stock: 0,
      totalStock: p.totalStock ?? 0,
    });
    setState((s) => ({ ...s, catalog: [...s.catalog, item] }));
    return item;
  },
  updateCatalogItem(id: string, patch: Partial<Product>) {
    const { stock: _s, ...rest } = patch;
    setState((s) => ({
      ...s,
      catalog: s.catalog.map((p) => (p.id === id ? catalogEntryFromProduct({ ...p, ...rest }) : p)),
      events: s.events.map((e) => ({
        ...e,
        products: e.products.map((p) => (p.id === id ? { ...p, ...rest, stock: p.stock, totalStock: 0 } : p)),
      })),
    }));
  },
  deleteCatalogItem(id: string) {
    setState((s) => ({
      ...s,
      catalog: s.catalog.filter((p) => p.id !== id),
      events: s.events.map((e) => ({
        ...e,
        products: e.products.filter((p) => p.id !== id),
        sales: e.sales.filter((s) => s.productId !== id),
      })),
    }));
  },
  stockToEvent(eventId: string, productId: string, qty: number): boolean {
    if (qty <= 0) return false;
    const cat = state.catalog.find((p) => p.id === productId);
    if (!cat || cat.totalStock < qty) return false;

    setState((s) => ({
      catalog: s.catalog.map((p) =>
        p.id === productId ? { ...p, totalStock: p.totalStock - qty } : p,
      ),
      events: s.events.map((e) => {
        if (e.id !== eventId) return e;
        if (e.returned) return e;
        const existing = e.products.find((p) => p.id === productId);
        if (existing) {
          return {
            ...e,
            products: e.products.map((p) =>
              p.id === productId ? { ...p, stock: p.stock + qty } : p,
            ),
          };
        }
        return {
          ...e,
          products: [...e.products, eventCopyFromCatalog(cat, qty)],
        };
      }),
    }));
    return true;
  },
  returnFromEvent(eventId: string, productId: string, qty?: number): boolean {
    const ev = state.events.find((e) => e.id === eventId);
    const ep = ev?.products.find((p) => p.id === productId);
    if (!ev || !ep) return false;
    const returnQty = qty ?? ep.stock;
    if (returnQty <= 0) return true;
    if (returnQty > ep.stock) return false;

    setState((s) => ({
      catalog: s.catalog.map((p) =>
        p.id === productId ? { ...p, totalStock: p.totalStock + returnQty } : p,
      ),
      events: s.events.map((e) => {
        if (e.id !== eventId) return e;
        const nextStock = ep.stock - returnQty;
        return {
          ...e,
          products:
            nextStock <= 0
              ? e.products.filter((p) => p.id !== productId)
              : e.products.map((p) => (p.id === productId ? { ...p, stock: nextStock } : p)),
        };
      }),
    }));
    return true;
  },
  markEventReturned(eventId: string): boolean {
    const ev = state.events.find((e) => e.id === eventId);
    if (!ev || ev.returned) return false;

    const returns = new Map<string, number>();
    for (const p of ev.products) {
      if (p.stock > 0) returns.set(p.id, p.stock);
    }

    setState((s) => ({
      catalog: s.catalog.map((p) => {
        const qty = returns.get(p.id);
        return qty ? { ...p, totalStock: p.totalStock + qty } : p;
      }),
      events: s.events.map((e) => {
        if (e.id !== eventId) return e;
        return {
          ...e,
          returned: true,
          products: e.products
            .map((p) => {
              const qty = returns.get(p.id);
              return qty ? { ...p, stock: p.stock - qty } : p;
            })
            .filter((p) => p.stock > 0),
        };
      }),
    }));
    return true;
  },
  /** @deprecated 请使用 addToCatalog + stockToEvent */
  addProduct(eventId: string, p: Omit<Product, "id">) {
    const item = actions.addToCatalog({
      ...p,
      stock: 0,
      totalStock: (p.totalStock ?? 0) + (p.stock ?? 0),
    });
    if (p.stock > 0) {
      actions.stockToEvent(eventId, item.id, p.stock);
    }
  },
  updateProduct(eventId: string, productId: string, patch: Partial<Product>) {
    const { stock, totalStock, ...meta } = patch;
    if (Object.keys(meta).length > 0) {
      actions.updateCatalogItem(productId, { ...meta, ...(totalStock != null ? { totalStock } : {}) });
    } else if (totalStock != null) {
      actions.updateCatalogItem(productId, { totalStock });
    }
    if (stock != null) {
      setState((s) => ({
        ...s,
        events: s.events.map((e) =>
          e.id === eventId
            ? {
                ...e,
                products: e.products.map((p) => (p.id === productId ? { ...p, stock } : p)),
              }
            : e,
        ),
      }));
    }
  },
  deleteProduct(eventId: string, productId: string) {
    actions.returnFromEvent(eventId, productId);
    setState((s) => ({
      ...s,
      events: s.events.map((e) =>
        e.id === eventId ? { ...e, products: e.products.filter((p) => p.id !== productId) } : e,
      ),
    }));
  },
  recordOrder(
    eventId: string,
    items: { productId: string; qty: number }[],
    opts: { paymentMethod: PaymentMethod; discount?: number; note?: string; photo?: string },
  ): string | null {
    const orderId = crypto.randomUUID();
    const at = Date.now();
    const discount = Math.max(0, opts.discount ?? 0);
    let ok = true;

    setState((s) => {
      const ev = s.events.find((e) => e.id === eventId);
      if (!ev || ev.returned) {
        ok = false;
        return s;
      }

      for (const it of items) {
        const p = ev.products.find((x) => x.id === it.productId);
        const cat = s.catalog.find((c) => c.id === it.productId);
        if (!p || p.stock < it.qty || !cat || cat.totalStock < it.qty) {
          ok = false;
          return s;
        }
      }

      const gross = items.reduce((sum, it) => {
        const p = ev.products.find((x) => x.id === it.productId)!;
        return sum + p.price * it.qty;
      }, 0);
      const effDiscount = Math.min(discount, gross);

      const sales: SaleRecord[] = items.map((it, idx) => {
        const p = ev.products.find((x) => x.id === it.productId)!;
        const lineGross = p.price * it.qty;
        let lineDiscount = gross > 0 ? Math.round((lineGross / gross) * effDiscount * 100) / 100 : 0;
        if (idx === items.length - 1) {
          const allocated = items.slice(0, -1).reduce((sum, j) => {
            const pp = ev.products.find((x) => x.id === j.productId)!;
            const lg = pp.price * j.qty;
            return sum + (gross > 0 ? Math.round((lg / gross) * effDiscount * 100) / 100 : 0);
          }, 0);
          lineDiscount = Math.round((effDiscount - allocated) * 100) / 100;
        }
        return {
          id: crypto.randomUUID(),
          orderId,
          productId: it.productId,
          productName: p.name,
          price: p.price,
          qty: it.qty,
          at,
          paymentMethod: opts.paymentMethod,
          discount: lineDiscount,
          note: opts.note?.trim() || undefined,
          photo: opts.photo,
        };
      });

      const soldByProduct = new Map<string, number>();
      for (const it of items) {
        soldByProduct.set(it.productId, (soldByProduct.get(it.productId) ?? 0) + it.qty);
      }

      return {
        ...s,
        catalog: s.catalog.map((p) => {
          const sold = soldByProduct.get(p.id);
          return sold ? { ...p, totalStock: p.totalStock - sold } : p;
        }),
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          return {
            ...e,
            products: e.products.map((p) => {
              const sold = soldByProduct.get(p.id);
              return sold ? { ...p, stock: p.stock - sold } : p;
            }),
            sales: [...sales, ...e.sales],
          };
        }),
      };
    });

    return ok ? orderId : null;
  },
  undoOrder(eventId: string, orderId: string) {
    setState((s) => ({
      ...s,
      events: s.events.map((e) => {
        if (e.id !== eventId) return e;
        const lines = e.sales.filter((x) => x.orderId === orderId);
        if (lines.length === 0) return e;
        const restock = new Map<string, number>();
        for (const l of lines) {
          restock.set(l.productId, (restock.get(l.productId) ?? 0) + l.qty);
        }
        return {
          ...e,
          sales: e.sales.filter((x) => x.orderId !== orderId),
          products: e.products.map((p) => {
            const qty = restock.get(p.id);
            return qty ? { ...p, stock: p.stock + qty } : p;
          }),
        };
      }),
      catalog: s.catalog.map((p) => {
        const lines = s.events
          .find((e) => e.id === eventId)
          ?.sales.filter((x) => x.orderId === orderId);
        const qty = lines?.filter((l) => l.productId === p.id).reduce((sum, l) => sum + l.qty, 0) ?? 0;
        return qty ? { ...p, totalStock: p.totalStock + qty } : p;
      }),
    }));
  },
  undoSale(eventId: string, saleId: string) {
    setState((s) => {
      const ev = s.events.find((e) => e.id === eventId);
      const sale = ev?.sales.find((x) => x.id === saleId);
      if (!ev || !sale) return s;
      return {
        ...s,
        events: s.events.map((e) => {
          if (e.id !== eventId) return e;
          return {
            ...e,
            sales: e.sales.filter((x) => x.id !== saleId),
            products: e.products.map((p) =>
              p.id === sale.productId ? { ...p, stock: p.stock + sale.qty } : p,
            ),
          };
        }),
        catalog: s.catalog.map((p) =>
          p.id === sale.productId ? { ...p, totalStock: p.totalStock + sale.qty } : p,
        ),
      };
    });
  },
};

export function getEvent(id: string): MarketEvent | undefined {
  return state.events.find((e) => e.id === id);
}

export function productUnitCost(p: Product): number {
  return (p.materialCost ?? 0) + (p.laborCost ?? 0) + (p.otherCost ?? 0);
}

/** Net sales for an event (gross minus per-line discounts). */
export function eventNetRevenue(ev: MarketEvent): number {
  const revenue = ev.sales.reduce((s, x) => s + x.price * x.qty - x.discount, 0);
  return Math.round(revenue * 100) / 100;
}
