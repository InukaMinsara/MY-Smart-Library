import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { fmtDateTime, exportCSV } from "@/lib/library-utils";
import { Search, Download, BellOff, Send, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications/")({
  head: () => ({
    meta: [
      { title: "Notifications • Smart Library" },
      { name: "description", content: "Your library notifications and reminders." },
    ],
  }),
  component: () => {
    const { isMember } = usePermissions();
    if (isMember) return <MemberNotificationsPage />;
    return (
      <PermissionGate permission="notification_management">
        <StaffNotificationsPage />
      </PermissionGate>
    );
  },
});

// ─── MEMBER VIEW: only their own notifications ─────────────────────────────
function MemberNotificationsPage() {
  const { user } = usePermissions();

  const list = useQuery({
    queryKey: ["my-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get the member record for this user
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!member) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, subject, scheduled_for, sent_at, status")
        .eq("member_id", member.id)
        .order("scheduled_for", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = list.data ?? [];
  const unread = rows.filter((r: any) => r.status === "pending").length;

  const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
    sent: "default", pending: "secondary", cancelled: "destructive", failed: "destructive",
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Notifications"
        description="Your library reminders, loan alerts and reservation updates."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold">{unread}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Sent</div>
          <div className="text-2xl font-bold text-primary">{rows.filter((r: any) => r.status === "sent").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold text-muted-foreground">{rows.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          {list.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bell className="h-10 w-10 opacity-30" />
              <p className="text-sm">You have no notifications yet.</p>
              <p className="text-xs opacity-70">Reminders will appear here when you borrow books.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((n: any) => (
                    <TableRow key={n.id}>
                      <TableCell className="capitalize font-medium">{String(n.type).replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{n.subject}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDateTime(n.scheduled_for)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[n.status] ?? "secondary"} className="capitalize">{n.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── STAFF VIEW: all notifications (unchanged) ─────────────────────────────
type Row = {
  id: string; type: string; recipient_email: string | null; subject: string;
  scheduled_for: string | null; sent_at: string | null; status: string;
  members: { full_name: string; member_number: string } | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  sent: "default", pending: "secondary", cancelled: "destructive", failed: "destructive",
};

function StaffNotificationsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, recipient_email, subject, scheduled_for, sent_at, status, members(full_name, member_number)")
        .order("scheduled_for", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reminder cancelled"); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not cancel"),
  });

  const markSent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Marked as sent"); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Could not update"),
  });

  const rows = (list.data ?? []).filter((n) =>
    !q || [n.subject, n.recipient_email, n.members?.full_name, n.type].some((v) =>
      String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        description="Return reminders and reservation alerts queued for members."
        actions={
          <Button variant="outline" onClick={() => exportCSV("notifications.csv", rows.map((n) => ({
            member: n.members?.full_name, email: n.recipient_email, type: n.type,
            subject: n.subject, scheduled_for: n.scheduled_for, status: n.status,
          })))}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Queued</div>
          <div className="text-2xl font-bold">{pending}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Sent</div>
          <div className="text-2xl font-bold text-primary">{rows.filter((r) => r.status === "sent").length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Cancelled</div>
          <div className="text-2xl font-bold text-muted-foreground">{rows.filter((r) => r.status === "cancelled").length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search reminders…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>

          {list.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead><TableHead>Type</TableHead><TableHead>Subject</TableHead>
                    <TableHead>Scheduled</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="font-medium">{n.members?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{n.recipient_email ?? "no email"}</div>
                      </TableCell>
                      <TableCell className="capitalize">{n.type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{n.subject}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDateTime(n.scheduled_for)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[n.status] ?? "secondary"} className="capitalize">{n.status}</Badge>
                      </TableCell>
                      <TableCell className="space-x-1 text-right">
                        <Button size="icon" variant="ghost" title="Mark as sent" disabled={n.status !== "pending"}
                          onClick={() => markSent.mutate(n.id)}>
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Cancel reminder" disabled={n.status !== "pending"}
                          onClick={() => cancel.mutate(n.id)}>
                          <BellOff className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No notifications yet. Reminders are queued automatically when a loan is issued.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}