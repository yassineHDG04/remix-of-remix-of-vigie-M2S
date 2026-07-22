import { CALL_STATUS_LABEL, type CallStatus } from "@/data/types";
import { cn } from "@/lib/utils";

const STYLES: Record<CallStatus, string> = {
  en_cours: "bg-blue-soft text-accent",
  pris: "bg-success/10 text-success",
  non_joignable: "bg-muted text-muted-foreground",
  repondeur: "bg-blue-soft text-accent",
  refus: "bg-warning/10 text-warning",
  echec: "bg-critical/10 text-critical",
};

export function CallStatusBadge({ status, className }: { status: CallStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[status],
        className,
      )}
    >
      {CALL_STATUS_LABEL[status]}
    </span>
  );
}

interface StageBadgeProps {
  stage: number;
  /** Si présent, le dossier est en hand-off humain (prioritaire sur `stage`). */
  handoffReason?: string | null;
  /** Nombre total de relances IA configurées (pour afficher « n°X / N »). */
  nbRelancesIa?: number;
}

export function StageBadge({ stage, handoffReason, nbRelancesIa }: StageBadgeProps) {
  if (handoffReason) {
    return (
      <span className="inline-flex items-center rounded-full bg-critical/10 px-2 py-0.5 text-xs font-semibold text-critical">
        Humain
      </span>
    );
  }
  if (!stage || stage < 1) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        En attente
      </span>
    );
  }
  const suffix = nbRelancesIa ? ` / ${nbRelancesIa}` : "";
  return (
    <span className="inline-flex items-center rounded-full bg-blue-soft px-2 py-0.5 text-xs font-semibold text-accent">
      Relance IA n°{stage}
      {suffix}
    </span>
  );
}
