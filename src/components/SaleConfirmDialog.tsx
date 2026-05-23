import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import type { PaymentMethod } from "@/lib/store";
import { PAYMENT_LABEL } from "@/lib/store";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { ProductCatalogItem } from "@/components/ProductCatalogView";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS: PaymentMethod[] = ["wechat", "alipay", "cash", "other"];

function categoryLabel(item: ProductCatalogItem) {
  const cat = item.categories.find((c) => c.id === item.product.categoryId);
  return cat ?? { id: "", name: "未分类", emoji: "📦" };
}

export function SaleConfirmDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ProductCatalogItem | null;
  onConfirm: (qty: number, payment: PaymentMethod) => boolean;
}) {
  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<PaymentMethod>("wechat");

  const product = item?.product;
  const maxStock = product?.stock ?? 0;
  const total = product ? product.price * qty : 0;

  useEffect(() => {
    if (open && product) {
      setQty(1);
      setPayment("wechat");
    }
  }, [open, product?.id]);

  if (!product || !item) return null;

  const cat = categoryLabel(item);
  const cover = product.images?.[0];

  const handleConfirm = () => {
    if (onConfirm(qty, payment)) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-[#E6EBE5] p-4 gap-3">
        <div className="w-full max-h-48 shrink-0 rounded-lg bg-[#EDF3EE] overflow-hidden flex items-center justify-center text-5xl">
          {cover ? (
            <img src={cover} alt={product.name} className="max-h-48 w-full object-contain" />
          ) : (
            <span className="py-8">{product.emoji || cat.emoji || "📦"}</span>
          )}
        </div>

        <h3 className="font-medium text-[#2C3E30]">{product.name}</h3>
        <p className="text-[#4A7C59] font-mono text-lg font-medium tabular-nums mt-0.5">¥{product.price}</p>

        <div className="flex items-center justify-center gap-4 my-4">
          <button
            type="button"
            disabled={qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="size-10 rounded-xl border border-[#E6EBE5] bg-white text-[#2C3E30] inline-flex items-center justify-center disabled:opacity-40"
            aria-label="减少数量"
          >
            <Minus className="size-4" />
          </button>
          <span className="text-xl font-mono font-medium tabular-nums w-10 text-center">{qty}</span>
          <button
            type="button"
            disabled={qty >= maxStock}
            onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
            className="size-10 rounded-xl border border-[#E6EBE5] bg-white text-[#2C3E30] inline-flex items-center justify-center disabled:opacity-40"
            aria-label="增加数量"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <p className="text-center text-xs text-[#8B9D8E] mb-3">出摊库存 {maxStock} 件</p>

        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayment(m)}
              className={cn(
                "rounded-lg py-2 text-xs font-medium transition-colors",
                payment === m
                  ? "bg-[#4A7C59] text-white"
                  : "border border-[#E6EBE5] bg-white text-[#2C3E30]",
              )}
            >
              {PAYMENT_LABEL[m]}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={maxStock <= 0}
          onClick={handleConfirm}
          className="w-full h-11 rounded-lg bg-[#4A7C59] text-white font-medium disabled:opacity-50"
        >
          确认收款 ¥{Math.round(total * 100) / 100}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full mt-2 py-2 text-sm text-[#8B9D8E]"
        >
          取消
        </button>
      </DialogContent>
    </Dialog>
  );
}
