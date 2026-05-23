import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Palette, Package, BarChart3 } from "lucide-react";

import appCss from "../styles.css?url";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

const MAIN_TAB_PATHS = ["/", "/products", "/stats"] as const;

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tabs = [
    { to: "/" as const, label: "集市", icon: Palette },
    { to: "/products" as const, label: "备货", icon: Package },
    { to: "/stats" as const, label: "统计", icon: BarChart3 },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 h-16 border-t border-[#E6EBE5] bg-white">
      <div className="app-shell !min-h-0 mx-auto flex h-full max-w-[28rem] items-stretch">
        {tabs.map(({ to, label, icon: Icon }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                active ? "text-[#4A7C59]" : "text-[#8B9D8E]",
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-medium text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#3D6B4A]"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-medium tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[#3D6B4A]"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "摊玩" },
      { name: "description", content: "摊主的集市管理与销售工具。" },
      { name: "theme-color", content: "#4A7C59" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "摊玩" },
      { name: "author", content: "摊玩" },
      { property: "og:title", content: "摊玩" },
      { property: "og:description", content: "摊主的集市管理与销售工具。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "摊玩" },
      { name: "twitter:description", content: "摊主的集市管理与销售工具。" },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ef7945e2-f2b4-4026-847e-5ca07ef8413d/id-preview-ba0e69c3--23dc971e-1d2f-4db7-bcff-772f59ff5438.lovable.app-1779428894604.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/ef7945e2-f2b4-4026-847e-5ca07ef8413d/id-preview-ba0e69c3--23dc971e-1d2f-4db7-bcff-772f59ff5438.lovable.app-1779428894604.png",
      },
    ],
    links: [
      {
        rel: "manifest",
        href: "/manifest.json",
      },
      {
        rel: "icon",
        href: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        rel: "icon",
        href: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "apple-touch-icon",
        href: "/icon-192.png",
        sizes: "192x192",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBottomNav = (MAIN_TAB_PATHS as readonly string[]).includes(pathname);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineIndicator />
      <Outlet />
      {showBottomNav && <BottomNav />}
      <PwaInstallBanner />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
