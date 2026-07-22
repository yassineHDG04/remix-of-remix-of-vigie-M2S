import { useEffect, useState } from "react";
import { formatRemaining } from "@/lib/time";
import { cn } from "@/lib/utils";

interface Props {
  deadline: Date;
  /** Optionnel : minutes restantes fournies par l'API (source de vérité si présente). */
  remainingMinutes?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

function colorFor(minutesLeft: number): string {
  if (minutesLeft < 60)
    return "bg-critical/10 text-critical animate-pulse-slow ring-1 ring-critical/30";
  if (minutesLeft < 90) return "bg-warning/10 text-warning ring-1 ring-warning/30";
  if (minutesLeft < 150) return "bg-accent/10 text-accent ring-1 ring-accent/20";
  return "bg-success/10 text-success ring-1 ring-success/20";
}

const SIZES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-1 font-medium",
  lg: "text-lg px-3 py-1.5 font-semibold",
  xl: "text-3xl px-5 py-3 font-bold tabular-nums",
};

export function TimeRemainingBadge({ deadline, remainingMinutes, size = "md", className }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-muted text-muted-foreground tabular-nums",
          SIZES[size],
          className,
        )}
      >
        —
      </span>
    );
  }

  const minutesLeft =
    typeof remainingMinutes === "number"
      ? Math.max(0, remainingMinutes)
      : Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 60000));
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full tabular-nums",
        SIZES[size],
        colorFor(minutesLeft),
        className,
      )}
    >
      {formatRemaining(deadline, now)}
    </span>
  );
}
