import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-1.5 bg-[#F5E6A3] px-3 py-1.5 text-xs font-medium text-[#6B5B00]"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>当前为离线模式</span>
    </div>
  );
}
