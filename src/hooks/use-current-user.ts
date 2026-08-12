import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useCurrentRole() {
  const { user } = useCurrentUser();
  return useQuery({
    queryKey: ["role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      const roles = (data ?? []).map((r) => String(r.role));
      return {
        roles,
        isSuperAdmin: roles.includes("super_admin"),
        isAdmin: roles.includes("admin") || roles.includes("super_admin"),
        isLibrarian: roles.includes("librarian"),
        isMember: roles.includes("member"),
      };
    },
  });
}

export function useMyProfile() {
  const { user } = useCurrentUser();
  const role = useCurrentRole();

  return useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user && !role.isLoading,
    queryFn: async () => {
      const isMember = role.data?.isMember ?? false;

      if (isMember) {
        // Library Members: look up in members table by user_id
        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (member) return { ...member, type: "member" };
        // Member row doesn't exist yet — return a minimal active profile so they aren't blocked
        return { type: "member", status: "active", full_name: user!.email, user_id: user!.id };
      }

      // Staff: look up in profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (profile) return { ...profile, type: "staff" };

      return null;
    },
  });
}

/** Central RBAC hook: role + granted module permissions. */
export function usePermissions() {
  const { user, loading } = useCurrentUser();
  const role = useCurrentRole();
  const profile = useMyProfile();

  const perms = useQuery({
    queryKey: ["my-permissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_permissions").select("permission").eq("user_id", user!.id);
      return (data ?? []).map((p) => p.permission as string);
    },
  });

  const isSuperAdmin = !!role.data?.isSuperAdmin;
  // If a user is a super_admin, they must never be restricted to the member view.
  const isMember = !!(role.data?.isMember) && !isSuperAdmin;
  const granted = perms.data ?? [];
  const profileData = profile.data as any;
  const status = profileData?.status as string | undefined;

  // Members are ALWAYS considered active — they are never "pending"
  // Staff are active only when their profile status is 'active'
  const isActive = isSuperAdmin || isMember || status === "active";

  // "Pending" only applies to staff accounts waiting for approval
  const isPending = !isSuperAdmin && !isMember && (!status || status === "pending");
  const isDisabled = !isSuperAdmin && !isMember && status === "disabled";

  return {
    user,
    profile: profile.data ?? null,
    isSuperAdmin,
    isMember,
    status: status ?? (isMember ? "active" : "pending"),
    isPending,
    isDisabled,
    isActive,
    roles: role.data?.roles ?? [],
    permissions: isSuperAdmin ? "all" : granted,
    // Members can access 'dashboard', 'books', and 'reservations'
    can: (p: string) =>
      isSuperAdmin ||
      (isActive && !isMember && granted.includes(p)) ||
      (isMember && ["dashboard", "books", "reservations", "notifications"].includes(p)),
    ready: !loading && !role.isLoading && !perms.isLoading && !profile.isLoading,
  };
}