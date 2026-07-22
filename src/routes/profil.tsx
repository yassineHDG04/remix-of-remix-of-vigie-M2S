import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profil")({
  component: ProfilPage,
  head: () => ({ meta: [{ title: "Mon profil · Nida'a M2S" }] }),
});

function StatusBadge({ status }: { status: "actif" | "suspendu" | "invite" }) {
  const map: Record<string, { label: string; cls: string }> = {
    actif: { label: "Actif", cls: "bg-success/15 text-success" },
    suspendu: { label: "Suspendu", cls: "bg-critical/15 text-critical" },
    invite: { label: "Invité", cls: "bg-accent/15 text-accent" },
  };
  const m = map[status] ?? map.actif;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

function ProfilPage() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Mot de passe : 8 caractères minimum.");
    if (pwd !== confirm) return toast.error("Les mots de passe ne correspondent pas.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Mot de passe mis à jour");
      setPwd("");
      setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    toast.success("Déconnexion réussie");
    navigate({ to: "/login" });
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">Mon profil</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Email</dt>
            <dd className="mt-1 font-medium">{user?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Nom</dt>
            <dd className="mt-1 font-medium">{user?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Rôle</dt>
            <dd className="mt-1 font-medium">{user?.role ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Statut</dt>
            <dd className="mt-1">
              <StatusBadge status={profile?.status ?? "actif"} />
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">Changer mon mot de passe</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="np">Nouveau mot de passe</Label>
            <Input
              id="np"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp">Confirmation</Label>
            <Input
              id="cp"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Mettre à jour
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <Button variant="outline" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Déconnexion
        </Button>
      </Card>
    </div>
  );
}
