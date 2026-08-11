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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate, Can } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { addDays, exportCSV, fmtDate, toISODate, printHTML } from "@/lib/library-utils";
import { checkBorrowEligibility, scheduleReturnReminders, MAX_BOOKS_PER_MEMBER } from "@/lib/circulation";
import { Plus, Search, Download, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/loans/")({
  head: () => ({ meta: [{ title: "Loans • Smart Library" }, { name: "description", content: "Issue and track book loans." }] }),
  component: () => (
    <PermissionGate permission="loans">
      <LoansPage />
    </PermissionGate>
  ),
});

function LoansPage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState<string>("");
  const [copyId, setCopyId] = useState<string>("");

  const loans = useQuery({
    queryKey: ["loans"],
    queryFn: async () => (await supabase.from("loans")
      .select("*, members(full_name, member_number), book_copies(barcode, copy_number, books(title, book_number))")
      .order("issued_at", { ascending: false })).data ?? [],
  });
  const members = useQuery({
    queryKey: ["members-active"],
    queryFn: async () => (await supabase.from("members").select("id, full_name, member_number, email").eq("status", "active").order("full_name")).data ?? [],
  });
  const availableCopies = useQuery({
    queryKey: ["copies-available"],
    queryFn: async () => (await supabase.from("book_copies").select("id, barcode, copy_number, books(title, book_number, reference_only)").eq("status", "available").eq("books.reference_only", false).order("barcode")).data ?? [],
  });

  const today = new Date();

  const withOverdue = (loans.data ?? []).map((l: any) => {
    const overdue = l.status === "active" && new Date(l.due_at) < today;
    return { ...l, computedStatus: overdue ? "overdue" : l.status };
  });

  const filtered = withOverdue.filter((l: any) => {
    const matches = !q || [l.loan_number, l.members?.full_name, l.book_copies?.books?.title, l.book_copies?.barcode].some((v: any) =>
      String(v ?? "").toLowerCase().includes(q.toLowerCase()));
    const ok = status === "all" || l.computedStatus === status;
    return matches && ok;
  });

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId || !copyId) return toast.error("Pick member and copy");
    const eligibility = await checkBorrowEligibility(memberId, copyId);
    if (!eligibility.ok) return toast.error(eligibility.reason ?? "This loan is not allowed");
    const due = toISODate(addDays(today, 14));
    const { data: created, error } = await supabase
      .from("loans")
      .insert({ member_id: memberId, copy_id: copyId, due_at: due })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await supabase.from("book_copies").update({ status: "borrowed" }).eq("id", copyId);

    const member = (members.data ?? []).find((m: any) => m.id === memberId) as any;
    const copy = (availableCopies.data ?? []).find((c: any) => c.id === copyId) as any;
    await scheduleReturnReminders({
      loanId: created.id,
      memberId,
      email: member?.email ?? null,
      memberName: member?.full_name ?? "Member",
      bookTitle: copy?.books?.title ?? "your book",
      dueAt: due,
    });

    toast.success(member?.email ? "Loan issued — return reminders scheduled" : "Loan issued");
    setOpen(false); setMemberId(""); setCopyId("");
    qc.invalidateQueries();
  };

  const printSlip = (l: any) => {
    printHTML("Loan Slip - " + l.loan_number, `
      <h1>Loan Slip</h1><div class="muted">Smart Library Management System</div>
      <div class="row"><span class="label">Loan #</span><strong>${l.loan_number}</strong></div>
      <div class="row"><span class="label">Member</span><strong>${l.members?.full_name} (${l.members?.member_number})</strong></div>
      <div class="row"><span class="label">Book</span><strong>${l.book_copies?.books?.title}</strong></div>
      <div class="row"><span class="label">Copy Barcode</span><strong>${l.book_copies?.barcode}</strong></div>
      <div class="row"><span class="label">Issued</span><strong>${fmtDate(l.issued_at)}</strong></div>
      <div class="row"><span class="label">Due</span><strong>${fmtDate(l.due_at)}</strong></div>
    `);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Loan Management" description="Issue books to members, track due dates."
        actions={
          <>
            <Can permission="export_reports"><Button variant="outline" onClick={() => exportCSV("loans.csv", filtered.map((l: any) => ({
              loan: l.loan_number, member: l.members?.full_name, book: l.book_copies?.books?.title,
              barcode: l.book_copies?.barcode, issued: fmtDate(l.issued_at), due: fmtDate(l.due_at),
              returned: fmtDate(l.returned_at), status: l.computedStatus, fine: l.fine_amount,
            })))}><Download className="mr-2 h-4 w-4" /> Export</Button></Can>
            {can("issue_books") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Issue Loan</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Issue a Loan</DialogTitle></DialogHeader>
                <form onSubmit={issue} className="space-y-3">
                  <div>
                    <Label>Member</Label>
                    <Select value={memberId} onValueChange={setMemberId}>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                      <SelectContent>
                        {(members.data ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name} • {m.member_number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Book Copy</Label>
                    <Select value={copyId} onValueChange={setCopyId}>
                      <SelectTrigger><SelectValue placeholder="Select available copy" /></SelectTrigger>
                      <SelectContent>
                        {(availableCopies.data ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.books?.title} • #{c.copy_number} ({c.barcode})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Due date</Label>
                    <Input value={fmtDate(addDays(today, 14))} disabled />
                  </div>
                  <DialogFooter><Button type="submit">Issue</Button></DialogFooter>
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
              <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan #</TableHead><TableHead>Member</TableHead><TableHead>Book</TableHead>
                  <TableHead>Issued</TableHead><TableHead>Due</TableHead><TableHead>Returned</TableHead>
                  <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.loan_number}</TableCell>
                    <TableCell>{l.members?.full_name}</TableCell>
                    <TableCell>{l.book_copies?.books?.title}</TableCell>
                    <TableCell>{fmtDate(l.issued_at)}</TableCell>
                    <TableCell>{fmtDate(l.due_at)}</TableCell>
                    <TableCell>{fmtDate(l.returned_at)}</TableCell>
                    <TableCell>
                      <Badge variant={l.computedStatus === "overdue" ? "destructive" : l.computedStatus === "returned" ? "secondary" : "default"}>
                        {l.computedStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => printSlip(l)}><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No loans.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}