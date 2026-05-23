import { useMemo, useRef, useState } from "react";
import { LayoutGrid, LayoutList, Mic, Pencil, Search, Trash2 } from "lucide-react";
import type { Category, PaymentMethod, Product } from "@/lib/store";
import { productUnitCost } from "@/lib/store";
import { type ProductViewMode, useProductView } from "@/lib/product-view";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { GRID_COLS_CLASS, useGridColumns, type GridColumnCount } from "@/hooks/useGridColumns";
import { IconBadge } from "@/components/EmojiPicker";
import { SaleConfirmDialog } from "@/components/SaleConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ProductCatalogItem {
  product: Product;
  categories: Category[];
  eventId?: string;
  eventName?: string;
}

export type ProductCatalogMode = "inventory" | "sale";

function categoryLabel(cats: Category[], id: string): Category {
  return cats.find((c) => c.id === id) ?? { id, name: "未分类", emoji: "📦" };
}

export function ProductViewToggle({
  view,
  onChange,
  className,
}: {
  view: ProductViewMode;
  onChange: (mode: ProductViewMode) => void;
  className?: string;
}) {
  const isList = view === "list";
  return (
    <button
      type="button"
      onClick={() => onChange(isList ? "grid" : "list")}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[#E6EBE5] bg-white text-[#8B9D8E] hover:bg-[#EDF3EE] hover:text-[#4A7C59] transition-colors",
        className,
      )}
      aria-label={isList ? "切换到瀑布流视图" : "切换到列表视图"}
      title={isList ? "瀑布流视图" : "列表视图"}
    >
      {isList ? <LayoutGrid className="size-4" /> : <LayoutList className="size-4" />}
    </button>
  );
}

function GridColumnsSlider({
  columns,
  onChange,
}: {
  columns: GridColumnCount;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <LayoutGrid
        className={cn("text-[#8B9D8E] transition-all", columns <= 2 ? "size-4" : "size-3")}
        strokeWidth={1.75}
      />
      <input
        type="range"
        min={1}
        max={4}
        step={1}
        value={columns}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 h-1 accent-[#4A7C59] cursor-pointer"
        aria-label="瀑布流列数"
      />
      <span className="text-[10px] text-[#8B9D8E] tabular-nums w-3">{columns}</span>
    </div>
  );
}

function CatalogSearchMic({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const isListeningRef = useRef(false);
  const speech = useSpeechRecognition({ onResult: onTranscript });

  const handleDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || speech.isBusy) return;
    isListeningRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    void speech.startListening();
  };

  const handleUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    speech.stopListening();
  };

  return (
    <button
      type="button"
      disabled={disabled || speech.status === "processing"}
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
      onPointerCancel={handleUp}
      className={cn(
        "size-7 shrink-0 rounded-full border border-[#E6EBE5] bg-white text-[#8B9D8E] inline-flex items-center justify-center touch-none select-none",
        speech.status === "listening" && "bg-[#4A7C59] text-white border-[#4A7C59] animate-pulse",
      )}
      aria-label="按住语音搜索"
    >
      <Mic className="size-3.5" />
    </button>
  );
}

