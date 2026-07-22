import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Retour à l'accueil
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
      { title: "Nida2 Voicebot Center - M2S" },
      {
        name: "description",
        content:
          "Supervision temps réel des relances IA sur les dossiers de sinistre en retard chez M2S .",
      },
      { property: "og:title", content: "Nida2 Voicebot Center - M2S" },
      {
        property: "og:description",
        content:
          "Supervision temps réel des relances IA sur les dossiers de sinistre en retard chez M2S .",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nida2 Voicebot Center - M2S" },
      {
        name: "twitter:description",
        content:
          "Supervision temps réel des relances IA sur les dossiers de sinistre en retard chez M2S .",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5edf8ec8-eea8-4b86-96b0-4a37813ba951",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5edf8ec8-eea8-4b86-96b0-4a37813ba951",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady, profile, hasAccess, logout } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const isLogin = pathname === "/login";
  const isReset = pathname === "/reset-password";
  const isLoading = pathname === "/chargement";
  const fullscreen = isLogin || isReset || isLoading;

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated && !isLogin) {
      navigate({ to: "/login" });
      return;
    }
    // Utilisateur authentifié mais sans rôle : accès refusé, déconnexion immédiate.
    if (isAuthenticated && !hasAccess) {
      try {
        sessionStorage.setItem(
          "vigie:accessDenied",
          "Accès refusé. Contactez l'administrateur pour obtenir un accès.",
        );
      } catch {
        /* ignore */
      }
      void logout().finally(() => navigate({ to: "/login" }));
      return;
    }
    // Compte suspendu : forcer la déconnexion immédiate.
    if (isAuthenticated && profile && profile.status !== "actif" && profile.status !== "invite") {
      void logout().finally(() => navigate({ to: "/login" }));
      return;
    }
    if (isAuthenticated && isLogin) {
      navigate({ to: "/chargement" });
      return;
    }
    if (isAuthenticated && profile?.mustResetPassword && !isReset && !isLoading) {
      navigate({ to: "/reset-password" });
      return;
    }
    // Écran de chargement obligatoire après une connexion réussie.
    let justSignedIn = false;
    try {
      justSignedIn = sessionStorage.getItem("vigie:justSignedIn") === "1";
    } catch {
      /* ignore */
    }
    if (isAuthenticated && justSignedIn && !isLoading && !isReset) {
      navigate({ to: "/chargement" });
    }
  }, [
    isReady,
    isAuthenticated,
    hasAccess,
    isLogin,
    isReset,
    isLoading,
    profile,
    pathname,
    navigate,
    logout,
  ]);

  if (!isReady) return <div className="min-h-screen bg-surface" />;
  if (fullscreen) return <>{children}</>;
  if (!isAuthenticated) return <div className="min-h-screen bg-surface" />;
  return <AppShell>{children}</AppShell>;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate>
          <Outlet />
        </AuthGate>
      </AuthProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
