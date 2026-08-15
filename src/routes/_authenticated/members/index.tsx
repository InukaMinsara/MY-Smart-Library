import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate, Can } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { exportCSV, fmtDate } from "@/lib/library-utils";
import { Plus, Search, Download, Pencil, Trash2, UserPlus, Printer, IdCard, Library } from "lucide-react";
import { toast } from "sonner";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";

export const Route = createFileRoute("/_authenticated/members/")({
  head: () => ({ meta: [{ title: "Members • Smart Library" }, { name: "description", content: "Manage library members." }] }),
  component: MembersPage,
});

function MembersPage() {
  const qc = useQueryClient();
  const { can, isSuperAdmin } = usePermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  
  const [idCardOpen, setIdCardOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const idCardRef = useRef<HTMLDivElement>(null);

  const handlePrintIdCard = useReactToPrint({
    content: () => idCardRef.current,
    documentTitle: `ID_Card_${selectedMember?.member_number}`,
  });

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
      toast.success("Member created");
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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteBusy(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail, role: "member" }
      });
      if (error) throw error;
      toast.success("Invitation sent to " + inviteEmail);
      setInviteOpen(false);
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to invite user");
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <PermissionGate permission="members">
      <div className="space-y-4">
        <PageHeader title="Members" description="Library users and their accounts."
          actions={
            <>
              {isSuperAdmin && (
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild><Button variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Invite Member</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Invite Member via Email</DialogTitle></DialogHeader>
                  <form onSubmit={handleInvite} className="space-y-4 mt-2">
                    <div className="space-y-2">
                      <Label>Email address</Label>
                      <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required placeholder="member@example.com" />
                    </div>
                    <Button type="submit" disabled={inviteBusy} className="w-full">
                      {inviteBusy ? "Sending..." : "Send Invitation"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
              )}
              <Can permission="export_reports"><Button variant="outline" onClick={() => exportCSV("members.csv", filtered.map((m: any) => ({
                id: m.member_number, name: m.full_name, email: m.email, phone: m.phone, status: m.status, joined: fmtDate(m.created_at)
              })))}><Download className="mr-2 h-4 w-4" /> Export</Button></Can>
              <Can permission="add_member">
                <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
                  <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Member</Button></DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Member</DialogTitle></DialogHeader>
                    <form action={save} className="space-y-3">
                      <div><Label>Full name</Label><Input name="full_name" defaultValue={editing?.full_name} required /></div>
                      <div><Label>Email</Label><Input type="email" name="email" defaultValue={editing?.email} /></div>
                      <div><Label>Phone</Label><Input name="phone" defaultValue={editing?.phone} /></div>
                      <div><Label>Address</Label><Input name="address" defaultValue={editing?.address} /></div>
                      {editing && (
                        <div>
                          <Label>Status</Label>
                          <Select name="status" defaultValue={editing.status}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent>
                          </Select>
                        </div>
                      )}
                      <DialogFooter><Button type="submit">{editing ? "Save" : "Add"}</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </Can>
            </>
          } />

        <Card>
          <CardHeader className="py-3 px-4 flex flex-row items-center gap-4">
            <div className="relative flex-1 max-w-sm"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" /></div>
            <Select value={status} onValueChange={setStatus}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem></SelectContent></Select>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.full_name}</div>
                        <div className="text-sm text-muted-foreground">{m.member_number}</div>
                      </TableCell>
                      <TableCell><div className="text-sm">{m.email}</div><div className="text-xs text-muted-foreground">{m.phone}</div></TableCell>
                      <TableCell><div className="capitalize text-sm">{m.status}</div></TableCell>
                      <TableCell className="text-sm">{fmtDate(m.created_at)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button size="icon" variant="ghost" title="Print ID Card" onClick={() => { setSelectedMember(m); setIdCardOpen(true); }}>
                          <IdCard className="h-4 w-4" />
                        </Button>
                        <Can permission="edit_member">
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        </Can>
                        <Can permission="delete_member">
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete {m.full_name}?</AlertDialogTitle><AlertDialogDescription>This removes the member. Active loans must be returned first.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => remove(m.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </Can>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No members found</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={idCardOpen} onOpenChange={setIdCardOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle>Member ID Card</DialogTitle>
              <CardDescription>Preview and print ID card for {selectedMember?.full_name}</CardDescription>
            </DialogHeader>
            <div className="flex justify-center py-6 bg-muted/20 rounded-md">
              <div 
                ref={idCardRef} 
                className="bg-white text-black rounded-xl overflow-hidden shadow-2xl border-2 border-gray-200"
                style={{ width: '3.375in', height: '2.125in', position: 'relative' }}
              >
                <div className="bg-primary text-primary-foreground p-3 flex items-center gap-2">
                  <Library className="h-5 w-5" />
                  <div>
                    <div className="font-bold text-sm leading-tight">SMART LIBRARY</div>
                    <div className="text-[9px] opacity-90 leading-tight">MEMBERSHIP CARD</div>
                  </div>
                </div>
                <div className="p-4 flex flex-col items-center justify-center">
                  <div className="text-lg font-bold truncate w-full text-center mb-1 text-gray-800">
                    {selectedMember?.full_name}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">Member ID</div>
                  {selectedMember && (
                    <Barcode 
                      value={selectedMember.member_number} 
                      width={1.5} 
                      height={35} 
                      fontSize={11} 
                      margin={0} 
                      displayValue={true} 
                    />
                  )}
                </div>
                <div className="absolute bottom-0 w-full h-2 bg-gradient-to-r from-primary to-accent"></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIdCardOpen(false)}>Close</Button>
              <Button onClick={handlePrintIdCard}><Printer className="mr-2 h-4 w-4" /> Print ID Card</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}