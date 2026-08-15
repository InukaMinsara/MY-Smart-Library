import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/library/permission-gate";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/library/page-header";
import { fmtDate } from "@/lib/library-utils";
import { Plus, X, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reservations/")({
  head: () => ({ meta: [{ title: "Reservations • Smart Library" }, { name: "description", content: "Manage the reservation queue." }] }),
  component: () => (
    <PermissionGate permission="reservations" memberAllowed>
      <ReservationsPage />
    </PermissionGate>
  ),
});

function ReservationsPage() {
  const qc = useQueryClient();
  const { can, isMember, user } = usePermissions();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [bookId, setBookId] = useState("");

  const reservations = useQuery({
    queryKey: ["reservations", isMember, user?.id],
    queryFn: async () => {
      let q = supabase.from("reservations")
        .select("*, members!inner(user_id, full_name, member_number), books(title, book_number)")
        .order("reserved_at", { ascending: false });
        
      if (isMember && user?.id) {
        q = q.eq("members.user_id", user.id);
      }
      return (await q).data ?? [];
    },
  });
  const members = useQuery({
    queryKey: ["members-list"],
    queryFn: async () => {
      if (isMember) {
        const { data } = await supabase.from("members").select("id, full_name, member_number").eq("user_id", user?.id).single();
        return data ? [data] : [];
      }
      return (await supabase.from("members").select("id, full_name, member_number").eq("status", "active").order("full_name")).data ?? [];
    },
  });
  const books = useQuery({
    queryKey: ["books-list"],
    queryFn: async () => (await supabase.from("books").select("id, title, book_number").order("title")).data ?? [],
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !bookId) return toast.error("Pick member and book");
    const { count } = await supabase.from("reservations").select("*", { count: "exact", head: true })
      .eq("book_id", bookId).in("status", ["waiting", "ready"]);
    const { error } = await supabase.from("reservations").insert({
      member_id: memberId, book_id: bookId, queue_position: (count ?? 0) + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Reservation added");
    setOpen(false); setMemberId(""); setBookId("");
    qc.invalidateQueries({ queryKey: ["reservations"] });
  };

  const setStatus = async (id: string, status: "ready" | "fulfilled" | "cancelled") => {
    const patch: any = { status };
    if (status === "ready") patch.ready_at = new Date().toISOString();
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["reservations"] });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reservations" description="Queue members for books that are currently out."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Reservation</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Reserve a Book</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-3">
                <div>
                  <Label>Member</Label>
                  <Select value={memberId} onValueChange={setMemberId}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(members.data ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name} • {m.member_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Book</Label>
                  <Select value={bookId} onValueChange={setBookId}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(books.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter><Button type="submit">Reserve</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        } />

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation</TableHead><TableHead>Member</TableHead><TableHead>Book</TableHead>
                <TableHead>Reserved</TableHead><TableHead>Queue</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(reservations.data ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reservation_number}</TableCell>
                  <TableCell>{r.members?.full_name}</TableCell>
                  <TableCell>{r.books?.title}</TableCell>
                  <TableCell>{fmtDate(r.reserved_at)}</TableCell>
                  <TableCell>#{r.queue_position}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "ready" ? "default" : r.status === "waiting" ? "secondary" : "outline"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "waiting" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "ready")}><Check className="mr-1 h-3 w-3" /> Ready</Button>}
                    {r.status === "ready" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "fulfilled")}><Check className="mr-1 h-3 w-3" /> Fulfill</Button>}
                    {(r.status === "waiting" || r.status === "ready") && <Button size="sm" variant="ghost" onClick={() => setStatus(r.id, "cancelled")}><X className="mr-1 h-3 w-3" /> Cancel</Button>}
                  </TableCell>
                </TableRow>
              ))}
              {(reservations.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No reservations yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}