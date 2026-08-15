import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/library/page-header";
import { usePermissions } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/fines/")({
  head: () => ({
    meta: [
      { title: "Fines • Smart Library" },
      { name: "description", content: "Track overdue fines, record payments and monitor outstanding balances." },
    ],
  }),
  component: () => {
    const { can, isMember } = usePermissions();
    if (can("fine_management")) return <FinesPage />;
    if (isMember) return <MemberFinesPage />;
    return (
      <PermissionGate permission="fine_management">
        <FinesPage />
      </PermissionGate>
    );
  },
});

type FineRow = {
  id: string; reason: string; late_days: number; amount: number; amount_paid: number;
  status: string; created_at: string;
  members: { full_name: string; member_number: string; email: string | null } | null;
  loans: { loan_number: string; due_at: string; returned_at: string | null } | null;
  member_id?: string;
};

function MemberFinesPage() {
  const qc = useQueryClient();
  const { profile } = usePermissions();
  const [paying, setPaying] = useState<FineRow | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fines = useQuery({
    queryKey: ["member_fines", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("id, reason, late_days, amount, amount_paid, status, created_at, member_id, members(full_name, member_number, email), loans(loan_number, due_at, returned_at)")
        .eq("member_id", profile?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FineRow[];
    },
  });

  const pay = useMutation({
    mutationFn: async (v: { fine: FineRow; amount: number; method: string }) => {
      // Simulate Payment Gateway Delay
      await new Promise(r => setTimeout(r, 1500));

      const { data: sess } = await supabase.auth.getUser();
      const { error: pErr } = await supabase.from("payments").insert({
        fine_id: v.fine.id,
        member_id: v.fine.member_id,
        amount: v.amount,
        method: v.method,
        reference: "ONLINE_" + Math.random().toString(36).substring(2, 9).toUpperCase(),
        received_by: sess.user?.id ?? null,
      });
      if (pErr) throw pErr;
      const paid = Number(v.fine.amount_paid) + v.amount;
      const { error: fErr } = await supabase
        .from("fines")
        .update({ amount_paid: paid, status: paid >= Number(v.fine.amount) ? "paid" : "outstanding" })
        .eq("id", v.fine.id);
      if (fErr) throw fErr;
    },
    onSuccess: () => {
      toast.success("Payment Successful! Thank you.");
      setPaying(null);
      setIsProcessing(false);
      qc.invalidateQueries({ queryKey: ["member_fines"] });
    },
    onError: (e: any) => {
      setIsProcessing(false);
      toast.error(e?.message ?? "Payment Failed");
    },
  });

  const handlePayOnline = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!paying) return;
    setIsProcessing(true);
    const balance = Number(paying.amount) - Number(paying.amount_paid);
    pay.mutate({ fine: paying, amount: balance, method: "card" });
  };

  const rows = fines.data ?? [];
  const outstanding = rows.filter(f => f.status === "outstanding").reduce((s, f) => s + (Number(f.amount) - Number(f.amount_paid)), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="My Fines" description="View and pay your overdue fines online." />
      
      <Card className="bg-destructive/10 border-destructive/20 text-destructive-foreground max-w-sm">
        <CardContent className="p-4">
          <div className="text-sm font-semibold mb-1 text-destructive">Total Outstanding Fines</div>
          <div className="text-3xl font-bold">LKR {outstanding.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => {
                const bal = Number(f.amount) - Number(f.amount_paid);
                return (
                  <TableRow key={f.id}>
                    <TableCell>{fmtDate(f.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{f.loans?.loan_number}</TableCell>
                    <TableCell className="capitalize">{f.reason}</TableCell>
                    <TableCell>LKR {Number(f.amount).toFixed(2)}</TableCell>
                    <TableCell className="font-bold">LKR {bal.toFixed(2)}</TableCell>
                    <TableCell>
                      {f.status === "paid" ? <Badge variant="secondary">Paid</Badge> : 
                       f.status === "waived" ? <Badge variant="outline">Waived</Badge> :
                       <Badge variant="destructive">Outstanding</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.status === "outstanding" && bal > 0 && (
                        <Button size="sm" onClick={() => setPaying(f)}>Pay Online</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">You have no fines! Great job.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!paying} onOpenChange={(o) => !o && !isProcessing && setPaying(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handlePayOnline}>
            <DialogHeader>
              <DialogTitle>Pay Fine Securely</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-muted p-4 rounded-md text-center">
                <div className="text-sm text-muted-foreground">Payment Amount</div>
                <div className="text-3xl font-bold mt-1">LKR {(Number(paying?.amount || 0) - Number(paying?.amount_paid || 0)).toFixed(2)}</div>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                This is a simulated secure payment gateway. No real charges will be made.
              </div>
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input placeholder="0000 0000 0000 0000" disabled={isProcessing} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input placeholder="MM/YY" disabled={isProcessing} required />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input placeholder="123" disabled={isProcessing} required />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaying(null)} disabled={isProcessing}>Cancel</Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Pay Now"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FinesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [paying, setPaying] = useState<FineRow | null>(null);

  const fines = useQuery({
    queryKey: ["fines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("id, reason, late_days, amount, amount_paid, status, created_at, member_id, members(full_name, member_number, email), loans(loan_number, due_at, returned_at)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (FineRow & { member_id: string })[];
    },
  });

  const pay = useMutation({
    mutationFn: async (v: { fine: FineRow & { member_id?: string }; amount: number; method: string; reference: string }) => {
      const { data: sess } = await supabase.auth.getUser();
      const { error: pErr } = await supabase.from("payments").insert({
        fine_id: v.fine.id,
        member_id: (v.fine as any).member_id,
        amount: v.amount,
        method: v.method,
        reference: v.reference || null,
        received_by: sess.user?.id ?? null,
      });
      if (pErr) throw pErr;
      const paid = Number(v.fine.amount_paid) + v.amount;
      const { error: fErr } = await supabase
        .from("fines")
        .update({ amount_paid: paid, status: paid >= Number(v.fine.amount) ? "paid" : "outstanding" })
        .eq("id", v.fine.id);
      if (fErr) throw fErr;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPaying(null);
      qc.invalidateQueries({ queryKey: ["fines"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not record payment"),
  });

  const waive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fines").update({ status: "waived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Fine waived"); qc.invalidateQueries({ queryKey: ["fines"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not waive fine"),
  });

  const rows = (fines.data ?? []).filter((f) =>
    !q || [f.members?.full_name, f.members?.member_number, f.loans?.loan_number].some((v) =>
      String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  const outstanding = rows
    .filter((f) => f.status === "outstanding")
    .reduce((s, f) => s + (Number(f.amount) - Number(f.amount_paid)), 0);
  const collected = rows.reduce((s, f) => s + Number(f.amount_paid), 0);

  const receipt = (f: FineRow) => printHTML("Fine Receipt", `
    <h1>Smart Library — Fine Receipt</h1>
    <div class="muted">Issued ${new Date().toLocaleString()}</div>
    <div class="row"><span class="label">Member</span><span>${f.members?.full_name ?? "—"} (${f.members?.member_number ?? "—"})</span></div>
    <div class="row"><span class="label">Loan</span><span>${f.loans?.loan_number ?? "—"}</span></div>
    <div class="row"><span class="label">Reason</span><span>${f.reason}</span></div>
    <div class="row"><span class="label">Late days</span><span>${f.late_days}</span></div>
    <div class="row"><span class="label">Fine amount</span><span>LKR ${Number(f.amount).toFixed(2)}</span></div>
    <div class="row"><span class="label">Paid</span><span>LKR ${Number(f.amount_paid).toFixed(2)}</span></div>
    <div class="row"><span class="label">Balance</span><span>LKR ${(Number(f.amount) - Number(f.amount_paid)).toFixed(2)}</span></div>
  `);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fine Management"
        description="Overdue fines, payments and outstanding balances."
        actions={
          <Button variant="outline" onClick={() => exportCSV("fines.csv", rows.map((f) => ({
            member: f.members?.full_name, member_no: f.members?.member_number, loan: f.loans?.loan_number,
            late_days: f.late_days, amount: f.amount, paid: f.amount_paid, status: f.status, created: f.created_at,
          })))}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Outstanding</div>
          <div className="text-2xl font-bold text-destructive">LKR {outstanding.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Collected</div>
          <div className="text-2xl font-bold text-primary">LKR {collected.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Fine records</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search member or loan…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>

          {fines.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead><TableHead>Loan</TableHead><TableHead>Reason</TableHead>
                    <TableHead>Late days</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="font-medium">{f.members?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{f.members?.member_number ?? ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.loans?.loan_number ?? "—"}</TableCell>
                      <TableCell className="capitalize">{f.reason}</TableCell>
                      <TableCell>{f.late_days}</TableCell>
                      <TableCell>LKR {Number(f.amount).toFixed(2)}</TableCell>
                      <TableCell>LKR {Number(f.amount_paid).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "outstanding" ? "destructive" : f.status === "paid" ? "default" : "secondary"} className="capitalize">
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="sm" variant="outline" disabled={f.status !== "outstanding"} onClick={() => setPaying(f)}>
                          <Coins className="mr-1 h-3.5 w-3.5" /> Pay
                        </Button>
                        <Button size="icon" variant="ghost" title="Print receipt" onClick={() => receipt(f)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={f.status !== "outstanding"} onClick={() => waive.mutate(f.id)}>
                          Waive
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No fines recorded. Fines are created automatically when an overdue book is returned.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!paying} onOpenChange={(v) => !v && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          {paying && (
            <form
              action={(fd) => pay.mutate({
                fine: paying,
                amount: Number(fd.get("amount")),
                method: String(fd.get("method") ?? "cash"),
                reference: String(fd.get("reference") ?? ""),
              })}
              className="space-y-3"
            >
              <div className="text-sm text-muted-foreground">
                {paying.members?.full_name} • balance LKR {(Number(paying.amount) - Number(paying.amount_paid)).toFixed(2)}
                {paying.loans?.due_at ? ` • due ${fmtDate(paying.loans.due_at)}` : ""}
              </div>
              <div>
                <Label>Amount (LKR)</Label>
                <Input name="amount" type="number" step="0.01" min="0.01" required
                  defaultValue={(Number(paying.amount) - Number(paying.amount_paid)).toFixed(2)} />
              </div>
              <div>
                <Label>Method</Label>
                <Select name="method" defaultValue="cash">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="online">Online transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Reference (optional)</Label><Input name="reference" /></div>
              <DialogFooter>
                <Button type="submit" disabled={pay.isPending}>{pay.isPending ? "Saving…" : "Record payment"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}