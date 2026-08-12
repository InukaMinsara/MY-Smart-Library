import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    let hasSession = false;
    try {
      const { data } = await supabase.auth.getSession();
      hasSession = !!data?.session;
    } catch (e) {
      // Ignore errors in SSR
    }
    
    if (hasSession) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/auth" });
    }
  },
  component: () => null,
});