import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ErrorState";
import type { Dossier } from "@/data/types";
import { formatDate } from "@/lib/time";
import { useDossiers } from "@/lib/hooks";

export const Route = createFileRoute("/calendrier")({
  component: Calendrier,
  head: () => ({ meta: [{ title: "Calendrier · Nida'a M2S" }] }),
});

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function Calendrier() {
  const retardQ = useDossiers("en_retard");
  const validesQ = useDossiers("valide");

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const grid = useMemo(() => {
    const first = new Date(cursor);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  if ((retardQ.isError && !retardQ.data) || (validesQ.isError && !validesQ.data)) {
    return (
      <ErrorState
        onRetry={() => {
          retardQ.refetch();
          validesQ.refetch();
        }}
      />
    );
  }

  const dossiers: Dossier[] = [...(retardQ.data ?? []), ...(validesQ.data ?? [])];

  function dayDossiers(day: Date): { retard: Dossier[]; valides: Dossier[] } {
    const retard = dossiers.filter((d) => d.status === "en_retard" && sameDay(d.arrivalAt, day));
    const valides = dossiers.filter(
      (d) => d.status === "valide" && d.validatedAt && sameDay(d.validatedAt, day),
    );
    return { retard, valides };
  }

  const selectedData = selectedDay ? dayDossiers(selectedDay) : null;

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextDisabled =
    cursor.getFullYear() === currentMonthStart.getFullYear() &&
    cursor.getMonth() === currentMonthStart.getMonth();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const d = new Date();
                d.setDate(1);
                setCursor(d);
              }}
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              disabled={nextDisabled}
              title={nextDisabled ? "Navigation vers le futur désactivée" : "Mois suivant"}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2 font-medium">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <div key={d} className="text-center py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {grid.map((day, i) => {
            if (!day) return <div key={i} className="aspect-square" />;
            const { retard, valides } = dayDossiers(day);
            const isSelected = selectedDay && sameDay(selectedDay, day);
            const isToday = sameDay(day, new Date());
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`aspect-square rounded-lg p-1.5 text-left flex flex-col text-sm transition-colors hover:bg-muted ${
                  isSelected ? "bg-blue-soft ring-1 ring-accent" : ""
                } ${isToday && !isSelected ? "bg-muted" : ""}`}
              >
                <span
                  className={`text-xs ${isToday ? "font-bold text-accent" : "text-foreground"}`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-auto flex gap-1">
                  {retard.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-critical/15 text-critical text-[10px] px-1.5 font-medium">
                      {retard.length}
                    </span>
                  )}
                  {valides.length > 0 && (
                    <span className="inline-flex items-center rounded-full bg-success/15 text-success text-[10px] px-1.5 font-medium">
                      {valides.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-critical" /> Retard
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-success" /> Validé
          </span>
        </div>
      </Card>

      <Card className="p-5">
        {selectedDay ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Journée</div>
                <div className="text-base font-semibold">{formatDate(selectedDay)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            {selectedData &&
            selectedData.retard.length === 0 &&
            selectedData.valides.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Aucun dossier ce jour-là.
              </div>
            ) : (
              <div className="space-y-4">
                {selectedData!.retard.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-critical mb-2 uppercase">
                      En retard ({selectedData!.retard.length})
                    </div>
                    <div className="space-y-1.5">
                      {selectedData!.retard.map((d) => (
                        <Link
                          key={d.id}
                          to="/dossiers/$id"
                          params={{ id: d.id }}
                          className="flex justify-between rounded-md hover:bg-muted px-2 py-1.5 text-sm"
                        >
                          <span className="font-mono text-xs text-accent">{d.refM2s}</span>
                          <span className="text-muted-foreground truncate ml-2">
                            {d.constateur.nom}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {selectedData!.valides.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-success mb-2 uppercase">
                      Validés ({selectedData!.valides.length})
                    </div>
                    <div className="space-y-1.5">
                      {selectedData!.valides.map((d) => (
                        <Link
                          key={d.id}
                          to="/dossiers/$id"
                          params={{ id: d.id }}
                          className="flex justify-between rounded-md hover:bg-muted px-2 py-1.5 text-sm"
                        >
                          <span className="font-mono text-xs text-accent">{d.refM2s}</span>
                          <span className="text-muted-foreground truncate ml-2">
                            {d.constateur.nom}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground py-12 text-center">
            Sélectionne un jour dans le calendrier pour voir ses dossiers.
          </div>
        )}
      </Card>
    </div>
  );
}
