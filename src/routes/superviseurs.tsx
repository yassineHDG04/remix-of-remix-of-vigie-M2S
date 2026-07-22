import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/time";

export const Route = createFileRoute("/superviseurs")({
  component: SuperviseursPage,
  head: () => ({ meta: [{ title: "Superviseurs · Nida'a M2S" }] }),
});

interface Row {
  id: string;
  email: string;
  full_name: string;
  status: "actif" | "suspendu" | "invite";
  created_at: string;
  role: "admin" | "superviseur";
}

const PAGE_SIZE = 25;

async function fetchAll(): Promise<Row[]> {
  const [{ data: profs, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, status, created_at")
      .not("email", "like", "%@vigie.internal")
      .order("created_at", { ascending: false }),
    supabase.from("user_roles").select("user_id, role"),
  ]);
  if (pErr) throw new Error(pErr.message);
  if (rErr) throw new Error(rErr.message);
  const roleMap = new Map<string, "admin" | "superviseur">();
  for (const r of roles ?? []) {
    if (r.role === "admin") roleMap.set(r.user_id, "admin");
    else if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, "superviseur");
  }
  return (profs ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name ?? "",
    status: (p.status as Row["status"]) ?? "actif",
    created_at: p.created_at,
    role: roleMap.get(p.id) ?? "superviseur",
  }));
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map = {
    actif: "bg-success/15 text-success",
    suspendu: "bg-critical/15 text-critical",
    invite: "bg-accent/15 text-accent",
  } as const;
  const label = status === "invite" ? "Invité" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[status]}`}
    >
      {label}
    </span>
  );
}

function SuperviseursPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["supervisors"], queryFn: fetchAll });
  const [page, setPage] = useState(1);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [tempCreds, setTempCreds] = useState<{ email: string; tempPassword: string } | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);

  const rows = q.data ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [rows, currentPage],
  );

  const inviteMut = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-supervisor", {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim() || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { email: string; tempPassword: string };
    },
    onSuccess: (data) => {
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setTempCreds({ email: data.email, tempPassword: data.tempPassword });
      qc.invalidateQueries({ queryKey: ["supervisors"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const toggleStatusMut = useMutation({
    mutationFn: async (row: Row) => {
      const next: Row["status"] = row.status === "actif" ? "suspendu" : "actif";
      const { error } = await supabase.from("profiles").update({ status: next }).eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supervisors"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const deleteMut = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-supervisor", {
        body: { userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Superviseur supprimé");
      qc.invalidateQueries({ queryKey: ["supervisors"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const editMut = useMutation({
    mutationFn: async (row: Row) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: row.full_name, status: row.status })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      // Role : upsert / delete admin selon rôle
      if (row.role === "admin") {
        await supabase
          .from("user_roles")
          .upsert({ user_id: row.id, role: "admin" }, { onConflict: "user_id,role" });
      } else {
        await supabase.from("user_roles").delete().eq("user_id", row.id).eq("role", "admin");
        await supabase
          .from("user_roles")
          .upsert({ user_id: row.id, role: "superviseur" }, { onConflict: "user_id,role" });
      }
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["supervisors"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Superviseurs</h2>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Inviter un superviseur
          </Button>
        </div>

        <div className="overflow-x-auto -mx-5">
          <div className="min-w-[860px] px-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading &&
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!q.isLoading && pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      Aucun superviseur.
                    </TableCell>
                  </TableRow>
                )}
                {pageRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.email}</TableCell>
                    <TableCell>{r.full_name}</TableCell>
                    <TableCell className="capitalize">{r.role}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(new Date(r.created_at))}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing(r)}
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleStatusMut.mutate(r)}
                        title={r.status === "actif" ? "Suspendre" : "Activer"}
                        disabled={toggleStatusMut.isPending}
                      >
                        <Power
                          className={`h-4 w-4 ${r.status === "actif" ? "text-critical" : "text-success"}`}
                        />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Supprimer"
                        disabled={r.id === user?.id || deleteMut.isPending}
                        onClick={() => {
                          if (r.id === user?.id) return;
                          if (confirm(`Supprimer définitivement ${r.email} ?`))
                            deleteMut.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-critical" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {totalPages > 1 && <Pager page={currentPage} totalPages={totalPages} onChange={setPage} />}
      </Card>

      {/* Dialog invitation */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inviter un superviseur</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="iemail">Email</Label>
              <Input
                id="iemail"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="prenom@m2s.ma"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iname">Nom (optionnel)</Label>
              <Input
                id="iname"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={() => inviteMut.mutate()}
              disabled={!inviteEmail.includes("@") || inviteMut.isPending}
            >
              {inviteMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer le compte superviseur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog credentials */}
      <Dialog open={!!tempCreds} onOpenChange={(o) => !o && setTempCreds(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compte créé</DialogTitle>
          </DialogHeader>
          {tempCreds && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Email</div>
                <div className="font-mono">{tempCreds.email}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Mot de passe temporaire</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-muted px-2 py-1 font-mono text-xs">
                    {tempCreds.tempPassword}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(tempCreds.tempPassword);
                      toast.success("Copié");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="rounded-md bg-accent/10 text-accent text-xs p-3">
                Le superviseur devra le changer à sa première connexion.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTempCreds(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog édition */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le profil</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={editing.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="en">Nom</Label>
                <Input
                  id="en"
                  value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select
                  value={editing.role}
                  onValueChange={(v) => setEditing({ ...editing, role: v as Row["role"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="superviseur">Superviseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select
                  value={editing.status}
                  onValueChange={(v) => setEditing({ ...editing, status: v as Row["status"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="suspendu">Suspendu</SelectItem>
                    <SelectItem value="invite">Invité</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button onClick={() => editing && editMut.mutate(editing)} disabled={editMut.isPending}>
              {editMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const nums = pageNumbers(page, totalPages);
  return (
    <div className="mt-4 flex items-center justify-center gap-1 text-sm">
      <Button size="sm" variant="outline" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        Précédent
      </Button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-2 text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={n}
            size="sm"
            variant={n === page ? "default" : "outline"}
            onClick={() => onChange(n as number)}
          >
            {n}
          </Button>
        ),
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Suivant
      </Button>
    </div>
  );
}

export function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}
