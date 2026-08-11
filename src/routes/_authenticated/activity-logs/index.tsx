import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { fmtDate } from "@/lib/library-utils";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/activity-logs/")({
  head: () => ({
    meta: [
      { title: "Activity Logs • Smart Library" },
      { name: "description", content: "Audit trail of staff actions across the library system." },
    ],
  }),
  component: () => (
    <PermissionGate permission="activity_logs">
      <LogsPage />
    </PermissionGate>
  ),
});

function LogsPage() {
  const [q, setQ] = useState("");
  const logs = useQuery({
    queryKey: ["activity-logs"],
    queryFn: async () =>
      (await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });

  const list = (logs.data ?? []).filter((l: any) =>
    !q || [l.action, l.entity].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <PageHeader title="Activity Logs" description="Audit trail of actions performed in the system." />
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search actions…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          {logs.isLoading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                      <TableCell><Badge variant="secondary">{l.action}</Badge></TableCell>
                      <TableCell>{l.entity ?? "—"}</TableCell>
                      <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                        {l.metadata ? JSON.stringify(l.metadata) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {list.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">No activity recorded.</TableCell></TableRow>
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