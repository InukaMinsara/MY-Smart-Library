import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/library/page-header";
import { BookOpen, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { fmtDate } from "@/lib/library-utils";
import { Badge } from "@/components/ui/badge";
import { DigitalTicket } from "./DigitalTicket";
import { VirtualBookshelf } from "./VirtualBookshelf";
import { AICarousel } from "./AICarousel";
import { GamificationWidget } from "./GamificationWidget";
import { NoticeBoardWidget } from "./notice-board-widget";
import { ReadingGoalsWidget } from "./reading-goals-widget";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

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
      const { data } = await supabase.from("loans").select("id, loan_number, issued_at, due_at, status, members(full_name), book_copies(books(title, cover_url))").eq("member_id", memberId).eq("status", "active").order("due_at");
      return data ?? [];
    },
  });

  const readingHistory = useQuery({
    queryKey: ["member-reading-history", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
      const { data: loans } = await supabase.from("loans").select("issued_at").eq("member_id", memberId).gte("issued_at", since.toISOString());
      
      const months: Record<string, { m: string; books: number }> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
        const key = d.toLocaleString(undefined, { month: "short" });
        months[key] = { m: key, books: 0 };
      }
      
      (loans ?? []).forEach((l: any) => {
        const k = new Date(l.issued_at).toLocaleString(undefined, { month: "short" });
        if (months[k]) months[k].books++;
      });
      return Object.values(months);
    },
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader title="My Library" description="Welcome back! Here's an overview of your loans and reservations." />

      <AICarousel />

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="md:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <Card className="sm:col-span-2 lg:col-span-1">
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Reading History (Last 6 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] w-full">
                {readingHistory.data ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={readingHistory.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="m" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip 
                        cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                        contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--background))" }}
                      />
                      <Bar dataKey="books" name="Books Read" radius={[4, 4, 0, 0]}>
                        {readingHistory.data.map((_, index) => (
                          <Cell key={`cell-${index}`} fill="hsl(var(--primary))" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">Loading chart...</div>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* Reading Goals */}
          <ReadingGoalsWidget />
          
          <GamificationWidget />
        </div>
        
        <div className="space-y-6">
          <NoticeBoardWidget />
        </div>
      </div>
      
      {/* 3D Virtual Bookshelf */}
      {(myLoans.data ?? []).length > 0 && (
        <div className="pt-6">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><CheckCircle2 className="text-primary"/> My Reading Shelf</h2>
          <p className="text-sm text-muted-foreground mb-8">Hover over your borrowed books to inspect them in 3D.</p>
          <div className="bg-card/50 rounded-xl border border-white/5 p-4 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-primary/5 mix-blend-overlay pointer-events-none" />
             <VirtualBookshelf loans={myLoans.data || []} />
          </div>
        </div>
      )}

      <div className="pt-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><CheckCircle2 className="text-primary"/> Digital E-Tickets</h2>
        {(myLoans.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">You don't have any active loans right now.</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {(myLoans.data ?? []).map((l: any) => (
            <DigitalTicket key={l.id} loan={l} />
          ))}
        </div>
      </div>
    </div>
  );
}
