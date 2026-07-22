import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Changer le mot de passe · Nida'a M2S" }] }),
});

function ResetPasswordPage() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pwd.length < 8) return setError("Le mot de passe doit contenir au moins 8 caractères.");
    if (pwd !== confirm) return setError("Les deux mots de passe ne correspondent pas.");
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: pwd });
      if (updErr) throw updErr;
      if (user) {
        const { error: profErr } = await supabase
          .from("profiles")
          .update({ must_reset_password: false, status: "actif" })
          .eq("id", user.id);
        if (profErr) throw profErr;
      }
      await refreshProfile();
      toast.success("Mot de passe mis à jour");
      navigate({ to: "/chargement" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-sidebar flex items-center justify-center text-lg font-bold text-white shadow-md">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="mt-3 text-center">
            <div className="text-lg font-semibold text-foreground">Première connexion</div>
            <div className="text-xs text-muted-foreground">
              Merci de définir votre mot de passe personnel.
            </div>
          </div>
        </div>

        <Card className="p-6 space-y-5">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Nouveau mot de passe</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmer le mot de passe</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error && (
              <div className="rounded-md bg-critical/10 text-critical text-sm px-3 py-2">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Valider mon mot de passe
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
