import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/library/page-header";
import { usePermissions } from "@/hooks/use-current-user";
import { PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";
import { HolographicCard } from "@/components/library/HolographicCard";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "My Profile • Smart Library" },
      { name: "description", content: "Update your own name, phone, password and profile picture." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const { user, profile, isSuperAdmin, permissions, ready } = usePermissions();
  const [saving, setSaving] = useState(false);

  if (!ready) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;

  const saveProfile = async (fd: FormData): Promise<void> => {
    setSaving(true);
    const updates = {
      full_name: String(fd.get("full_name") ?? ""),
      phone: String(fd.get("phone") ?? "") || null,
      avatar_url: String(fd.get("avatar_url") ?? "") || null,
    };
    
    let error = null;
    if (profile?.type === "member") {
      const { error: err } = await supabase.from("members").update(updates).eq("user_id", user!.id);
      error = err;
    } else {
      const { error: err } = await supabase.from("profiles").update(updates).eq("id", user!.id);
      error = err;
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${user!.id}-${Math.random()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
    
    if (uploadError) {
      toast.error(uploadError.message);
      setSaving(false);
      return;
    }
    
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const updates = { avatar_url: data.publicUrl };
    
    if (profile?.type === "member") {
      await supabase.from("members").update(updates).eq("user_id", user!.id);
    } else {
      await supabase.from("profiles").update(updates).eq("id", user!.id);
    }
    
    toast.success("Profile picture updated!");
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    setSaving(false);
  };

  const changePassword = async (fd: FormData): Promise<void> => {
    const pw = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (pw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    if (pw !== confirm) { toast.error("Passwords do not match"); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password changed");
  };

  const granted: string[] =
    permissions === "all" ? PERMISSIONS.map((p) => p.key as string) : (permissions as string[]);

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="You can only edit your own account details." />

      <div className="mb-10">
        <HolographicCard profile={profile} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Account details</CardTitle></CardHeader>
          <CardContent>
            <form action={saveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {(profile as any)?.avatar_url && <AvatarImage src={(profile as any).avatar_url} alt={(profile as any)?.full_name ?? ""} />}
                  <AvatarFallback>{((profile as any)?.full_name || user?.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Label>Profile picture</Label>
                  <Input type="file" accept="image/*" onChange={uploadAvatar} disabled={saving} />
                  <Input name="avatar_url" type="hidden" value={(profile as any)?.avatar_url ?? ""} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Name</Label><Input name="full_name" defaultValue={(profile as any)?.full_name ?? ""} required /></div>
                <div><Label>Phone</Label><Input name="phone" defaultValue={(profile as any)?.phone ?? ""} /></div>
                <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
                <div><Label>Job title</Label><Input value={(profile as any)?.job_name || (profile as any)?.job_title || "—"} disabled /></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Job title, role and permissions can only be changed by the Super Admin.
              </p>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Access</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <Badge className={isSuperAdmin ? "bg-accent text-accent-foreground" : ""} variant={isSuperAdmin ? undefined : "secondary"}>
                  {isSuperAdmin ? "Super Admin" : (profile as any)?.job_title ?? "Employee"}
                </Badge>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Permissions</div>
                <div className="flex flex-wrap gap-1">
                  {granted.length === 0 && <span className="text-sm text-muted-foreground">No modules enabled.</span>}
                  {granted.map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px]">
                      {PERMISSIONS.find((p) => p.key === k)?.label ?? k}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
            <CardContent>
              <form action={changePassword} className="space-y-3">
                <div><Label>New password</Label><Input name="password" type="password" minLength={8} required /></div>
                <div><Label>Confirm password</Label><Input name="confirm" type="password" minLength={8} required /></div>
                <Button type="submit" variant="outline">Update password</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}