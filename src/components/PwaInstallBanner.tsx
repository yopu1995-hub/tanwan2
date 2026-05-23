import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";

const DISMISS_KEY = "pwa-install-banner-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIos()) {
      setShowIosHint(true);
      setVisible(true);
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const isMobile = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      setVisible(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-16 z-[60] px-3 pb-2"
      role="region"
      aria-label="添加到主屏幕引导"
    >
      <div className="app-shell mx-auto max-w-[28rem]">
        <div className="flex items-start gap-3 rounded-xl border border-[#E6EBE5] bg-white px-3 py-2.5 shadow-card">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EDF3EE] text-[#4A7C59]">
            {showIosHint ? <Share className="size-4" /> : <Smartphone className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[#2C3E30]">添加到桌面，离线也能用</p>
            {showIosHint && (
              <p className="mt-0.5 text-xs text-[#8B9D8E]">点击分享按钮 → 添加到主屏幕</p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-[#8B9D8E] transition-colors hover:bg-[#F7F9F6] hover:text-[#2C3E30]"
            aria-label="关闭引导"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
