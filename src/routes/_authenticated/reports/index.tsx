import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/library/permission-gate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/library/page-header";
import { exportCSV, fmtDate, printHTML } from "@/lib/library-utils";
import { Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({ meta: [{ title: "Reports • Smart Library" }, { name: "description", content: "Library operations reports." }] }),
  component: () => (
    <PermissionGate permission="reports" memberAllowed>
      <ReportsPage />
    </PermissionGate>
  ),
});

function ReportsPage() {
  const { isMember, user } = usePermissions();

  const overdue = useQuery({
    queryKey: ["report-overdue", isMember, user?.id],
    queryFn: async () => {
      let q = supabase.from("loans")
        .select("loan_number, due_at, members!inner(user_id, full_name, member_number), book_copies(books(title))")
        .eq("status", "active").lt("due_at", new Date().toISOString().slice(0, 10));
      if (isMember && user?.id) {
        q = q.eq("members.user_id", user.id);
      }
      return (await q).data ?? [];
    },
  });
  const fines = useQuery({
    queryKey: ["report-fines", isMember, user?.id],
    queryFn: async () => {
      let q = supabase.from("loans")
        .select("loan_number, fine_amount, fine_paid, members!inner(user_id, full_name, member_number)")
        .gt("fine_amount", 0).order("fine_amount", { ascending: false });
      if (isMember && user?.id) {
        q = q.eq("members.user_id", user.id);
      }
      return (await q).data ?? [];
    },
  });

  const printReport = (title: string, rows: any[], headers: string[]) => {
    const body = `<h1>${title}</h1><div class="muted">Generated ${new Date().toLocaleString()}</div>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    printHTML(title, body);
  };

  const overdueRows = (overdue.data ?? []).map((l: any) => ({
    Loan: l.loan_number, Member: l.members?.full_name, Code: l.members?.member_number,
    Book: l.book_copies?.books?.title, Due: fmtDate(l.due_at),
  }));
  const fineRows = (fines.data ?? []).map((l: any) => ({
    Loan: l.loan_number, Member: l.members?.full_name, Fine: `LKR ${l.fine_amount}`, Paid: l.fine_paid ? "Yes" : "No",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Export or print operational reports." />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Overdue Loans</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV("overdue.csv", overdueRows)}><Download className="mr-2 h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => printReport("Overdue Loans", overdueRows, ["Loan","Member","Code","Book","Due"])}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Loan</TableHead><TableHead>Member</TableHead><TableHead>Book</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
            <TableBody>
              {overdueRows.map((r, i) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{r.Loan}</TableCell><TableCell>{r.Member}</TableCell><TableCell>{r.Book}</TableCell><TableCell>{r.Due}</TableCell></TableRow>
              ))}
              {overdueRows.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No overdue loans.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Outstanding Fines</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV("fines.csv", fineRows)}><Download className="mr-2 h-4 w-4" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={() => printReport("Fines Report", fineRows, ["Loan","Member","Fine","Paid"])}><Printer className="mr-2 h-4 w-4" /> Print</Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Loan</TableHead><TableHead>Member</TableHead><TableHead>Fine</TableHead><TableHead>Paid</TableHead></TableRow></TableHeader>
            <TableBody>
              {fineRows.map((r, i) => (
                <TableRow key={i}><TableCell className="font-mono text-xs">{r.Loan}</TableCell><TableCell>{r.Member}</TableCell><TableCell>{r.Fine}</TableCell><TableCell>{r.Paid}</TableCell></TableRow>
              ))}
              {fineRows.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No fines.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}