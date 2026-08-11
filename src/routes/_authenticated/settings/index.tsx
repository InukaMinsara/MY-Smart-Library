import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/")({
  head: () => ({ meta: [{ title: "Settings • Smart Library" }, { name: "description", content: "Admin settings." }] }),
  component: () => (
    <PermissionGate permission="settings">
      <SettingsPage />
    </PermissionGate>
  ),
});

function SettingsPage() {
  const qc = useQueryClient();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const roles = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*, profiles!inner(full_name, email)")).data ?? [],
  });

  const addCategory = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name, description: String(fd.get("description") ?? "") || null });
    if (error) return toast.error(error.message);
    toast.success("Category added");
    form.reset();
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Admin-only: manage categories and roles." />

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addCategory} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]"><Label>Name</Label><Input name="name" required /></div>
            <div className="flex-1 min-w-[240px]"><Label>Description</Label><Input name="description" /></div>
            <Button type="submit">Add</Button>
          </form>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead></TableRow></TableHeader>
            <TableBody>
              {(categories.data ?? []).map((c: any) => (
                <TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Staff Accounts</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
            <TableBody>
              {(roles.data ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell>{r.profiles?.email ?? "—"}</TableCell>
                  <TableCell className="uppercase text-xs font-mono">{r.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}