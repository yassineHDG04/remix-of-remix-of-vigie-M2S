import nidaaLogo from "@/assets/nidaa-m2s-logo.png.asset.json";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";

import {
  AlertOctagon,
  Calendar as CalendarIcon,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings as SettingsIcon,
  User as UserIcon,
  Users,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  adminOnly?: boolean;
};
const NAV: NavItem[] = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true },
  { to: "/critiques", label: "Dossiers critiques", icon: AlertOctagon },
  { to: "/calendrier", label: "Calendrier", icon: CalendarIcon },
  { to: "/valides", label: "Dossiers validés", icon: CheckCircle2 },
  { to: "/superviseurs", label: "Superviseurs", icon: Users, adminOnly: true },
  { to: "/parametres", label: "Paramètres", icon: SettingsIcon },
];

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Tableau de bord";
  if (pathname.startsWith("/critiques")) return "Dossiers critiques";
  if (pathname.startsWith("/calendrier")) return "Calendrier";
  if (pathname.startsWith("/valides")) return "Dossiers validés";
  if (pathname.startsWith("/superviseurs")) return "Superviseurs";
  if (pathname.startsWith("/parametres")) return "Paramètres";
  if (pathname.startsWith("/profil")) return "Mon profil";
  if (pathname.startsWith("/dossiers")) return "Détail dossier";
  if (pathname.startsWith("/appels")) return "Détail appel";
  return "Nida'a M2S";
}

function NavLinks({
  pathname,
  onNavigate,
  isAdmin,
}: {
  pathname: string;
  onNavigate?: () => void;
  isAdmin: boolean;
}) {
  return (
    <>
      {NAV.filter((i) => !i.adminOnly || isAdmin).map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to as "/"}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-white/80 hover:bg-sidebar-accent hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </>
  );
}

function ProfileBlock({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
  const { user } = useAuth();
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();
  return (
    <div className="border-t border-sidebar-border p-3 space-y-1">
      <Link
        to="/profil"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors"
      >
        <div className="h-9 w-9 rounded-full bg-accent flex items-center justify-center text-sm font-semibold text-accent-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{user?.name ?? "—"}</div>
          <div className="text-[11px] text-white/60 truncate">{user?.role ?? ""}</div>
        </div>
        <UserIcon className="h-4 w-4 text-white/60" />
      </Link>
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-sidebar-accent hover:text-white transition-colors"
      >
        <LogOut className="h-4 w-4" /> Déconnexion
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { logout, user, profile: _profile } = useAuth();
  const isAdmin = user?.role === "Admin";
  void _profile;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const handleLogout = () => {
    logout();
    toast.success("Déconnexion réussie");
    navigate({ to: "/login" });
  };

  const handleRefresh = () => {
    qc.invalidateQueries();
    toast.success("Données actualisées");
  };

  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen w-full flex bg-surface text-foreground">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 bg-sidebar text-sidebar-foreground sticky top-0 h-screen self-start overflow-y-auto">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-sidebar-border">
          <img
            src={nidaaLogo.url}
            alt="Nida'a M2S"
            className="h-11 w-11 rounded-lg bg-white/95 object-contain p-1 shadow-sm"
          />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight truncate">Nida'a M2S</div>
            <div className="text-[11px] text-white/60 leading-tight truncate">
              Voicebot Assistant
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLinks pathname={pathname} isAdmin={isAdmin} />
        </nav>
        <ProfileBlock onLogout={handleLogout} />
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre supérieure mobile */}
        <div className="md:hidden h-14 bg-sidebar text-sidebar-foreground flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img
              src={nidaaLogo.url}
              alt="Nida'a M2S"
              className="h-8 w-8 rounded-lg bg-white/95 object-contain p-0.5"
            />
            <div className="text-sm font-semibold">Nida'a M2S</div>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className="p-2 rounded-md hover:bg-sidebar-accent"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-sidebar text-sidebar-foreground border-r-0 p-0 w-64 flex flex-col"
            >
              <div className="px-4 py-4 flex items-center gap-3 border-b border-sidebar-border">
                <img
                  src={nidaaLogo.url}
                  alt="Nida'a M2S"
                  className="h-11 w-11 rounded-lg bg-white/95 object-contain p-1"
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">Nida'a M2S</div>
                  <div className="text-[11px] text-white/60 truncate">Voicebot Assistant</div>
                </div>
              </div>

              <nav className="flex-1 px-3 py-4 space-y-1">
                <NavLinks pathname={pathname} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
              </nav>
              <ProfileBlock
                onLogout={() => {
                  setOpen(false);
                  handleLogout();
                }}
              />
            </SheetContent>
          </Sheet>
        </div>

        <header className="h-14 bg-background border-b border-border flex items-center justify-between px-4 md:px-6">
          <h1 className="text-base font-semibold text-foreground">{pageTitle(pathname)}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="h-9 w-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              title="Actualiser"
              aria-label="Actualiser"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border ml-1">
              <div className="text-right leading-tight">
                <div className="text-xs font-medium text-foreground">{user?.name}</div>
                <div className="text-[10px] text-muted-foreground">{user?.role}</div>
              </div>
              <div className="h-8 w-8 rounded-full bg-navy flex items-center justify-center text-xs font-semibold text-navy-foreground">
                {initial}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
