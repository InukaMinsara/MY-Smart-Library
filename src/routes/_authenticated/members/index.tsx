import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate, Can } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { exportCSV, fmtDate } from "@/lib/library-utils";
import { Plus, Search, Download, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { inviteUserByEmail } from "@/lib/invite.functions";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({ meta: [{ title: "Members • Smart Library" }, { name: "description", content: "Manage library members." }] }),
  component: () => (
    <PermissionGate permission="members">
      <MembersPage />
    </PermissionGate>
  ),
});

function MembersPage() {
  const qc = useQueryClient();
  const { can, isSuperAdmin } = usePermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const members = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("members").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const filtered = (members.data ?? []).filter((m: any) => {
    const matches = !q || [m.full_name, m.email, m.phone, m.member_number].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()));
    const ok = status === "all" || m.status === status;
    return matches && ok;
  });

  const save = async (form: FormData): Promise<void> => {
    const payload: any = {
      full_name: form.get("full_name"),
      email: form.get("email") || null,
      phone: form.get("phone") || null,
      address: form.get("address") || null,
      status: form.get("status") || "active",
    };
    if (editing) {
      const { error } = await supabase.from("members").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Member updated");
    } else {
      const { error } = await supabase.from("members").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Member added");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Member deleted");
    qc.invalidateQueries({ queryKey: ["members"] });
  };

  const [inviteBusy, setInviteBusy] = useState(false);

  const inviteFriend = async (e: any) => {
    e.preventDefault();
    const form = e.target;
    const email = form.email.value;
    
    setInviteBusy(true);
    try {
      await inviteUserByEmail({
        data: {
          email,
          redirectTo: window.location.origin + "/complete-profile",
        },
      });
      setInviteOpen(false);
      toast.success("Official invitation email successfully sent to " + email + "!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation.");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Member Management" description="Register, edit and track members."
        actions={
          <>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild><Button variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Invite Friend</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite a Friend</DialogTitle></DialogHeader>
                <form onSubmit={inviteFriend} className="space-y-3">
                  <div>
                    <Label>Friend's Email Address</Label>
                    <Input name="email" type="email" required placeholder="friend@example.com" disabled={inviteBusy} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={inviteBusy}>
                      {inviteBusy ? "Sending..." : "Send Invitation"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Can permission="export_reports"><Button variant="outline" onClick={() => exportCSV("members.csv", filtered.map((m: any) => ({
              code: m.member_number, name: m.full_name, email: m.email, phone: m.phone, status: m.status,
              joined: fmtDate(m.registration_date),
            })))}><Download className="mr-2 h-4 w-4" /> Export</Button></Can>
            {can("register_members") && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit Member" : "Add Member"}</DialogTitle></DialogHeader>
                <form action={save} className="space-y-3">
                  <div><Label>Full name</Label><Input name="full_name" required defaultValue={editing?.full_name} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Email</Label><Input name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
                    <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone ?? ""} /></div>
                  </div>
                  <div><Label>Address</Label><Input name="address" defaultValue={editing?.address ?? ""} /></div>
                  <div>
                    <Label>Status</Label>
                    <Select name="status" defaultValue={editing?.status ?? "active"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter><Button type="submit">{editing ? "Save" : "Add"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </>
        } />

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, phone, code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.member_number}</TableCell>
                    <TableCell className="font-medium">{m.full_name}</TableCell>
                    <TableCell>{m.email ?? "—"}</TableCell>
                    <TableCell>{m.phone ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === "active" ? "default" : m.status === "suspended" ? "destructive" : "secondary"}>{m.status}</Badge>
                    </TableCell>
                    <TableCell>{fmtDate(m.registration_date)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Can permission="register_members">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      </Can>
                      {isSuperAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete member?</AlertDialogTitle>
                            <AlertDialogDescription>Historical loans referencing this member must be cleared first.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(m.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No members match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}