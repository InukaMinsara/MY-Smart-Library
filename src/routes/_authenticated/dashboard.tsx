import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/library/page-header";
import { BookOpen, Users, ArrowLeftRight, AlertTriangle, BookMarked, CheckCircle2, Library, Boxes } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { fmtDate } from "@/lib/library-utils";
import { Badge } from "@/components/ui/badge";
import { MemberDashboard } from "@/components/library/member-dashboard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard • Smart Library" }, { name: "description", content: "Library operations at a glance." }] }),
  component: () => {
    const { isMember } = usePermissions();
    if (isMember) return <MemberDashboard />;
    return (
      <PermissionGate permission="dashboard">
        <Dashboard />
      </PermissionGate>
    );
  },
});

const COLORS = ["#3949ab", "#ff4081", "#00acc1", "#ffa000", "#43a047", "#8e24aa", "#6d4c41", "#546e7a"];

function StatCard({ icon: Icon, label, value, tone = "primary" }: { icon: React.ElementType; label: string; value: string | number; tone?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${tone}/10 text-${tone}`} style={{ background: "hsl(var(--primary)/0.1)" }}>
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const stats = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [books, copies, members, activeLoans, overdue, reservations, returnedToday, availableCopies] = await Promise.all([
        supabase.from("books").select("*", { count: "exact", head: true }),
        supabase.from("book_copies").select("*", { count: "exact", head: true }),
        supabase.from("members").select("*", { count: "exact", head: true }),
        supabase.from("loans").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("loans").select("*", { count: "exact", head: true }).eq("status", "active").lt("due_at", new Date().toISOString().slice(0, 10)),
        supabase.from("reservations").select("*", { count: "exact", head: true }).in("status", ["waiting", "ready"]),
        supabase.from("loans").select("*", { count: "exact", head: true }).gte("returned_at", new Date().toISOString().slice(0, 10)),
        supabase.from("book_copies").select("*", { count: "exact", head: true }).eq("status", "available"),
      ]);
      return {
        books: books.count ?? 0,
        copies: copies.count ?? 0,
        members: members.count ?? 0,
        activeLoans: activeLoans.count ?? 0,
        overdue: overdue.count ?? 0,
        reservations: reservations.count ?? 0,
        returnedToday: returnedToday.count ?? 0,
        availableCopies: availableCopies.count ?? 0,
      };
    },
  });

  const categoryData = useQuery({
    queryKey: ["dashboard-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("books").select("category_id, categories(name)");
      const counts: Record<string, number> = {};
      (data ?? []).forEach((b: any) => {
        const name = b.categories?.name ?? "Uncategorized";
        counts[name] = (counts[name] ?? 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  const monthly = useQuery({
    queryKey: ["dashboard-monthly"],
    queryFn: async () => {
      const since = new Date(); since.setMonth(since.getMonth() - 5); since.setDate(1);
      const { data: loans } = await supabase.from("loans").select("issued_at, returned_at").gte("issued_at", since.toISOString());
      const months: Record<string, { m: string; borrow: number; ret: number }> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
        const key = d.toLocaleString(undefined, { month: "short" });
        months[key] = { m: key, borrow: 0, ret: 0 };
      }
      (loans ?? []).forEach((l: any) => {
        const k = new Date(l.issued_at).toLocaleString(undefined, { month: "short" });
        if (months[k]) months[k].borrow++;
        if (l.returned_at) {
          const rk = new Date(l.returned_at).toLocaleString(undefined, { month: "short" });
          if (months[rk]) months[rk].ret++;
        }
      });
      return Object.values(months);
    },
  });

  const topBooks = useQuery({
    queryKey: ["dashboard-top-books"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("copy_id, book_copies(book_id, books(title))").limit(500);
      const counts: Record<string, number> = {};
      (data ?? []).forEach((l: any) => {
        const title = l.book_copies?.books?.title;
        if (title) counts[title] = (counts[title] ?? 0) + 1;
      });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, count]) => ({ title, count }));
    },
  });

  const recent = useQuery({
    queryKey: ["dashboard-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(6);
      return data ?? [];
    },
  });

  const upcoming = useQuery({
    queryKey: ["dashboard-upcoming"],
    queryFn: async () => {
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);
      const { data } = await supabase.from("loans").select("id, loan_number, due_at, members(full_name), book_copies(books(title))")
        .eq("status", "active").lte("due_at", in7.toISOString().slice(0, 10)).order("due_at").limit(6);
      return data ?? [];
    },
  });

  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Live overview of library operations." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={BookOpen} label="Total Books" value={s?.books ?? "—"} />
        <StatCard icon={Boxes} label="Total Copies" value={s?.copies ?? "—"} />
        <StatCard icon={Users} label="Members" value={s?.members ?? "—"} />
        <StatCard icon={ArrowLeftRight} label="Active Loans" value={s?.activeLoans ?? "—"} />
        <StatCard icon={AlertTriangle} label="Overdue" value={s?.overdue ?? "—"} />
        <StatCard icon={BookMarked} label="Reservations" value={s?.reservations ?? "—"} />
        <StatCard icon={CheckCircle2} label="Returned Today" value={s?.returnedToday ?? "—"} />
        <StatCard icon={Library} label="Available Copies" value={s?.availableCopies ?? "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Monthly Borrows vs Returns</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis dataKey="m" /><YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="borrow" name="Borrows" fill="#3949ab" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ret" name="Returns" fill="#ff4081" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Books by Category</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData.data ?? []} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} paddingAngle={2}>
                  {(categoryData.data ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Top Borrowed Books</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topBooks.data ?? []} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="title" width={180} />
                <Tooltip />
                <Bar dataKey="count" fill="#3949ab" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upcoming Due</CardTitle></CardHeader>
          <CardContent>
            {(upcoming.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing due this week.</p>}
            <ul className="space-y-2">
              {(upcoming.data ?? []).map((l: any) => (
                <li key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <div className="font-medium">{l.book_copies?.books?.title}</div>
                    <div className="text-xs text-muted-foreground">{l.members?.full_name} • {l.loan_number}</div>
                  </div>
                  <Badge variant="secondary">{fmtDate(l.due_at)}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {(recent.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          <ul className="divide-y">
            {(recent.data ?? []).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{a.action}</span>
                  {a.entity && <span className="text-muted-foreground"> • {a.entity}</span>}
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}