import { useCallback, useRef, useState, type TouchEvent } from "react";

const STORAGE_KEY = "huatan_grid_columns";
const MIN_COLS = 1;
const MAX_COLS = 4;
const DEFAULT_COLS = 2;

export type GridColumnCount = 1 | 2 | 3 | 4;

export const GRID_COLS_CLASS: Record<GridColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

function readColumns(): GridColumnCount {
  if (typeof localStorage === "undefined") return DEFAULT_COLS;
  const n = Number(localStorage.getItem(STORAGE_KEY));
  if (n >= 1 && n <= 4) return n as GridColumnCount;
  return DEFAULT_COLS;
}

function clampColumns(n: number): GridColumnCount {
  return Math.min(MAX_COLS, Math.max(MIN_COLS, Math.round(n))) as GridColumnCount;
}

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

export function useGridColumns() {
  const [columns, setColumnsState] = useState<GridColumnCount>(readColumns);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const pinchRef = useRef<{ startDistance: number; startCols: GridColumnCount } | null>(null);

  const setColumns = useCallback((n: number) => {
    const next = clampColumns(n);
    setColumnsState(next);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(next));
    }
  }, []);

  const gridTouchHandlers = {
    onTouchStart: (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinchRef.current = {
          startDistance: touchDistance(e.touches),
          startCols: columnsRef.current,
        };
      }
    },
    onTouchMove: (e: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || e.touches.length < 2) return;
      const dist = touchDistance(e.touches);
      if (pinch.startDistance <= 0) return;
      const ratio = dist / pinch.startDistance;
      if (ratio < 0.75) {
        setColumns(pinch.startCols + 1);
        pinchRef.current = { startDistance: dist, startCols: columnsRef.current };
      } else if (ratio > 1.35) {
        setColumns(pinch.startCols - 1);
        pinchRef.current = { startDistance: dist, startCols: columnsRef.current };
      }
    },
    onTouchEnd: () => {
      pinchRef.current = null;
    },
    onTouchCancel: () => {
      pinchRef.current = null;
    },
  };

  return { columns, setColumns, gridTouchHandlers };
}
