import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/library/app-shell";
import { AiChat } from "@/components/library/ai-chat";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Skip the profile-completion check if we're already going there
    if (location.pathname === "/complete-profile") return { user: data.user };

    // Check if this user is a member whose profile is incomplete (e.g. OAuth signup)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);

    const isMember = (roles ?? []).some((r: any) => r.role === "member");

    if (isMember) {
      const { data: member } = await supabase
        .from("members")
        .select("age, address")
        .eq("user_id", data.user.id)
        .maybeSingle();

      // Profile is incomplete — redirect to complete-profile page
      if (!member?.age || !member?.address) {
        throw redirect({ to: "/complete-profile" });
      }
    }

    return { user: data.user };
  },
  component: () => (
    <>
      <AppShell>
        <Outlet />
      </AppShell>
      <AiChat />
    </>
  ),
});