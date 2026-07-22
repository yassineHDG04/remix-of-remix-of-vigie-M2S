import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/chargement")({
  component: LoadingScreen,
  head: () => ({ meta: [{ title: "Chargement · Nida'a M2S" }] }),
});

function LoadingScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      sessionStorage.removeItem("vigie:justSignedIn");
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => navigate({ to: "/" }), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-sidebar text-white">
      <Loader2 className="h-14 w-14 animate-spin text-accent mb-6" />
      <div className="text-lg font-medium">Chargement de votre espace…</div>
      <div className="text-sm text-white/60 mt-2">Nida'a M2S · Voicebot Assistant</div>
    </div>
  );
}
