import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { TimeRemainingBadge } from "@/components/TimeRemainingBadge";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDossiers, useKpi } from "@/lib/hooks";
import { pageNumbers } from "@/routes/superviseurs";

const PAGE_SIZE = 25;

export const Route = createFileRoute("/critiques")({
  component: Critiques,
  head: () => ({ meta: [{ title: "Dossiers critiques · Nida'a M2S" }] }),
});

function BigStat({
  label,
  value,
  tone = "default",
  loading,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "critical" | "success" | "accent";
  loading?: boolean;
}) {
  const tones = {
    default: "text-foreground",
    critical: "text-critical",
    success: "text-success",
    accent: "text-accent",
  } as const;
  return (
    <Card className="p-6">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-4 h-10 w-20" />
      ) : (
        <div className={`mt-3 text-5xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      )}
    </Card>
  );
}

function Critiques() {
  const dossiersQ = useDossiers("en_retard");
  const kpiQ = useKpi();
  const [page, setPage] = useState(1);

  if (dossiersQ.isError && !dossiersQ.data) {
    return (
      <ErrorState
        onRetry={() => {
          dossiersQ.refetch();
          kpiQ.refetch();
        }}
      />
    );
  }
  const actifs = dossiersQ.data ?? [];
  const kpi = kpiQ.data;
  const critiques = actifs
    .filter(
      (d) => (d.remainingMinutes ?? Math.floor((d.deadlineAt.getTime() - Date.now()) / 60000)) < 60,
    )
    .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime());
  const totalPages = Math.max(1, Math.ceil(critiques.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = critiques.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <BigStat label="Dossiers actifs" value={kpi?.en_retard ?? 0} loading={kpiQ.isLoading} />
        <BigStat
          label="Critiques < 1 h"
          value={kpi?.critiques_1h ?? 0}
          tone="critical"
          loading={kpiQ.isLoading}
        />
        <BigStat
          label="Taux de décroche"
          value={`${kpi?.taux_decroche_pct ?? 0}%`}
          tone="success"
          loading={kpiQ.isLoading}
        />
        <BigStat
          label="Appels aujourd'hui"
          value={kpi?.appels_aujourdhui ?? 0}
          tone="accent"
          loading={kpiQ.isLoading}
        />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
          Dossiers à moins d'une heure
        </h2>
        {dossiersQ.isLoading && !dossiersQ.data ? (
          <Skeleton className="h-24 w-full" />
        ) : critiques.length === 0 ? (
          <Card className="p-12 text-center">
            <ShieldCheck className="h-10 w-10 text-success mx-auto mb-3" />
            <div className="text-foreground font-medium">
              Aucun dossier critique pour l'instant.
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Tous les dossiers sont dans les temps.
            </div>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {pageRows.map((d) => (
                <Card key={d.id} className="p-5 bg-critical/5 border-critical/20">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                      <TimeRemainingBadge
                        deadline={d.deadlineAt}
                        remainingMinutes={d.remainingMinutes}
                        size="lg"
                      />
                      <div>
                        <div className="font-mono text-sm font-semibold text-foreground">
                          {d.refM2s}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {d.constateur.nom} · {d.constateur.zone} · {d.constateur.telephone}
                        </div>
                      </div>
                    </div>
                    <Button asChild variant="default" size="sm">
                      <Link to="/dossiers/$id" params={{ id: d.id }}>
                        Voir le dossier
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-1 text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Précédent
                </Button>
                {pageNumbers(currentPage, totalPages).map((n, i) =>
                  n === "…" ? (
                    <span key={`e${i}`} className="px-2 text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={n}
                      size="sm"
                      variant={n === currentPage ? "default" : "outline"}
                      onClick={() => setPage(n as number)}
                    >
                      {n}
                    </Button>
                  ),
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Suivant
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
