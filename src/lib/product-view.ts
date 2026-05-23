import { useCallback, useState } from "react";

export type ProductViewMode = "list" | "grid";

const STORAGE_KEY = "huatan_product_view";

export function readProductView(): ProductViewMode {
  if (typeof localStorage === "undefined") return "list";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "grid" ? "grid" : "list";
}

export function useProductView() {
  const [view, setViewState] = useState<ProductViewMode>(readProductView);

  const setView = useCallback((mode: ProductViewMode) => {
    setViewState(mode);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, mode);
    }
  }, []);

  return [view, setView] as const;
}
