import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/library/page-header";
import { BookOpen, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtDate } from "@/lib/library-utils";
import { Badge } from "@/components/ui/badge";

export function MemberDashboard() {
  const { user, profile } = usePermissions();
  
  const memberId = profile?.id;

  const stats = useQuery({
    queryKey: ["member-dashboard-stats", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const [activeLoans, overdue, reservations] = await Promise.all([
        supabase.from("loans").select("*", { count: "exact", head: true }).eq("member_id", memberId).eq("status", "active"),
        supabase.from("loans").select("*", { count: "exact", head: true }).eq("member_id", memberId).eq("status", "active").lt("due_at", new Date().toISOString().slice(0, 10)),
        supabase.from("reservations").select("*", { count: "exact", head: true }).eq("member_id", memberId).in("status", ["waiting", "ready"]),
      ]);
      return {
        activeLoans: activeLoans.count ?? 0,
        overdue: overdue.count ?? 0,
        reservations: reservations.count ?? 0,
      };
    },
  });

  const myLoans = useQuery({
    queryKey: ["member-loans", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("id, loan_number, due_at, status, book_copies(books(title))").eq("member_id", memberId).eq("status", "active").order("due_at");
      return data ?? [];
    },
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader title="My Library" description="Welcome back! Here's an overview of your loans and reservations." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{s?.activeLoans ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Active Loans</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{s?.overdue ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Overdue Books</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-bold">{s?.reservations ?? "—"}</div>
              <div className="text-xs text-muted-foreground">My Reservations</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>My Current Loans</CardTitle></CardHeader>
        <CardContent>
          {(myLoans.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">You don't have any active loans right now.</p>}
          <ul className="space-y-2">
            {(myLoans.data ?? []).map((l: any) => {
              const isOverdue = new Date(l.due_at) < new Date();
              return (
                <li key={l.id} className="flex items-center justify-between rounded-md border p-4 text-sm">
                  <div>
                    <div className="font-medium text-base">{l.book_copies?.books?.title}</div>
                    <div className="text-xs text-muted-foreground">Loan ID: {l.loan_number}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant={isOverdue ? "destructive" : "secondary"} className="mb-1">
                      {isOverdue ? "Overdue" : "Due"} {fmtDate(l.due_at)}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
