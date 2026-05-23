import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Plus, Minus, Package, ShoppingBag, History, Trash2, Pencil, Undo2,
  MapPin, Calendar, BarChart3, StickyNote, Search, Tag, ImagePlus, X, Camera, Mic,
} from "lucide-react";
import {
  useStore,
  actions,
  mergeEventProduct,
  getCatalogProduct,
  type Product,
  type SaleRecord,
  type PaymentMethod,
  type Category,
  PAYMENT_LABEL,
  PAYMENT_EMOJI,
  productUnitCost,
} from "@/lib/store";
import { fileToCompressedDataURL } from "@/lib/image";
import { EmojiPicker, IconBadge } from "@/components/EmojiPicker";
import { ProductCatalogView } from "@/components/ProductCatalogView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/event/$id")({
  head: () => ({ meta: [{ title: "集市 — 摊玩" }] }),
  component: EventPage,
  notFoundComponent: () => <div className="p-8 text-center">活动不存在</div>,
});

type Tab = "sell" | "products" | "history" | "analytics";
const ALL = "__all__";

function EventPage() {
  const { id } = Route.useParams();
  const { events, catalog } = useStore();
  const navigate = useNavigate();
  const ev = events.find((e) => e.id === id);
  const [tab, setTab] = useState<Tab>("sell");

  if (!ev) {
    return (
      <div className="app-shell p-8 text-center">
        <p>找不到这个活动</p>
        <Button asChild variant="link"><Link to="/">回到首页</Link></Button>
      </div>
    );
  }

  const totals = useMemo(() => {
    const revenue = ev.sales.reduce((s, x) => s + x.price * x.qty - x.discount, 0);
    const sold = ev.sales.reduce((s, x) => s + x.qty, 0);
    return { revenue: Math.round(revenue * 100) / 100, sold };
  }, [ev.sales]);

  return (
    <div className="app-shell pb-24">
      <header className="px-4 pt-4 pb-3 border-b border-[#E6EBE5]">
        <button onClick={() => navigate({ to: "/" })} className="flex items-center gap-1 text-sm text-[#8B9D8E] -ml-1 mb-3">
          <ArrowLeft className="size-4" /> 我的集市
        </button>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-medium truncate">{ev.name}</h1>
              <span
                className={cn(
                  "shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium",
                  ev.returned
                    ? "bg-[#EDF3EE] text-[#8B9D8E] border border-[#E6EBE5]"
                    : "bg-[#EDF3EE] text-[#4A7C59] border border-[#4A7C59]/30",
                )}
              >
                {ev.returned ? "已收摊" : "出摊中"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs text-[#8B9D8E]">
              <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{ev.date || "—"}</span>
              <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{ev.location || "—"}</span>
            </div>
          </div>
          {!ev.returned && (
            <Button
              variant="secondary"
              size="sm"
              className="h-9 shrink-0 rounded-xl text-xs"
              onClick={() => {
                if (confirm("确认收摊？未售出的出摊库存将退回总备货")) {
                  actions.markEventReturned(ev.id);
                  toast.success("已收摊并退回库存");
                }
              }}
            >
              收摊
            </Button>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-[#E6EBE5] bg-white p-3 shadow-sm flex items-center justify-around">
          <Metric label="营收" value={`¥${totals.revenue}`} highlight />
          <div className="h-8 w-px bg-[#E6EBE5]" />
          <Metric label="售出件数" value={totals.sold} />
          <div className="h-8 w-px bg-[#E6EBE5]" />
          <Metric label="在架商品" value={ev.products.length} />
        </div>
      </header>

      <nav className="px-4 sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-[#E6EBE5]">
        <div className="flex">
          <TabBtn active={tab === "sell"} onClick={() => setTab("sell")} icon={<ShoppingBag className="size-4" />}>销售</TabBtn>
          <TabBtn active={tab === "products"} onClick={() => setTab("products")} icon={<Package className="size-4" />}>商品</TabBtn>
          <TabBtn active={tab === "history"} onClick={() => setTab("history")} icon={<History className="size-4" />}>记录</TabBtn>
          <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")} icon={<BarChart3 className="size-4" />}>分析</TabBtn>
        </div>
      </nav>

      <main className="px-4 mt-3">
        {tab === "sell" && (
          <SellTab
            eventId={ev.id}
            products={ev.products.map((p) => mergeEventProduct(p, catalog))}
            categories={ev.categories}
            sales={ev.sales}
            returned={ev.returned}
            onAddFirst={() => setTab("products")}
          />
        )}
        {tab === "products" && (
          <ProductsTab
            eventId={ev.id}
            products={ev.products.map((p) => mergeEventProduct(p, catalog))}
            categories={ev.categories}
            catalog={catalog}
            returned={ev.returned}
          />
        )}
        {tab === "history" && <HistoryTab eventId={ev.id} sales={ev.sales} />}
        {tab === "analytics" && <AnalyticsTab products={ev.products} sales={ev.sales} />}
      </main>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-sm font-mono font-medium tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      <div className="text-xs text-[#8B9D8E] mt-0.5">{label}</div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1 text-xs py-3 transition-colors border-b-2 -mb-px ${
        active ? "border-[#4A7C59] text-primary font-medium" : "border-transparent text-[#8B9D8E]"
      }`}
    >
      {icon}{children}
    </button>
  );
}

function categoryLabel(cats: Category[], id: string): Category {
  return cats.find((c) => c.id === id) ?? { id, name: "未分类", emoji: "📦" };
}

function CategoryChips({
  categories, value, onChange, showAll = true, counts,
}: {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  showAll?: boolean;
  counts?: Record<string, number>;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 py-1 scrollbar-none">
      {showAll && (
        <ChipBtn active={value === ALL} onClick={() => onChange(ALL)}>
          全部{counts ? ` ${Object.values(counts).reduce((a, b) => a + b, 0)}` : ""}
        </ChipBtn>
      )}
      {categories.map((c) => (
        <ChipBtn key={c.id} active={value === c.id} onClick={() => onChange(c.id)}>
          <IconBadge emoji={c.emoji} iconImage={c.iconImage} className="size-4 text-sm" />
          <span>{c.name}</span>
          {counts && counts[c.id] != null && <span className="opacity-60">{counts[c.id]}</span>}
        </ChipBtn>
      ))}
    </div>
  );
}

function ChipBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1 text-xs px-3 h-8 rounded-full border transition-colors ${
        active ? "bg-[#4A7C59] text-white border-[#4A7C59]" : "bg-white text-foreground border-[#E6EBE5]"
      }`}
    >
      {children}
    </button>
  );
}

function SellTab({
  eventId, products, categories, sales, returned, onAddFirst,
}: {
  eventId: string;
  products: Product[];
  categories: Category[];
  sales: SaleRecord[];
  returned: boolean;
  onAddFirst: () => void;
}) {
  const [filter, setFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");

  const soldMap = useMemo(() => {
    const m = new Map<string, number>();
    sales.forEach((s) => m.set(s.productId, (m.get(s.productId) ?? 0) + s.qty));
    return m;
  }, [sales]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    products.forEach((p) => { c[p.categoryId] = (c[p.categoryId] ?? 0) + 1; });
    return c;
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (filter !== ALL && p.categoryId !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, filter, query]);

  const lastOrderId = sales[0]?.orderId;
  const lastOrderItems = useMemo(
    () => (lastOrderId ? sales.filter((s) => s.orderId === lastOrderId) : []),
    [sales, lastOrderId],
  );

  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ p: productMap.get(id)!, qty }))
    .filter((x) => x.p && x.qty > 0);
  const cartCount = cartItems.reduce((s, x) => s + x.qty, 0);
  const cartTotal = cartItems.reduce((s, x) => s + x.p.price * x.qty, 0);

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E6EBE5] py-10 px-4 text-center">
        <p className="text-sm text-[#8B9D8E]">还没有商品。先去添加吧。</p>
        <Button onClick={onAddFirst} variant="secondary" className="mt-4 h-10 rounded-xl"><Plus className="size-4" />添加商品</Button>
      </div>
    );
  }

  const addToCart = (p: Product) => {
    const cur = cart[p.id] ?? 0;
    if (cur + 1 > p.stock) { toast.error("库存不足"); return; }
    setCart({ ...cart, [p.id]: cur + 1 });
    if (navigator.vibrate) navigator.vibrate(10);
  };
  const removeFromCart = (p: Product) => {
    const cur = cart[p.id] ?? 0;
    if (cur <= 0) return;
    const next = { ...cart };
    if (cur - 1 <= 0) delete next[p.id]; else next[p.id] = cur - 1;
    setCart(next);
  };

  return (
    <>
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索商品名"
            className="pl-9 h-10 rounded-xl"
          />
        </div>
        <CategoryChips categories={categories} value={filter} onChange={setFilter} counts={counts} />
      </div>

      <div className={`grid grid-cols-2 gap-3 ${cartCount > 0 ? "pb-32" : "pb-20"}`}>
        {filtered.length === 0 && (
          <p className="col-span-2 text-center text-sm text-muted-foreground py-10">没有匹配的商品</p>
        )}
        {returned && (
          <p className="col-span-2 text-center text-xs text-[#8B9D8E] py-2 rounded-xl bg-[#F7F9F6] border border-[#E6EBE5]">
            活动已收摊，无法继续收银
          </p>
        )}
        {filtered.map((p) => {
          const cat = categoryLabel(categories, p.categoryId);
          const out = p.stock <= 0;
          const sold = soldMap.get(p.id) ?? 0;
          const inCart = cart[p.id] ?? 0;
          const cover = p.images?.[0];
          const total = p.totalStock ?? 0;
          return (
            <div
              key={p.id}
              className={`relative rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3 flex flex-col ${out || returned ? "opacity-60" : ""} ${inCart > 0 ? "border-[#4A7C59]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-[#E6EBE5] text-[#8B9D8E]">
                  <IconBadge emoji={cat.emoji} iconImage={cat.iconImage} className="size-3 text-[10px]" />{cat.name}
                </div>
                {sold > 0 && (
                  <span className="text-[10px] font-medium text-foreground border border-[#E6EBE5] px-1.5 py-0.5 rounded">
                    已售 {sold}
                  </span>
                )}
              </div>

              <button
                disabled={out || returned}
                onClick={() => addToCart(p)}
                className="text-left mt-1 active:scale-[0.97] transition-transform disabled:active:scale-100 disabled:pointer-events-none"
              >
                <div className="relative aspect-square rounded-xl border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden flex items-center justify-center mt-1">
                  {cover ? (
                    <img src={cover} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-4xl">{p.emoji || cat.emoji || "📦"}</span>
                  )}
                  {out && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                      <span className="text-white text-xs font-medium">售罄</span>
                    </div>
                  )}
                </div>
                <div className="mt-1.5 font-medium leading-tight line-clamp-2 min-h-[2.5rem] text-sm">{p.name}</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono font-medium tabular-nums">¥{p.price}</span>
                  <span className="text-xs text-[#8B9D8E]">
                    {out ? "售罄" : `${p.stock}/${total}`}
                  </span>
                </div>
              </button>

              {!returned && (
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  onClick={() => removeFromCart(p)}
                  disabled={inCart === 0}
                  className="h-9 w-9 rounded-xl border border-[#E6EBE5] bg-white shadow-sm text-[#8B9D8E] active:bg-[#EDF3EE] inline-flex items-center justify-center disabled:opacity-40"
                  aria-label="减少"
                >
                  <Minus className="size-4" />
                </button>
                <div className="flex-1 text-center text-sm font-medium tabular-nums">
                  {inCart > 0 ? <span className="font-mono font-medium">{inCart}</span> : <span className="text-[#8B9D8E]">加入</span>}
                </div>
                <button
                  disabled={out || inCart >= p.stock}
                  onClick={() => addToCart(p)}
                  className="h-9 w-9 rounded-xl bg-[#4A7C59] text-white active:bg-[#3D6B4A] inline-flex items-center justify-center disabled:opacity-40"
                  aria-label="增加"
                >
                  <Plus className="size-4" />
                </button>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {cartCount > 0 && !returned ? (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-3 bg-white border-t border-[#E6EBE5]">
          <div className="mx-auto max-w-md rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3 flex items-center gap-3">
            <button onClick={() => setCart({})} className="text-xs text-[#8B9D8E] px-2 py-1 active:text-foreground">
              清空
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[#8B9D8E]">共 {cartCount} 件</div>
              <div className="text-sm font-mono font-medium tabular-nums leading-tight">¥{cartTotal}</div>
            </div>
            <button
              onClick={() => setCheckoutOpen(true)}
              className="h-10 px-4 rounded-xl bg-[#4A7C59] text-white text-sm font-medium active:bg-[#3D6B4A] transition-colors inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="size-4" />
              结账
            </button>
          </div>
        </div>
      ) : (
        lastOrderId && lastOrderItems.length > 0 && (
          <button
            onClick={() => { actions.undoOrder(eventId, lastOrderId); toast("已撤销上一单"); }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-4 h-10 rounded-xl border border-[#E6EBE5] bg-[#4A7C59] text-white text-sm font-medium active:bg-[#3D6B4A] transition-colors"
          >
            <Undo2 className="size-4" />
            撤销上一单 ({lastOrderItems.reduce((s, x) => s + x.qty, 0)} 件)
          </button>
        )
      )}

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        items={cartItems}
        total={cartTotal}
        onConfirm={(payment, discount, note, photo) => {
          if (returned) {
            toast.error("活动已收摊，无法结账");
            return;
          }
          const orderId = actions.recordOrder(
            eventId,
            cartItems.map(({ p, qty }) => ({ productId: p.id, qty })),
            { paymentMethod: payment, discount, note, photo },
          );
          if (orderId) {
            const paid = Math.max(0, cartTotal - discount);
            toast.success(`已结账 ¥${paid}`, { description: `${PAYMENT_LABEL[payment]} · ${cartCount} 件${discount > 0 ? ` · 优惠 ¥${discount}` : ""}` });
            if (navigator.vibrate) navigator.vibrate([15, 40, 15]);
            setCart({});
            setCheckoutOpen(false);
          } else {
            toast.error("库存不足，请检查");
          }
        }}
      />
    </>
  );
}

const DISCOUNT_PRESETS: { label: string; percent: number }[] = [
  { label: "不打折", percent: 0 },
  { label: "95折", percent: 5 },
  { label: "9折",  percent: 10 },
  { label: "85折", percent: 15 },
  { label: "8折",  percent: 20 },
  { label: "75折", percent: 25 },
  { label: "7折",  percent: 30 },
  { label: "65折", percent: 35 },
  { label: "6折",  percent: 40 },
  { label: "5折",  percent: 50 },
];

function CheckoutDialog({
  open, onOpenChange, items, total, onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: { p: Product; qty: number }[];
  total: number;
  onConfirm: (payment: PaymentMethod, discount: number, note: string, photo?: string) => void;
}) {
  const [payment, setPayment] = useState<PaymentMethod>("wechat");
  const [percent, setPercent] = useState<number>(0);
  const [discountStr, setDiscountStr] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // discount: user override wins; otherwise compute from percent
  const computed = Math.round(total * percent) / 100; // percent is in % units (e.g. 20 -> 20%)
  const discount = discountStr !== ""
    ? Math.max(0, Math.min(total, Number(discountStr) || 0))
    : Math.max(0, Math.min(total, computed));
  const paid = Math.max(0, Math.round((total - discount) * 100) / 100);

  const handleOpenChange = (o: boolean) => {
    if (o) {
      setDiscountStr(""); setPercent(0); setNote(""); setPayment("wechat"); setPhoto(undefined);
    }
    onOpenChange(o);
  };

  const handlePhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try { setPhoto(await fileToCompressedDataURL(f, 1200, 0.78)); }
    catch { toast.error("无法处理照片"); }
    finally { setUploading(false); if (photoRef.current) photoRef.current.value = ""; }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[92vw] rounded-xl border border-[#E6EBE5] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base font-medium">结账</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E6EBE5] p-3 max-h-32 overflow-y-auto space-y-1">
            {items.map(({ p, qty }) => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="truncate">{p.emoji || ""} {p.name} ×{qty}</span>
                <span className="text-muted-foreground tabular-nums">¥{p.price * qty}</span>
              </div>
            ))}
          </div>

          <div>
            <Label>支付方式</Label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["wechat", "alipay"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayment(m)}
                  className={`rounded-xl border p-4 flex flex-col items-center gap-2 transition-all ${
                    payment === m ? "border-[#4A7C59] bg-[#EDF3EE]" : "border-[#E6EBE5]"
                  }`}
                >
                  <span className="text-4xl">{PAYMENT_EMOJI[m]}</span>
                  <span className="text-sm font-medium">{PAYMENT_LABEL[m]}</span>
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["cash", "other"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPayment(m)}
                  className={`rounded-xl border p-2 text-xs inline-flex items-center justify-center gap-1.5 ${
                    payment === m ? "border-[#4A7C59] bg-[#EDF3EE] text-foreground" : "border-[#E6EBE5] text-[#8B9D8E]"
                  }`}
                >
                  <span className="text-base">{PAYMENT_EMOJI[m]}</span>
                  {PAYMENT_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label>折扣</Label>
              {percent > 0 && discountStr === "" && (
                <span className="text-xs text-muted-foreground">
                  原价 ¥{total} × {(100 - percent) / 10}折 = 优惠 ¥{computed}
                </span>
              )}
            </div>
            <select
              value={percent}
              onChange={(e) => { setPercent(Number(e.target.value)); setDiscountStr(""); }}
              className="mt-1.5 w-full h-10 rounded-xl border border-[#E6EBE5] bg-white shadow-sm px-3 text-sm"
            >
              {DISCOUNT_PRESETS.map((d) => (
                <option key={d.percent} value={d.percent}>{d.label}</option>
              ))}
            </select>
            <div className="mt-2">
              <Label htmlFor="c-discount" className="text-xs text-muted-foreground">或自定义优惠金额 (¥)</Label>
              <Input id="c-discount" type="number" inputMode="decimal" value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)} placeholder="留空则按折扣计算" className="mt-1" />
            </div>
          </div>

          <div>
            <Label>结账照片 (可选)</Label>
            <div className="mt-1.5">
              {photo ? (
                <div className="relative rounded-xl overflow-hidden border border-[#E6EBE5] bg-[#EDF3EE]">
                  <img src={photo} alt="" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhoto(undefined)}
                    className="absolute top-1.5 right-1.5 size-7 rounded-full bg-[#4A7C59]/60 text-white inline-flex items-center justify-center"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-20 rounded-xl border border-dashed border-[#E6EBE5] flex flex-col items-center justify-center gap-1 text-[#8B9D8E] active:bg-[#EDF3EE]"
                >
                  <Camera className="size-5" />
                  <span className="text-xs">{uploading ? "处理中…" : "拍照或上传"}</span>
                </button>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handlePhoto(e.target.files?.[0])}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="c-note">备注 (可选)</Label>
            <Textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="例如：朋友、要发票、礼品包装…" className="mt-1.5 min-h-[60px]" />
          </div>

          <div className="rounded-xl border border-[#E6EBE5] bg-[#EDF3EE] p-3 flex items-baseline justify-between">
            <div>
              <div className="text-xs text-[#8B9D8E]">应收</div>
              <div className="text-base font-mono font-medium tabular-nums">¥{paid}</div>
            </div>
            {discount > 0 && (
              <div className="text-right text-xs text-[#8B9D8E]">
                原价 ¥{total}<br />优惠 ¥{Math.round(discount * 100) / 100}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onConfirm(payment, discount, note, photo)} className="w-full h-10 rounded-xl">
            确认收款 ¥{paid}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductsTab({
  eventId,
  products,
  categories,
  catalog,
  returned,
}: {
  eventId: string;
  products: Product[];
  categories: Category[];
  catalog: Product[];
  returned: boolean;
}) {
  const [poolOpen, setPoolOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [filter, setFilter] = useState<string>(ALL);
  const filtered = filter === ALL ? products : products.filter((p) => p.categoryId === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    products.forEach((p) => { c[p.categoryId] = (c[p.categoryId] ?? 0) + 1; });
    return c;
  }, [products]);

  const adjustStall = (productId: string, delta: number) => {
    if (returned) return;
    if (delta > 0) {
      const cat = catalog.find((c) => c.id === productId);
      const ok = actions.stockToEvent(eventId, productId, delta);
      if (ok) toast.success(`已划拨 ${delta} 件`);
      else toast.error(cat ? "总备货不足" : "商品不在商品池");
    } else if (delta < 0) {
      const ok = actions.returnFromEvent(eventId, productId, -delta);
      if (ok) toast.success(`已退回 ${-delta} 件`);
      else toast.error("退回失败");
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {!returned ? (
          <Button onClick={() => setPoolOpen(true)} className="w-full h-10 rounded-xl col-span-2">
            <Plus className="size-4" /> 从商品池添加
          </Button>
        ) : (
          <p className="col-span-2 text-center text-xs text-[#8B9D8E] py-2 rounded-xl bg-[#F7F9F6] border border-[#E6EBE5]">
            已收摊，出摊库存已退回总备货
          </p>
        )}
        <Dialog open={catOpen} onOpenChange={setCatOpen}>
          <DialogTrigger asChild>
            <Button variant="secondary" className="w-full h-10 rounded-xl col-span-2">
              <Tag className="size-4" /> 管理分类
            </Button>
          </DialogTrigger>
          <CategoryDialog eventId={eventId} categories={categories} onClose={() => setCatOpen(false)} />
        </Dialog>
      </div>

      <StockPoolPickerDialog
        open={poolOpen}
        onOpenChange={setPoolOpen}
        eventId={eventId}
        catalog={catalog}
        onStock={(productId, qty) => {
          const ok = actions.stockToEvent(eventId, productId, qty);
          if (ok) toast.success(`已划拨 ${qty} 件`);
          else toast.error("划拨失败，请检查总备货");
          return ok;
        }}
      />

      <CategoryChips categories={categories} value={filter} onChange={setFilter} counts={counts} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E6EBE5] py-10 px-4 text-center">
          <p className="text-sm text-[#8B9D8E]">还没有出摊商品</p>
          {!returned && (
            <Button onClick={() => setPoolOpen(true)} variant="secondary" className="mt-4 h-10 rounded-xl">
              <Plus className="size-4" /> 从商品池添加
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const cat = categoryLabel(categories, p.categoryId);
            const cover = p.images?.[0];
            const total = getCatalogProduct(p.id)?.totalStock ?? p.totalStock ?? 0;
            return (
              <li
                key={p.id}
                className={cn(
                  "rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3 flex items-center gap-3",
                  returned && "opacity-75",
                )}
              >
                <div className="size-14 shrink-0 rounded-xl border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-xl">
                  {cover ? (
                    <img src={cover} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    (p.emoji || cat.emoji || "📦")
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#E6EBE5] text-[#8B9D8E] inline-flex items-center gap-1 shrink-0">
                      <IconBadge emoji={cat.emoji} iconImage={cat.iconImage} className="size-3 text-[10px]" />
                      {cat.name}
                    </span>
                    <span className="font-medium truncate">{p.name}</span>
                  </div>
                  <div className="text-xs text-[#8B9D8E] mt-1 flex items-center gap-2">
                    <span className="text-[#4A7C59] font-mono tabular-nums">¥{p.price}</span>
                    <span className="font-mono tabular-nums">
                      出摊 <span className="text-foreground font-medium">{p.stock}</span>/{total}
                    </span>
                  </div>
                </div>
                {!returned ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={p.stock <= 0}
                      onClick={() => adjustStall(p.id, -1)}
                      className="size-9 rounded-xl border border-[#E6EBE5] bg-white inline-flex items-center justify-center disabled:opacity-40"
                      aria-label="减少出摊"
                    >
                      <Minus className="size-4 text-[#8B9D8E]" />
                    </button>
                    <span className="w-8 text-center text-sm font-mono tabular-nums">{p.stock}</span>
                    <button
                      type="button"
                      onClick={() => adjustStall(p.id, 1)}
                      className="size-9 rounded-xl bg-[#4A7C59] text-white inline-flex items-center justify-center"
                      aria-label="增加出摊"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-[#8B9D8E] shrink-0 px-2 py-1 rounded-full border border-[#E6EBE5]">
                    已收摊
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StockPoolPickerDialog({
  open,
  onOpenChange,
  catalog,
  onStock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  catalog: Product[];
  onStock: (productId: string, qty: number) => boolean;
}) {
  const [qtyMap, setQtyMap] = useState<Record<string, string>>({});
  const available = catalog.filter((c) => c.totalStock > 0);

  useEffect(() => {
    if (!open) setQtyMap({});
  }, [open]);

  const stockOne = (id: string) => {
    onStock(id, 1);
  };

  const stockBatch = (id: string) => {
    const raw = qtyMap[id] ?? "";
    const qty = Math.max(1, Math.floor(Number(raw) || 0));
    if (onStock(id, qty)) {
      setQtyMap((m) => ({ ...m, [id]: "" }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-[#E6EBE5] p-4 gap-3">
        <DialogHeader className="shrink-0 space-y-0">
          <DialogTitle className="text-base font-medium">从商品池添加</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-0.5">
          {available.length === 0 ? (
            <p className="text-sm text-[#8B9D8E] text-center py-8">商品池暂无可用总库存</p>
          ) : (
            available.map((c) => {
              const cover = c.images?.[0];
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-xl border border-[#E6EBE5] bg-white p-2"
                >
                  <div className="size-11 shrink-0 rounded-lg bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-lg">
                    {cover ? (
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (c.emoji || "📦")
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-[#8B9D8E]">总备货 {c.totalStock} · ¥{c.price}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => stockOne(c.id)}
                    className="size-9 shrink-0 rounded-xl bg-[#4A7C59] text-white inline-flex items-center justify-center"
                    aria-label="划拨 1 件"
                  >
                    <Plus className="size-4" />
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      placeholder="数量"
                      value={qtyMap[c.id] ?? ""}
                      onChange={(e) => setQtyMap((m) => ({ ...m, [c.id]: e.target.value }))}
                      className="h-9 w-14 rounded-lg text-center text-xs px-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-lg text-xs px-2"
                      onClick={() => stockBatch(c.id)}
                    >
                      划拨
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryDialog({ eventId, categories, onClose }: { eventId: string; categories: Category[]; onClose: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<{ emoji?: string; iconImage?: string }>({ emoji: "🏷️" });

  const add = () => {
    if (!name.trim()) return;
    actions.addCategory(eventId, { name, emoji: icon.emoji, iconImage: icon.iconImage });
    setName(""); setIcon({ emoji: "🏷️" }); setNewOpen(false);
  };

  return (
    <DialogContent className="max-w-[92vw] rounded-xl border border-[#E6EBE5] max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="text-base font-medium">管理分类</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <ul className="space-y-2">
          {categories.map((c) => (
            <li key={c.id} className="rounded-xl border border-[#E6EBE5] p-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                  className="size-10 rounded-xl border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-xl shrink-0"
                >
                  <IconBadge emoji={c.emoji} iconImage={c.iconImage} className="size-7" />
                </button>
                <Input
                  value={c.name}
                  onChange={(e) => actions.updateCategory(eventId, c.id, { name: e.target.value })}
                  className="flex-1"
                />
                <button
                  onClick={() => {
                    if (categories.length <= 1) { toast.error("至少保留一个分类"); return; }
                    if (confirm(`删除分类「${c.name}」？该分类下商品将归到其他分类`)) {
                      actions.deleteCategory(eventId, c.id);
                    }
                  }}
                  className="p-2 text-[#8B9D8E] hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {editingId === c.id && (
                <div className="mt-2 pt-2 border-t border-[#E6EBE5]">
                  <EmojiPicker
                    emoji={c.emoji}
                    iconImage={c.iconImage}
                    onChange={(next) => actions.updateCategory(eventId, c.id, next)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>

        {newOpen ? (
          <div className="rounded-xl border border-dashed border-[#E6EBE5] p-3 space-y-3">
            <Label className="text-xs">新增分类</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：明信片" />
            <EmojiPicker emoji={icon.emoji} iconImage={icon.iconImage} onChange={setIcon} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setNewOpen(false); setName(""); setIcon({ emoji: "🏷️" }); }} className="flex-1 h-10 rounded-xl">取消</Button>
              <Button onClick={add} disabled={!name.trim()} className="flex-1 h-10 rounded-xl">添加</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setNewOpen(true)} className="w-full h-10 rounded-xl">
            <Plus className="size-4" /> 新增分类
          </Button>
        )}
      </div>
      <DialogFooter>
        <Button onClick={onClose} className="w-full h-10 rounded-xl">完成</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ProductDialog({
  eventId, categories, product, returned, onDone,
}: {
  eventId: string;
  categories: Category[];
  product: Product | null;
  returned: boolean;
  onDone: () => void;
}) {
  const catalogItem = product ? getCatalogProduct(product.id) : undefined;
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState(product?.price?.toString() ?? "");
  const [totalStock, setTotalStock] = useState(
    (catalogItem?.totalStock ?? product?.totalStock ?? 0).toString(),
  );
  const [stock, setStock] = useState(product?.stock?.toString() ?? "");
  const [categoryId, setCategoryId] = useState<string>(product?.categoryId ?? categories[0]?.id ?? "");
  const [emoji, setEmoji] = useState(product?.emoji ?? "");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [material, setMaterial] = useState(product?.materialCost?.toString() ?? "");
  const [labor, setLabor] = useState(product?.laborCost?.toString() ?? "");
  const [other, setOther] = useState(product?.otherCost?.toString() ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const isListeningRef = useRef(false);

  const speech = useSpeechRecognition({
    onResult: (text) => {
      setName((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${text}` : text;
      });
    },
  });

  const handleMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (speech.isBusy) return;
    isListeningRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    void speech.startListening();
  };

  const handleMicPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    speech.stopListening();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const arr = Array.from(files).slice(0, 6);
      const results: string[] = [];
      for (const f of arr) {
        try { results.push(await fileToCompressedDataURL(f)); }
        catch { toast.error(`无法处理 ${f.name}`); }
      }
      setImages((prev) => [...prev, ...results].slice(0, 8));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const priceNum = Number(price) || 0;
  const costNum = (Number(material) || 0) + (Number(labor) || 0) + (Number(other) || 0);
  const profit = priceNum - costNum;

  const save = () => {
    const meta = {
      name: name.trim(),
      price: priceNum,
      categoryId,
      emoji: emoji.trim() || undefined,
      images,
      materialCost: Number(material) || 0,
      laborCost: Number(labor) || 0,
      otherCost: Number(other) || 0,
    };
    const totalStockNum = Number(totalStock) || 0;
    const eventStockNum = Number(stock) || 0;
    if (!meta.name) return;
    if (!meta.categoryId) {
      toast.error("请选择分类");
      return;
    }
    if (returned) {
      toast.error("活动已收摊，无法修改商品");
      return;
    }
    if (product) {
      actions.updateCatalogItem(product.id, { ...meta, totalStock: totalStockNum });
      actions.updateProduct(eventId, product.id, { stock: eventStockNum });
    } else {
      const item = actions.addToCatalog({ ...meta, stock: 0, totalStock: totalStockNum });
      if (eventStockNum > 0) {
        const ok = actions.stockToEvent(eventId, item.id, eventStockNum);
        if (!ok) toast.error("出摊数量超过总备货，请检查");
      }
    }
    onDone();
  };

  return (
    <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-[#E6EBE5] p-4 gap-3">
      <DialogHeader className="shrink-0 space-y-0">
        <DialogTitle className="text-base font-medium">{product ? "编辑商品" : "添加商品"}</DialogTitle>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto space-y-3 pr-0.5">
        <div>
          <Label>分类</Label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={`inline-flex items-center gap-1 px-3 h-9 rounded-full border text-sm ${
                  categoryId === c.id ? "border-[#4A7C59] bg-[#EDF3EE] text-foreground" : "border-[#E6EBE5] text-[#8B9D8E]"
                }`}
              >
                <IconBadge emoji={c.emoji} iconImage={c.iconImage} className="size-4 text-sm" />{c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="p-name">名称</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：山海经手作版画"
              className="flex-1 min-w-0"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {speech.hintText ? (
                <span className="text-xs text-[#4A7C59] whitespace-nowrap">{speech.hintText}</span>
              ) : null}
              <button
                type="button"
                aria-label="按住说话填写名称"
                disabled={speech.status === "processing"}
                onPointerDown={handleMicPointerDown}
                onPointerUp={handleMicPointerUp}
                onPointerLeave={handleMicPointerUp}
                onPointerCancel={handleMicPointerUp}
                className={cn(
                  "size-9 rounded-full border border-[#E6EBE5] bg-white text-[#8B9D8E] shrink-0 touch-none select-none transition-colors",
                  speech.status === "listening" && "bg-[#4A7C59] text-white border-[#4A7C59] animate-pulse",
                  speech.status === "processing" && "opacity-60",
                )}
              >
                <Mic className="size-4 mx-auto" />
              </button>
            </div>
          </div>
          {!speech.speechSupported && speech.audioUrl ? (
            <p className="mt-1.5 text-xs text-[#8B9D8E]">已保存录音参考（浏览器不支持语音识别）</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-price">售价 (¥)</Label>
            <Input id="p-price" type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="80" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="p-total-stock">总备货</Label>
            <Input
              id="p-total-stock"
              type="number"
              inputMode="numeric"
              value={totalStock}
              onChange={(e) => setTotalStock(e.target.value)}
              placeholder="20"
              className="mt-1.5"
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="p-stock">出摊库存（本次活动）</Label>
            <Input
              id="p-stock"
              type="number"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="10"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label>商品图片 ({images.length}/8)</Label>
          <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-[#E6EBE5]/60 p-2">
            <div className="grid grid-cols-4 gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative aspect-square max-h-20 rounded-lg overflow-hidden border border-[#E6EBE5] bg-[#EDF3EE]">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 size-5 rounded-full bg-[#4A7C59]/60 text-white inline-flex items-center justify-center"
                >
                  <X className="size-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] bg-[#4A7C59]/60 text-white px-1 rounded">封面</span>
                )}
              </div>
            ))}
            {images.length < 8 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="aspect-square max-h-20 rounded-lg border border-dashed border-[#E6EBE5] flex flex-col items-center justify-center gap-1 text-[#8B9D8E] active:bg-[#EDF3EE]"
              >
                <ImagePlus className="size-5" />
                <span className="text-[10px]">{uploading ? "处理中" : "添加"}</span>
              </button>
            )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div>
          <Label>成本核算 (每件)</Label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            <div>
              <Input type="number" inputMode="decimal" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="物料" />
              <div className="text-[10px] text-muted-foreground text-center mt-1">物料</div>
            </div>
            <div>
              <Input type="number" inputMode="decimal" value={labor} onChange={(e) => setLabor(e.target.value)} placeholder="人力" />
              <div className="text-[10px] text-muted-foreground text-center mt-1">人力</div>
            </div>
            <div>
              <Input type="number" inputMode="decimal" value={other} onChange={(e) => setOther(e.target.value)} placeholder="其他" />
              <div className="text-[10px] text-muted-foreground text-center mt-1">其他</div>
            </div>
          </div>
          {(priceNum > 0 || costNum > 0) && (
            <div className="mt-2 rounded-xl border border-[#E6EBE5] p-2 flex justify-between text-xs">
              <span className="text-[#8B9D8E]">单件成本 ¥{costNum}</span>
              <span>毛利 <span className="font-mono font-medium tabular-nums">¥{Math.round(profit * 100) / 100}</span></span>
            </div>
          )}
        </div>

        <div>
          <Label>图标 (无图片时显示)</Label>
          <div className="mt-1.5">
            <EmojiPicker emoji={emoji} onChange={(n) => setEmoji(n.emoji ?? "")} allowClear />
          </div>
        </div>
      </div>
      <DialogFooter className="shrink-0 pt-1 sm:justify-stretch">
        <Button onClick={save} disabled={!name.trim()} className="w-full h-10 rounded-xl">保存</Button>
      </DialogFooter>
    </DialogContent>
  );
}

