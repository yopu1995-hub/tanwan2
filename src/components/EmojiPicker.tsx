import { useRef, useState } from "react";
import { EMOJI_LIST } from "@/lib/emojis";
import { fileToIconDataURL } from "@/lib/image";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  emoji?: string;
  iconImage?: string;
  onChange: (next: { emoji?: string; iconImage?: string }) => void;
  /** show "no image / clear" button */
  allowClear?: boolean;
}

/** Compact emoji + SVG/image picker for category & product icons. */
export function EmojiPicker({ emoji, iconImage, onChange, allowClear = true }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = await fileToIconDataURL(f);
      onChange({ emoji: undefined, iconImage: url });
    } catch {
      toast.error("无法处理该图片");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="size-12 rounded-xl bg-muted flex items-center justify-center text-2xl overflow-hidden shrink-0">
          {iconImage ? (
            <img src={iconImage} alt="" className="w-full h-full object-contain" />
          ) : (
            <span>{emoji || "🏷️"}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs px-3 h-9 rounded-lg border border-dashed text-muted-foreground active:bg-muted/50"
        >
          <ImagePlus className="size-4" />
          {busy ? "处理中" : "上传 SVG/图片"}
        </button>
        {allowClear && (iconImage || emoji) && (
          <button
            type="button"
            onClick={() => onChange({ emoji: undefined, iconImage: undefined })}
            className="size-9 rounded-lg text-muted-foreground active:bg-muted inline-flex items-center justify-center"
            aria-label="清除"
          >
            <X className="size-4" />
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,image/svg+xml,.svg"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <div className="rounded-xl border bg-card p-2 max-h-44 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_LIST.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onChange({ emoji: e, iconImage: undefined })}
              className={`aspect-square rounded-md text-lg flex items-center justify-center active:bg-muted ${
                emoji === e && !iconImage ? "bg-primary/10 ring-1 ring-primary" : ""
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small inline category/product icon (emoji or uploaded image). */
export function IconBadge({
  emoji, iconImage, fallback = "🏷️", className = "",
}: { emoji?: string; iconImage?: string; fallback?: string; className?: string }) {
  if (iconImage) {
    return <img src={iconImage} alt="" className={`inline-block object-contain ${className || "size-4"}`} />;
  }
  return <span className={className}>{emoji || fallback}</span>;
}
