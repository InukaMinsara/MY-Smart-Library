import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { PERMISSIONS, PERMISSION_GROUPS, JOB_TITLES, JOB_PRESETS } from "@/lib/permissions";
import { updateEmployee, deleteEmployee, listEmployees, setEmployeeStatus, listMembersForPromotion, promoteToEmployee, demoteToMember } from "@/lib/employees.functions";
import { Plus, Pencil, Trash2, Search, ShieldCheck, Check, Ban, RotateCcw, UserMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users/")({
  head: () => ({
    meta: [
      { title: "User Management • Smart Library" },
      { name: "description", content: "Register employees, assign job titles and manage module permissions." },
    ],
  }),
  component: () => (
    <PermissionGate superAdminOnly>
      <UsersPage />
    </PermissionGate>
  ),
});

type Employee = {
  id: string; full_name: string; email: string | null; phone: string | null;
  job_title: string; job_name: string | null; avatar_url: string | null;
  role: string; status: string; permissions: string[];
};

function UsersPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listEmployees);
  const fetchMembers = useServerFn(listMembersForPromotion);
  const promote = useServerFn(promoteToEmployee);
  const demote = useServerFn(demoteToMember);
  const update = useServerFn(updateEmployee);
  const remove = useServerFn(deleteEmployee);
  const setStatusFn = useServerFn(setEmployeeStatus);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [jobTitle, setJobTitle] = useState<string>("");
  const [role, setRole] = useState("librarian");
  const [perms, setPerms] = useState<string[]>(JOB_PRESETS.Librarian);
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");

  const employees = useQuery<Employee[]>({ queryKey: ["employees"], queryFn: () => fetchList() as any });
  const members = useQuery({ queryKey: ["promotion-candidates"], queryFn: () => fetchMembers() as any });

  const reset = () => {
    setEditing(null); setJobTitle(""); setRole("librarian");
    setPerms(JOB_PRESETS.Librarian); setSelectedMemberId("");
  };

  const startEdit = (e: Employee) => {
    setEditing(e);
    setJobTitle(e.job_title);
    setRole(e.role === "super_admin" ? "admin" : e.role);
    setPerms(e.permissions);
    setOpen(true);
  };

  const toggle = (key: string) =>
    setPerms((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      if (editing) {
        const payload = {
          id: editing.id,
          full_name: editing.full_name,
          phone: editing.phone,
          job_title: jobTitle.trim(),
          role: role as any,
          status: editing.status as any,
          permissions: perms,
        };
        return update({ data: payload } as any);
      } else {
        if (!selectedMemberId) throw new Error("Please select a member to promote");
        if (!jobTitle.trim()) throw new Error("Please enter a job title");
        const member = members.data?.find((m: any) => m.id === selectedMemberId);
        if (!member) throw new Error("Member not found");
        const payload = {
          member_id: selectedMemberId,
          source: member.source,
          job_title: jobTitle.trim(),
          role: role as any,
          permissions: perms,
        };
        return promote({ data: payload } as any);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Employee updated" : "Member promoted to Employee");
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["promotion-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } } as any),
    onSuccess: () => { toast.success("Employee deleted"); qc.invalidateQueries({ queryKey: ["employees"] }); qc.invalidateQueries({ queryKey: ["promotion-candidates"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete"),
  });

  const flip = useMutation({
    mutationFn: (v: { id: string; status: string }) => setStatusFn({ data: v } as any),
    onSuccess: () => { toast.success("Account status updated"); qc.invalidateQueries({ queryKey: ["employees"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update status"),
  });

  const demoteMut = useMutation({
    mutationFn: (id: string) => demote({ data: { employee_id: id } } as any),
    onSuccess: () => { 
      toast.success("Employee reverted to Member"); 
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["promotion-candidates"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not revert to member"),
  });

  const pendingCount = (employees.data ?? []).filter((e) => e.status === "pending").length;

  const list = (employees.data ?? []).filter((e) =>
    !q || [e.full_name, e.email, e.job_title, e.role].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <PageHeader
        title="System Employees"
        description="Approve new sign-ups, register employees, assign job titles and control module permissions."
        actions={
          <Button onClick={() => { reset(); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Register Employee
          </Button>
        }
      />

      {pendingCount > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <strong>{pendingCount}</strong> account{pendingCount === 1 ? "" : "s"} waiting for approval. Pending users have no
          access until you assign a role and permissions.
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search employees…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>

          {employees.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                    <TableHead>Job Title</TableHead><TableHead>Role</TableHead><TableHead>Permissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => {
                    const superAdmin = e.role === "super_admin";
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {e.avatar_url && <AvatarImage src={e.avatar_url} alt={e.full_name} />}
                              <AvatarFallback className="text-xs">{(e.full_name || e.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{e.full_name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{e.email ?? "—"}</TableCell>
                        <TableCell>{e.phone ?? "—"}</TableCell>
                        <TableCell>{e.job_title}</TableCell>
                        <TableCell>
                          {superAdmin ? (
                            <Badge className="bg-accent text-accent-foreground"><ShieldCheck className="mr-1 h-3 w-3" /> Super Admin</Badge>
                          ) : (
                            <Badge variant="secondary" className="capitalize">{e.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {superAdmin ? "All access" : `${e.permissions.length} module${e.permissions.length === 1 ? "" : "s"}`}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={e.status === "active" || superAdmin ? "default" : e.status === "disabled" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {superAdmin ? "active" : e.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {!superAdmin && e.status === "pending" && (
                            <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                              <Check className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                          )}
                          {!superAdmin && e.status === "active" && (
                            <Button size="icon" variant="ghost" title="Disable account"
                              onClick={() => flip.mutate({ id: e.id, status: "disabled" })}>
                              <Ban className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                          {!superAdmin && e.status === "disabled" && (
                            <Button size="icon" variant="ghost" title="Re-enable account"
                              onClick={() => flip.mutate({ id: e.id, status: "active" })}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" disabled={superAdmin} onClick={() => startEdit(e)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!superAdmin && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" title="Make Member"><UserMinus className="h-4 w-4 text-muted-foreground" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Make Member?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This revokes employee access for {e.full_name || e.email} and reverts them back to a standard Library Member.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => demoteMut.mutate(e.id)}>Make Member</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" disabled={superAdmin}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete employee?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes {e.full_name || e.email}'s account and access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => del.mutate(e.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {list.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No employees yet.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Employee" : "Register Employee"}</DialogTitle></DialogHeader>
          <form action={(fd) => save.mutate(fd)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {!editing && (
                <div className="sm:col-span-2">
                  <Label>Library Member</Label>
                  <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select a member to promote..." /></SelectTrigger>
                    <SelectContent>
                      {(members.data ?? []).map((m: any) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.full_name || m.email} ({m.member_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {editing && (
                <div className="sm:col-span-2 rounded-md bg-muted px-3 py-2">
                  <div className="text-sm font-medium">{editing.full_name || editing.email}</div>
                  <div className="text-xs text-muted-foreground">Editing employee profile</div>
                </div>
              )}
              <div>
                <Label>Job title</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required placeholder="e.g. Librarian" />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Permission settings</div>
                  <div className="text-xs text-muted-foreground">Enable or disable access to each module.</div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setPerms(PERMISSIONS.map((p) => p.key))}>All</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setPerms([])}>None</Button>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</div>
                    <div className="space-y-1.5">
                      {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                        <label key={p.key} className="flex cursor-pointer items-center gap-2 text-sm">
                          <Checkbox checked={perms.includes(p.key)} onCheckedChange={() => toggle(p.key)} />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editing ? "Save changes" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}