function ProductGridCard({
  item,
  columns,
  showEventName,
  compact,
  showCost,
  stockLabel,
  soldOut,
  returned,
  onPrimaryClick,
  onEdit,
}: {
  item: ProductCatalogItem;
  columns: GridColumnCount;
  showEventName?: boolean;
  compact: boolean;
  showCost?: boolean;
  stockLabel: string;
  soldOut?: boolean;
  returned?: boolean;
  onPrimaryClick: () => void;
  onEdit?: () => void;
}) {
  const { product: p, categories } = item;
  const cat = categoryLabel(categories, p.categoryId);
  const cover = p.images?.[0];
  const unitCost = productUnitCost(p);
  const disabled = soldOut || returned;

  return (
    <article
      className={cn(
        "bg-white border border-[#E6EBE5] rounded-xl p-0 overflow-hidden shadow-sm flex flex-col",
        disabled && "opacity-60",
      )}
    >
      <div className="relative p-2 pb-0">
        <button
          type="button"
          onClick={onPrimaryClick}
          disabled={disabled && !onEdit}
          className="block w-full text-left"
        >
          <div className="relative w-full aspect-square rounded-lg bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-3xl">
            {cover ? (
              <img src={cover} alt={p.name} className="w-full h-full object-cover" />
            ) : (
              <span className={cn(columns >= 3 ? "text-2xl" : "text-3xl")}>{p.emoji || cat.emoji || "📦"}</span>
            )}
            {soldOut && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span className="text-white text-xs font-medium px-2 py-1 rounded-full bg-black/30">售罄</span>
              </div>
            )}
            {returned && !soldOut && (
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <span className="text-white text-xs font-medium">已收摊</span>
              </div>
            )}
          </div>
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="absolute bottom-1 right-1 size-7 rounded-full bg-white/95 border border-[#E6EBE5] text-[#8B9D8E] shadow-sm inline-flex items-center justify-center hover:text-[#4A7C59] z-10"
            aria-label="编辑商品"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      {!compact && (
        <div className="p-2.5 pt-2 flex-1 flex flex-col gap-1.5">
          {showEventName && item.eventName && (
            <p className="text-[10px] text-[#8B9D8E] truncate">{item.eventName}</p>
          )}
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded border border-[#E6EBE5] text-[#8B9D8E] inline-flex items-center gap-0.5 w-fit max-w-full">
            <IconBadge emoji={cat.emoji} iconImage={cat.iconImage} className="size-3 text-[10px]" />
            <span className="truncate">{cat.name}</span>
          </span>
          <h3 className="text-sm font-medium truncate text-[#2C3E30]">{p.name}</h3>
          <div className="flex items-baseline justify-between gap-2 mt-auto">
            <span className="text-[#4A7C59] font-mono text-sm font-medium tabular-nums">¥{p.price}</span>
            <span className="text-xs text-[#8B9D8E]">{stockLabel}</span>
          </div>
          {showCost && unitCost > 0 && (
            <p className="text-[10px] text-[#8B9D8E]">成本 ¥{unitCost}</p>
          )}
        </div>
      )}
    </article>
  );
}

