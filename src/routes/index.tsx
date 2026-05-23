import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, MapPin, Calendar, Palette, Trash2, BarChart3 } from "lucide-react";
import { getDailyGreeting } from "@/lib/greetings";
import { useStore, actions, eventNetRevenue, type MarketEvent } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "摊玩" },
      { name: "description", content: "摊主的集市管理与销售工具。" },
    ],
  }),
  component: Home,
});

function Home() {
  const events = useStore().events ?? [];
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dailyGreeting = getDailyGreeting();

  const handleEventCreated = (eventId: string) => {
    setOpen(false);
    navigate({ to: "/event/$id", params: { id: eventId } });
  };

  return (
    <div className="app-shell pb-36">
      <header className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-2 text-primary">
          <Palette className="size-4" />
          <h1 className="text-xs font-medium tracking-wide">摊玩</h1>
        </div>
        <p className="mt-2 text-3xl font-semibold leading-tight text-foreground">{dailyGreeting}</p>
      </header>

      <section className="px-4">
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs font-medium text-muted-foreground">我的集市</h2>
          <div className="flex items-center gap-3">
            {events.length > 1 && (
              <Link to="/compare" className="text-xs text-primary inline-flex items-center gap-1">
                <BarChart3 className="size-3" /> 对比
              </Link>
            )}
            <span className="text-xs text-muted-foreground">{events.length} 个活动</span>
          </div>
        </div>

        {events.length === 0 ? (
          <EmptyState onCreate={() => setOpen(true)} />
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id}>
                <EventCard event={ev} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-16 z-40">
        <div className="app-shell !min-h-0 mx-auto max-w-[28rem] px-4 pb-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-12 rounded-xl text-sm shadow-sm">
                <Plus className="size-4" /> 新建集市活动
              </Button>
            </DialogTrigger>
            <CreateEventDialog onDone={handleEventCreated} />
          </Dialog>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event: ev }: { event: MarketEvent }) {
  const revenue = eventNetRevenue(ev);

  return (
    <Link
      to="/event/$id"
      params={{ id: ev.id }}
      className="block rounded-xl border border-border bg-card p-3 shadow-sm active:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium truncate text-foreground">{ev.name}</h3>
          <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3 shrink-0" />
              {ev.date || "未设定日期"}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{ev.location || "未填写地点"}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (confirm(`删除「${ev.name}」？`)) actions.deleteEvent(ev.id);
          }}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 shrink-0"
          aria-label="删除活动"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="产品数量" value={ev.products.length} />
        <Stat label="销售总额" value={`¥${revenue}`} highlight />
      </div>
    </Link>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-muted py-2 text-center">
      <div className={`text-sm font-mono font-medium tabular-nums ${highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center shadow-sm">
      <div className="mx-auto size-12 rounded-xl bg-muted flex items-center justify-center text-xl">🎨</div>
      <h3 className="mt-4 text-base font-medium text-foreground">还没有集市活动</h3>
      <p className="mt-1 text-sm text-muted-foreground">创建第一个活动，开始记录销售吧。</p>
      <Button onClick={onCreate} variant="secondary" className="mt-4 h-10 rounded-xl">
        <Plus className="size-4" /> 立即创建
      </Button>
    </div>
  );
}

function CreateEventDialog({ onDone }: { onDone: (eventId: string) => void }) {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <DialogContent className="max-w-[92vw] rounded-xl border border-border bg-card shadow-sm">
      <DialogHeader>
        <DialogTitle className="text-base font-medium">新建集市</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label htmlFor="ev-name" className="text-xs text-muted-foreground">
            活动名称
          </Label>
          <Input
            id="ev-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：上海西岸艺术市集"
            className="mt-1.5 h-10 rounded-xl bg-white"
          />
        </div>
        <div>
          <Label htmlFor="ev-loc" className="text-xs text-muted-foreground">
            地点
          </Label>
          <Input
            id="ev-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例如：徐汇滨江"
            className="mt-1.5 h-10 rounded-xl bg-white"
          />
        </div>
        <div>
          <Label htmlFor="ev-date" className="text-xs text-muted-foreground">
            日期
          </Label>
          <Input
            id="ev-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1.5 h-10 rounded-xl bg-white"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          className="w-full h-10 rounded-xl"
          disabled={!name.trim()}
          onClick={() => {
            const ev = actions.createEvent({ name: name.trim(), location: location.trim(), date });
            onDone(ev.id);
          }}
        >
          创建
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
