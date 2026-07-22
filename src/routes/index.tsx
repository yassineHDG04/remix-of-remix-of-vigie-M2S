import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { TimeRemainingBadge } from "@/components/TimeRemainingBadge";
import { ErrorState } from "@/components/ErrorState";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Zone } from "@/data/types";
import { formatDateTime } from "@/lib/time";
import { useDossiers, useKpi, useSettings } from "@/lib/hooks";

export const Route = createFileRoute("/")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Nida2 Voicebot Center - M2S" }] }),
});

function Kpi({
  label,
  value,
  tone = "default",
  loading,
}: {
  label: string;
  value: string;
  tone?: "default" | "critical" | "accent" | "success";
  loading?: boolean;
}) {
  const tones = {
    default: "text-foreground",
    critical: "text-critical",
    accent: "text-accent",
    success: "text-success",
  } as const;
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <div className={`mt-2 text-3xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      )}
    </Card>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const dossiersQ = useDossiers("en_retard");
  const kpiQ = useKpi();
  const settingsQ = useSettings();
  const nbRelancesIa = settingsQ.data?.nbRelancesIa ?? 3;
  const [q, setQ] = useState("");
  const [zone, setZone] = useState<"all" | Zone>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [dismissBanner, setDismissBanner] = useState(false);

  const enRetard = dossiersQ.data ?? [];
  const kpi = kpiQ.data;
  const humain = enRetard.find((d) => !!d.handoffReason);

  const rows = useMemo(() => {
    return enRetard
      .filter((d) => {
        if (zone !== "all" && d.constateur.zone !== zone) return false;
        if (stageFilter !== "all") {
          if (stageFilter === "humain") {
            if (!d.handoffReason) return false;
          } else if (d.handoffReason || String(d.currentStage) !== stageFilter) {
            return false;
          }
        }
        if (q) {
          const s = q.toLowerCase();
          if (!d.refM2s.toLowerCase().includes(s) && !d.constateur.nom.toLowerCase().includes(s))
            return false;
        }
        return true;
      })
      .sort((a, b) => a.deadlineAt.getTime() - b.deadlineAt.getTime());
  }, [enRetard, q, zone, stageFilter]);

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

  return (
    <div className="space-y-5">
      {humain && !dismissBanner && (
        <div className="flex items-start justify-between gap-4 rounded-xl bg-critical/10 border border-critical/20 px-4 py-3">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-critical mt-0.5 shrink-0" />
            <div className="text-sm text-foreground">
              <span className="font-semibold text-critical">Intervention humaine requise</span> —
              dossier <span className="font-medium">{humain.refM2s}</span>. Zineb a été notifiée sur
              WhatsApp.
            </div>
          </div>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setDismissBanner(true)}
          >
            Ignorer
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Dossiers en retard"
          value={String(kpi?.en_retard ?? 0)}
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Critiques < 1 h"
          value={String(kpi?.critiques_1h ?? 0)}
          tone="critical"
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Appels aujourd'hui"
          value={String(kpi?.appels_aujourdhui ?? 0)}
          tone="accent"
          loading={kpiQ.isLoading}
        />
        <Kpi
          label="Taux de décroche"
          value={`${kpi?.taux_decroche_pct ?? 0}%`}
          tone="success"
          loading={kpiQ.isLoading}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex-1 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Réf ou constateur…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={zone} onValueChange={(v) => setZone(v as never)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes zones</SelectItem>
                {(["Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir", "Fès"] as Zone[]).map(
                  (z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as never)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Étape" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes étapes</SelectItem>
                <SelectItem value="0">En attente</SelectItem>
                {Array.from({ length: nbRelancesIa }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Relance IA n°{n}
                  </SelectItem>
                ))}
                <SelectItem value="humain">Humain</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto -mx-5">
          <div className="min-w-[860px] px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Réf</TableHead>
                  <TableHead>Constateur</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Arrivée</TableHead>
                  <TableHead>Temps restant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dossiersQ.isLoading &&
                  !dossiersQ.data &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!dossiersQ.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      Aucun dossier en retard.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((d) => {
                  const go = () => navigate({ to: "/dossiers/$id", params: { id: d.id } });
                  return (
                    <TableRow
                      key={d.id}
                      role="link"
                      tabIndex={0}
                      onClick={go}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          go();
                        }
                      }}
                      className="cursor-pointer hover:bg-muted/60 focus-visible:bg-muted/60 outline-none"
                    >
                      <TableCell>
                        <Link
                          to="/dossiers/$id"
                          params={{ id: d.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs text-accent hover:underline"
                        >
                          {d.refM2s}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{d.constateur.nom}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.constateur.telephone}
                        </div>
                      </TableCell>
                      <TableCell>{d.constateur.zone}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(d.arrivalAt)}
                      </TableCell>
                      <TableCell>
                        <TimeRemainingBadge
                          deadline={d.deadlineAt}
                          remainingMinutes={d.remainingMinutes}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}