function ProductListRow({
  item,
  showEventName,
  showCost,
  stockLabel,
  soldOut,
  returned,
  onPrimaryClick,
  onEdit,
  onDelete,
}: {
  item: ProductCatalogItem;
  showEventName?: boolean;
  showCost?: boolean;
  stockLabel: string;
  soldOut?: boolean;
  returned?: boolean;
  onPrimaryClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { product: p, categories } = item;
  const cat = categoryLabel(categories, p.categoryId);
  const cover = p.images?.[0];
  const unitCost = productUnitCost(p);
  const disabled = soldOut || returned;

  return (
    <li
      className={cn(
        "rounded-xl border border-[#E6EBE5] bg-white shadow-sm p-3 flex items-center gap-3",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onPrimaryClick}
        disabled={disabled && !onEdit}
        className="flex-1 flex items-center gap-3 min-w-0 text-left"
      >
        <div className="relative size-14 shrink-0 rounded-xl border border-[#E6EBE5] bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-xl">
          {cover ? (
            <img src={cover} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            (p.emoji || cat.emoji || "📦")
          )}
          {soldOut && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center text-[10px] text-white font-medium">
              售罄
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          {showEventName && item.eventName && (
            <p className="text-[10px] text-[#8B9D8E] truncate mb-0.5">{item.eventName}</p>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#E6EBE5] text-[#8B9D8E] inline-flex items-center gap-1 shrink-0">
              <IconBadge emoji={cat.emoji} iconImage={cat.iconImage} className="size-3 text-[10px]" /> {cat.name}
            </span>
            <span className="font-medium truncate">{p.name}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>
              ¥{p.price} · {stockLabel}
            </span>
            {showCost && unitCost > 0 && <span>成本 ¥{unitCost}</span>}
          </div>
        </div>
      </button>
      {onEdit && (
        <button type="button" onClick={onEdit} className="p-2 text-muted-foreground shrink-0">
          <Pencil className="size-4" />
        </button>
      )}
      {onDelete && (
        <button type="button" onClick={onDelete} className="p-2 text-[#8B9D8E] hover:text-foreground shrink-0">
          <Trash2 className="size-4" />
        </button>
      )}
    </li>
  );
}

export function ProductCatalogView({
  items,
  mode = "sale",
  emptyMessage = "这里还没有商品",
  showEventName = false,
  showCost = false,
  saleEnabled = true,
  returned = false,
  getStockLabel,
  onItemClick,
  onEdit,
  onDelete,
  onRecordSale,
}: {
  items: ProductCatalogItem[];
  mode?: ProductCatalogMode;
  emptyMessage?: string;
  showEventName?: boolean;
  showCost?: boolean;
  saleEnabled?: boolean;
  returned?: boolean;
  getStockLabel?: (product: Product) => string;
  onItemClick?: (item: ProductCatalogItem) => void;
  onEdit?: (item: ProductCatalogItem) => void;
  onDelete?: (item: ProductCatalogItem) => void;
  onRecordSale?: (item: ProductCatalogItem, qty: number, payment: PaymentMethod) => boolean;
}) {
  const [view, setView] = useProductView();
  const { columns, setColumns, gridTouchHandlers } = useGridColumns();
  const [searchQuery, setSearchQuery] = useState("");
  const [saleItem, setSaleItem] = useState<ProductCatalogItem | null>(null);

  const isInventory = mode === "inventory";
  const canSale = mode === "sale" && saleEnabled && !!onRecordSale && !returned;

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.product.name.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const compactGrid = columns >= 3;

  const stockLabelFor = (p: Product) => {
    if (getStockLabel) return getStockLabel(p);
    return p.stock <= 0 ? "售罄" : `库存 ${p.stock}`;
  };

  const handlePrimaryClick = (item: ProductCatalogItem) => {
    if (isInventory) {
      onItemClick?.(item);
      return;
    }
    if (!canSale) return;
    const p = item.product;
    if (p.stock <= 0) {
      toast.error("商品已售罄");
      return;
    }
    setSaleItem(item);
  };

  const handleSpeechSearch = (text: string) => {
    setSearchQuery((prev) => {
      const t = text.trim();
      if (!t) return prev;
      const p = prev.trim();
      return p ? `${p} ${t}` : t;
    });
  };

  if (items.length === 0) {
    return <p className="text-center text-sm text-muted-foreground py-10">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-[#E6EBE5] rounded-lg h-9 px-3 min-w-0">
          <Search className="size-4 text-[#8B9D8E] shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索商品名称"
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-[#8B9D8E]"
          />
          <CatalogSearchMic onTranscript={handleSpeechSearch} />
        </div>
        {view === "grid" && <GridColumnsSlider columns={columns} onChange={setColumns} />}
        <ProductViewToggle view={view} onChange={setView} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-[#8B9D8E] py-10">未找到匹配商品</p>
      ) : view === "grid" ? (
        <div className={cn("grid gap-3", GRID_COLS_CLASS[columns])} {...gridTouchHandlers}>
          {filtered.map((item) => (
            <ProductGridCard
              key={`${item.eventId ?? ""}-${item.product.id}`}
              item={item}
              columns={columns}
              showEventName={showEventName}
              compact={compactGrid}
              showCost={showCost}
              stockLabel={stockLabelFor(item.product)}
              soldOut={!isInventory && item.product.stock <= 0}
              returned={returned}
              onPrimaryClick={() => handlePrimaryClick(item)}
              onEdit={
                isInventory
                  ? () => onItemClick?.(item)
                  : onEdit
                    ? () => onEdit(item)
                    : undefined
              }
            />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((item) => (
            <ProductListRow
              key={`${item.eventId ?? ""}-${item.product.id}`}
              item={item}
              showEventName={showEventName}
              showCost={showCost}
              stockLabel={stockLabelFor(item.product)}
              soldOut={!isInventory && item.product.stock <= 0}
              returned={returned}
              onPrimaryClick={() => handlePrimaryClick(item)}
              onEdit={
                isInventory
                  ? () => onItemClick?.(item)
                  : onEdit
                    ? () => onEdit(item)
                    : undefined
              }
              onDelete={onDelete ? () => onDelete(item) : undefined}
            />
          ))}
        </ul>
      )}

      {canSale && (
        <SaleConfirmDialog
          open={!!saleItem}
          onOpenChange={(o) => !o && setSaleItem(null)}
          item={saleItem}
          onConfirm={(qty, payment) => {
            if (!saleItem) return false;
            return onRecordSale!(saleItem, qty, payment);
          }}
        />
      )}
    </>
  );
}
