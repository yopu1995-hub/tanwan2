import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Package, Plus, X } from "lucide-react";
import {
  useStore,
  actions,
  DEFAULT_CATEGORIES,
  type Product,
  type Category,
  type MarketEvent,
  productUnitCost,
} from "@/lib/store";
import { ProductCatalogView } from "@/components/ProductCatalogView";
import { EmojiPicker, IconBadge } from "@/components/EmojiPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fileToCompressedDataURL } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "备货 — 摊玩" }] }),
  component: ProductsPage,
});

function countActiveStallEvents(productId: string, events: MarketEvent[]) {
  return events.filter(
    (e) => !e.returned && e.products.some((p) => p.id === productId && p.stock > 0),
  ).length;
}

function ProductsPage() {
  const { catalog, events } = useStore();
  const categories = events[0]?.categories ?? DEFAULT_CATEGORIES;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const isNew = dialogOpen && !editing;

  const catalogItems = useMemo(
    () =>
      catalog.map((product) => ({
        product,
        categories,
      })),
    [catalog, categories],
  );

  const totalStock = catalog.reduce((s, p) => s + p.totalStock, 0);
  const inventoryValue = useMemo(
    () => catalog.reduce((s, p) => s + p.totalStock * p.price, 0),
    [catalog],
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    const stallCount = countActiveStallEvents(product.id, events);
    const msg =
      stallCount > 0
        ? `该商品正在 ${stallCount} 个集市出摊中，确定删除？`
        : `确定删除「${product.name}」？`;
    if (!confirm(msg)) return;
    actions.deleteCatalogItem(product.id);
    toast.success("已删除");
  };

  return (
    <div className="app-shell pb-20">
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Package className="size-4" />
            <span className="text-xs tracking-wide">备货管理</span>
          </div>
          <Button onClick={openCreate} size="sm" className="h-9 rounded-xl text-xs shrink-0">
            <Plus className="size-3.5" /> 添加商品
          </Button>
        </div>
        <h1 className="mt-1 text-base font-medium text-foreground">商品备货</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全局商品池 {catalog.length} 款 · 总备货 {totalStock} 件
        </p>
      </header>

      <main className="px-4 space-y-3">
        <div className="rounded-xl border border-[#E6EBE5] bg-white p-3 shadow-sm">
          <p className="text-xs text-[#8B9D8E]">总库存价值</p>
          <p className="mt-0.5 text-lg font-mono font-semibold tabular-nums text-[#4A7C59]">
            ¥{Math.round(inventoryValue * 100) / 100}
          </p>
          <p className="mt-1 text-[10px] text-[#8B9D8E]">按 总库存 × 售价 汇总</p>
        </div>

        {catalogItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
            <Package className="size-10 mx-auto text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-muted-foreground">还没有商品</p>
            <Button onClick={openCreate} variant="secondary" className="mt-4 h-10 rounded-xl">
              <Plus className="size-4" /> 添加第一件商品
            </Button>
          </div>
        ) : (
          <ProductCatalogView
            mode="inventory"
            items={catalogItems}
            showCost
            emptyMessage="还没有商品"
            getStockLabel={(p) => `总库存 ${p.totalStock}`}
            onItemClick={(item) => openEdit(item.product)}
            onDelete={(item) => handleDelete(item.product)}
          />
        )}
      </main>

      <CatalogProductDialog
        product={editing}
        isNew={isNew}
        categories={categories}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onDone={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function CatalogProductDialog({
  product,
  isNew,
  categories,
  open,
  onOpenChange,
  onDone,
}: {
  product: Product | null;
  isNew: boolean;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [totalStock, setTotalStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [emoji, setEmoji] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [material, setMaterial] = useState("");
  const [labor, setLabor] = useState("");
  const [other, setOther] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const resetForm = (p: Product | null) => {
    setName(p?.name ?? "");
    setPrice(p?.price?.toString() ?? "");
    setTotalStock((p?.totalStock ?? 0).toString());
    setCategoryId(p?.categoryId ?? categories[0]?.id ?? "");
    setEmoji(p?.emoji ?? "");
    setImages(p?.images ?? []);
    setMaterial(p?.materialCost?.toString() ?? "");
    setLabor(p?.laborCost?.toString() ?? "");
    setOther(p?.otherCost?.toString() ?? "");
  };

  useEffect(() => {
    if (open) resetForm(isNew ? null : product);
  }, [open, isNew, product?.id, categories]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const results: string[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        try {
          results.push(await fileToCompressedDataURL(f));
        } catch {
          toast.error(`无法处理 ${f.name}`);
        }
      }
      setImages((prev) => [...prev, ...results].slice(0, 8));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = () => {
    const meta = {
      name: name.trim(),
      price: Number(price) || 0,
      totalStock: Number(totalStock) || 0,
      stock: 0,
      categoryId,
      emoji: emoji.trim() || undefined,
      images,
      materialCost: Number(material) || 0,
      laborCost: Number(labor) || 0,
      otherCost: Number(other) || 0,
    };
    if (!meta.name || !meta.categoryId) {
      toast.error("请填写名称并选择分类");
      return;
    }
    if (isNew) {
      actions.addToCatalog(meta);
      toast.success("已添加到商品池");
    } else if (product) {
      actions.updateCatalogItem(product.id, meta);
      toast.success("已保存");
    }
    onDone();
  };

  const costPreview = productUnitCost({
    id: "",
    name: "",
    price: Number(price) || 0,
    stock: 0,
    totalStock: 0,
    categoryId: "",
    materialCost: Number(material) || 0,
    laborCost: Number(labor) || 0,
    otherCost: Number(other) || 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-[#E6EBE5] p-4 gap-3">
        <DialogHeader className="shrink-0 space-y-0">
          <DialogTitle className="text-base font-medium">{isNew ? "添加商品" : "编辑商品"}</DialogTitle>
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
                    categoryId === c.id
                      ? "border-[#4A7C59] bg-[#EDF3EE] text-foreground"
                      : "border-[#E6EBE5] text-[#8B9D8E]"
                  }`}
                >
                  <IconBadge emoji={c.emoji} iconImage={c.iconImage} className="size-4 text-sm" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="cp-name">名称</Label>
            <Input id="cp-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cp-price">售价 (¥)</Label>
              <Input
                id="cp-price"
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="cp-total">总备货</Label>
              <Input
                id="cp-total"
                type="number"
                inputMode="numeric"
                value={totalStock}
                onChange={(e) => setTotalStock(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>成本核算 (每件)</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <Input
                type="number"
                inputMode="decimal"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="物料"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={labor}
                onChange={(e) => setLabor(e.target.value)}
                placeholder="人力"
              />
              <Input
                type="number"
                inputMode="decimal"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                placeholder="其他"
              />
            </div>
            {costPreview > 0 && (
              <p className="mt-1.5 text-xs text-[#8B9D8E]">单件成本 ¥{costPreview}</p>
            )}
          </div>
          <div>
            <Label>商品图片 ({images.length}/8)</Label>
            <div className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-[#E6EBE5]/60 p-2">
              <div className="grid grid-cols-4 gap-2">
                {images.map((src, i) => (
                  <div
                    key={i}
                    className="relative aspect-square max-h-20 rounded-lg overflow-hidden border border-[#E6EBE5] bg-[#EDF3EE]"
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 size-5 rounded-full bg-[#4A7C59]/60 text-white inline-flex items-center justify-center"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {images.length < 8 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="aspect-square max-h-20 rounded-lg border border-dashed border-[#E6EBE5] flex flex-col items-center justify-center gap-1 text-[#8B9D8E]"
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
            <Label>图标</Label>
            <div className="mt-1.5">
              <EmojiPicker emoji={emoji} onChange={(n) => setEmoji(n.emoji ?? "")} allowClear />
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 pt-1 sm:justify-stretch">
          <Button onClick={save} disabled={!name.trim()} className="w-full h-10 rounded-xl">
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
