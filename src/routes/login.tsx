import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import nidaaLogo from "@/assets/nidaa-m2s-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Connexion · Nida'a M2S" }] }),
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1a6.2 6.2 0 1 1 0-12.4c1.8 0 3 .78 3.7 1.4l2.5-2.4A9.6 9.6 0 0 0 12 2a10 10 0 1 0 0 20c5.77 0 9.6-4.06 9.6-9.77 0-.66-.07-1.16-.16-1.66H12z"
      />
    </svg>
  );
}

function LoginPage() {
  const { login, loginWithGoogle, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    try {
      const denied = sessionStorage.getItem("vigie:accessDenied");
      if (denied) {
        setError(denied);
        sessionStorage.removeItem("vigie:accessDenied");
      }
    } catch {
      /* ignore */
    }
    if (isReady && isAuthenticated) navigate({ to: "/" });
  }, [isReady, isAuthenticated, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Bienvenue sur Nida'a M2S");
      navigate({ to: "/chargement" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion Google impossible");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-surface px-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <img
            src={nidaaLogo.url}
            alt="Nida'a M2S"
            className="h-20 w-20 rounded-2xl bg-white object-contain p-2 shadow-md ring-1 ring-border"
          />
          <div className="mt-3 text-center">
            <div className="text-lg font-semibold text-foreground">Nida'a M2S</div>
            <div className="text-xs text-muted-foreground">Voicebot Assistant · Supervision IA</div>
          </div>
        </div>

        <Card className="p-6 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Connexion</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Accédez à la supervision des relances IA.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <span className="mr-2">
                <GoogleIcon />
              </span>
            )}
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-2 text-xs text-muted-foreground">ou par email</span>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="prenom@m2s.ma"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-critical/10 border border-critical/20 px-3 py-2 text-sm text-critical">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Se connecter
            </Button>
          </form>

          <div className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-4">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Accès réservé à l'équipe M2S.</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
