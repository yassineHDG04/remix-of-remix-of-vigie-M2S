import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  onRetry?: () => void;
  title?: string;
  message?: string;
}

export function ErrorState({
  onRetry,
  title = "Service indisponible",
  message = "Impossible de joindre le serveur. Réessaie dans un instant.",
}: Props) {
  return (
    <Card className="max-w-md mx-auto p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-critical/10 flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6 text-critical" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Réessayer
        </Button>
      )}
    </Card>
  );
}