interface Order {
  orderId: string;
  at: number;
  paymentMethod: PaymentMethod;
  discount: number;
  note?: string;
  photo?: string;
  lines: SaleRecord[];
  gross: number;
  net: number;
  qty: number;
}

function groupOrders(sales: SaleRecord[]): Order[] {
  const map = new Map<string, Order>();
  for (const s of sales) {
    let o = map.get(s.orderId);
    if (!o) {
      o = { orderId: s.orderId, at: s.at, paymentMethod: s.paymentMethod, discount: 0, note: s.note, photo: s.photo,
        lines: [], gross: 0, net: 0, qty: 0 };
      map.set(s.orderId, o);
    }
    o.lines.push(s);
    o.gross += s.price * s.qty;
    o.discount += s.discount;
    o.net += s.price * s.qty - s.discount;
    o.qty += s.qty;
    if (s.at < o.at) o.at = s.at;
    if (!o.note && s.note) o.note = s.note;
    if (!o.photo && s.photo) o.photo = s.photo;
  }
  return Array.from(map.values()).sort((a, b) => b.at - a.at);
}

function HistoryTab({ eventId, sales }: { eventId: string; sales: SaleRecord[] }) {
  const orders = useMemo(() => groupOrders(sales), [sales]);
  if (orders.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">还没有销售记录</p>;
  }
  return (
    <ul className="space-y-2 pb-6">
      {orders.map((o) => (
        <li key={o.orderId} className="rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-[#8B9D8E]">
              <span>{new Date(o.at).toLocaleString("zh-CN", { hour: "2-digit", minute: "2-digit", month: "2-digit", day: "2-digit" })}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#E6EBE5] text-foreground">
                {PAYMENT_EMOJI[o.paymentMethod]} {PAYMENT_LABEL[o.paymentMethod]}
              </span>
            </div>
            <div className="font-mono font-medium tabular-nums">¥{Math.round(o.net * 100) / 100}</div>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {o.lines.map((l) => (
              <li key={l.id} className="flex justify-between">
                <span className="truncate">{l.productName} ×{l.qty}</span>
                <span className="text-muted-foreground tabular-nums">¥{l.price * l.qty}</span>
              </li>
            ))}
          </ul>
          {o.discount > 0 && (
            <div className="mt-1 text-xs text-muted-foreground flex justify-between">
              <span>优惠</span><span>− ¥{Math.round(o.discount * 100) / 100}</span>
            </div>
          )}
          {o.note && (
            <div className="mt-2 text-xs text-[#8B9D8E] flex items-start gap-1 border border-[#E6EBE5] rounded-xl p-2">
              <StickyNote className="size-3 mt-0.5 shrink-0" />
              <span className="break-words">{o.note}</span>
            </div>
          )}
          {o.photo && (
            <img src={o.photo} alt="结账照片" className="mt-2 w-full max-h-48 object-cover rounded-xl" loading="lazy" />
          )}
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => { if (confirm("撤销整单？库存将恢复")) { actions.undoOrder(eventId, o.orderId); toast("已撤销整单"); } }}
              className="text-xs text-[#8B9D8E] hover:text-foreground inline-flex items-center gap-1 px-2 py-1"
            >
              <Undo2 className="size-3" /> 撤销整单
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AnalyticsTab({ products, sales }: { products: Product[]; sales: SaleRecord[] }) {
  const orders = useMemo(() => groupOrders(sales), [sales]);
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const stats = useMemo(() => {
    const gross = sales.reduce((s, x) => s + x.price * x.qty, 0);
    const discount = sales.reduce((s, x) => s + x.discount, 0);
    const net = gross - discount;
    const qty = sales.reduce((s, x) => s + x.qty, 0);
    const cost = sales.reduce((s, x) => {
      const p = productMap.get(x.productId);
      return s + (p ? productUnitCost(p) * x.qty : 0);
    }, 0);
    const profit = net - cost;
    const orderCount = orders.length;
    const avgOrder = orderCount > 0 ? net / orderCount : 0;
    const round = (n: number) => Math.round(n * 100) / 100;
    return { gross: round(gross), discount: round(discount), net: round(net), qty, orderCount, avgOrder: round(avgOrder), cost: round(cost), profit: round(profit) };
  }, [sales, orders, productMap]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { name: string; emoji?: string; qty: number; net: number; cost: number }>();
    for (const s of sales) {
      const p = productMap.get(s.productId);
      const cur = m.get(s.productId) ?? { name: s.productName, emoji: p?.emoji, qty: 0, net: 0, cost: 0 };
      cur.qty += s.qty;
      cur.net += s.price * s.qty - s.discount;
      cur.cost += (p ? productUnitCost(p) : 0) * s.qty;
      m.set(s.productId, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.net - a.net);
  }, [sales, productMap]);

  const byPayment = useMemo(() => {
    const m = new Map<PaymentMethod, { net: number; orders: number }>();
    for (const o of orders) {
      const cur = m.get(o.paymentMethod) ?? { net: 0, orders: 0 };
      cur.net += o.net; cur.orders += 1;
      m.set(o.paymentMethod, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].net - a[1].net);
  }, [orders]);

  const byHour = useMemo(() => {
    const buckets = new Map<number, number>();
    for (const s of sales) {
      const h = new Date(s.at).getHours();
      buckets.set(h, (buckets.get(h) ?? 0) + s.price * s.qty - s.discount);
    }
    return Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
  }, [sales]);

  const byDay = useMemo(() => {
    const buckets = new Map<string, { net: number; qty: number; orderIds: Set<string> }>();
    for (const s of sales) {
      const d = new Date(s.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = buckets.get(key) ?? { net: 0, qty: 0, orderIds: new Set<string>() };
      cur.net += s.price * s.qty - s.discount;
      cur.qty += s.qty;
      cur.orderIds.add(s.orderId);
      buckets.set(key, cur);
    }
    return Array.from(buckets.entries())
      .map(([day, v]) => ({ day, net: Math.round(v.net * 100) / 100, qty: v.qty, orders: v.orderIds.size }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [sales]);
  const dayMax = Math.max(1, ...byDay.map((d) => d.net));

  const hourMax = Math.max(1, ...byHour.map(([, v]) => v));
  const productMax = Math.max(1, ...byProduct.map((p) => p.net));

  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#E6EBE5] py-10 px-4 text-center">
        <p className="text-sm text-[#8B9D8E]">还没有销售数据。出摊后这里会自动汇总。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="净营收" value={`¥${stats.net}`} highlight />
        <StatCard label="净利润" value={`¥${stats.profit}`} highlight />
        <StatCard label="成本合计" value={`¥${stats.cost}`} />
        <StatCard label="优惠合计" value={`¥${stats.discount}`} />
        <StatCard label="订单数" value={stats.orderCount} />
        <StatCard label="售出件数" value={stats.qty} />
        <StatCard label="客单价" value={`¥${stats.avgOrder}`} />
        <StatCard label="毛收入" value={`¥${stats.gross}`} />
      </div>

      <Section title="商品排行 (按营收)">
        <ul className="space-y-2">
          {byProduct.map((p, i) => {
            const profit = p.net - p.cost;
            return (
              <li key={p.name + i}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate flex items-center gap-2">
                    <span className="text-muted-foreground w-4 text-xs tabular-nums">{i + 1}</span>
                    <span>{p.emoji ?? "📦"}</span>
                    <span className="truncate">{p.name}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground text-xs">
                    ×{p.qty} · <span className="font-mono font-medium">¥{Math.round(p.net * 100) / 100}</span>
                    {p.cost > 0 && <> · 利 <span className="font-mono tabular-nums">¥{Math.round(profit * 100) / 100}</span></>}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden">
                  <div className="h-full bg-[#4A7C59]" style={{ width: `${(p.net / productMax) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="支付方式">
        <ul className="space-y-2">
          {byPayment.map(([m, v]) => (
            <li key={m} className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="text-lg">{PAYMENT_EMOJI[m]}</span>
                <span>{PAYMENT_LABEL[m]}</span>
                <span className="text-xs text-muted-foreground">{v.orders} 单</span>
              </span>
              <span className="font-mono font-medium tabular-nums">¥{Math.round(v.net * 100) / 100}</span>
            </li>
          ))}
        </ul>
      </Section>

      {byDay.length > 1 && (
        <Section title="每日销量对比">
          <div className="space-y-2">
            {byDay.map((d) => (
              <div key={d.day}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">{d.day.slice(5)}</span>
                  <span className="tabular-nums">
                    <span className="font-mono font-medium">¥{d.net}</span>
                    <span className="text-[#8B9D8E]"> · {d.qty}件 · {d.orders}单</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden">
                  <div className="h-full bg-[#4A7C59]" style={{ width: `${(d.net / dayMax) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {byHour.length > 1 && (
        <Section title="时段分布">
          <div className="flex items-end gap-1 h-24">
            {byHour.map(([h, v]) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full bg-[#4A7C59] rounded-t" style={{ height: `${(v / hourMax) * 100}%`, minHeight: 2 }} />
                <span className="text-[9px] text-[#8B9D8E]">{h}时</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-muted p-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-mono font-medium tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      {children}
    </section>
  );
}
