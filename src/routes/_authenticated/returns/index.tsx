import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { daysBetween, fmtDate } from "@/lib/library-utils";
import { FINE_PER_DAY, cancelRemindersForLoan, recordReturnFine, notifyNextReservation } from "@/lib/circulation";
import { Search, RotateCcw, ScanBarcode } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/returns/")({
  head: () => ({ meta: [{ title: "Returns • Smart Library" }, { name: "description", content: "Return borrowed books and apply fines." }] }),
  component: () => (
    <PermissionGate permission="returns" memberAllowed>
      <ReturnsPage />
    </PermissionGate>
  ),
});

function ReturnsPage() {
  const qc = useQueryClient();
  const { can, isMember, user } = usePermissions();
  const [q, setQ] = useState("");

  const loans = useQuery({
    queryKey: ["loans-active", isMember, user?.id],
    queryFn: async () => {
      let q = supabase.from("loans")
        .select("*, members!inner(user_id, full_name, member_number), book_copies(id, barcode, book_id, books(title))")
        .eq("status", "active")
        .order("due_at");
        
      if (isMember && user?.id) {
        q = q.eq("members.user_id", user.id);
      }
      return (await q).data ?? [];
    },
  });

  const filtered = (loans.data ?? []).filter((l: any) =>
    !q || [l.loan_number, l.members?.full_name, l.book_copies?.books?.title].some((v: any) =>
      String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  const doReturn = async (l: any, condition: string) => {
    const now = new Date();
    const overdueDays = Math.max(0, daysBetween(new Date(l.due_at), now));
    const fine = overdueDays * FINE_PER_DAY;
    const { error } = await supabase.from("loans").update({
      status: "returned", returned_at: now.toISOString(), return_condition: condition as any, fine_amount: fine,
    }).eq("id", l.id);
    if (error) return toast.error(error.message);
    const copyStatus = condition === "damaged" ? "damaged" : condition === "lost" ? "lost" : "available";
    await supabase.from("book_copies").update({ status: copyStatus as any }).eq("id", l.book_copies.id);

    // stop any future reminders for this loan
    await cancelRemindersForLoan(l.id);

    const charged = await recordReturnFine({
      loanId: l.id,
      memberId: l.member_id,
      dueAt: l.due_at,
      condition,
      returnedAt: now,
    });

    // hand the copy to the next person in the reservation queue
    if (copyStatus === "available" && l.book_copies?.book_id) {
      await notifyNextReservation(l.book_copies.book_id);
    }

    toast.success(charged > 0 ? `Returned. Fine charged: LKR ${charged}` : "Returned — no fine due");
    qc.invalidateQueries();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Book Returns"
        description={
          can("return_books")
            ? `Automatic fine calculation at LKR ${FINE_PER_DAY} / day overdue.`
            : "Read-only view — you don't have permission to process returns."
        }
      />
      <Card>
        <CardContent className="p-4">
          {can("return_books") && (
            <div className="bg-muted/50 p-3 rounded-md mb-4 border border-border flex items-center gap-3">
              <ScanBarcode className="h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Scan Book Barcode to return..." 
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (!val) return;
                    
                    // Find active loan with this book barcode
                    const loan = activeLoans.data?.find((l: any) => l.book_copies?.barcode === val);
                    
                    if (loan) {
                      processReturn(loan, 'available');
                      e.currentTarget.value = "";
                    } else {
                      toast.error("No active loan found for this barcode.");
                      e.currentTarget.value = "";
                    }
                  }
                }}
              />
            </div>
          )}
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search active loans…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead><TableHead>Member</TableHead><TableHead>Book</TableHead>
                  <TableHead>Due</TableHead><TableHead>Overdue</TableHead><TableHead>Fine</TableHead>
                  <TableHead className="w-56">Return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: any) => {
                  const od = daysBetween(new Date(l.due_at), new Date());
                  const fine = Math.max(0, od) * FINE_PER_DAY;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.loan_number}</TableCell>
                      <TableCell>{l.members?.full_name}</TableCell>
                      <TableCell>{l.book_copies?.books?.title}</TableCell>
                      <TableCell>{fmtDate(l.due_at)}</TableCell>
                      <TableCell>{od > 0 ? <Badge variant="destructive">{od}d</Badge> : <Badge variant="secondary">On time</Badge>}</TableCell>
                      <TableCell>{fine > 0 ? `LKR ${fine}` : "—"}</TableCell>
                      <TableCell>
                        {can("return_books") ? (
                        <div className="flex items-center gap-2">
                          <Select onValueChange={(v) => doReturn(l, v)}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Return as…" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">Good condition</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="lost">Lost</SelectItem>
                            </SelectContent>
                          </Select>
                          <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No active loans.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}