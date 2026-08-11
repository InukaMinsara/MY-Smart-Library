import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, Clock, Ban } from "lucide-react";
import { usePermissions } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** Blocks a whole page unless the user holds the permission (URL-typing safe). */
export function PermissionGate({
  permission,
  superAdminOnly,
  children,
}: {
  permission?: string;
  superAdminOnly?: boolean;
  children: ReactNode;
}) {
  const { can, isSuperAdmin, ready, isPending, isDisabled } = usePermissions();

  if (!ready) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isPending || isDisabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          {isPending ? <Clock className="h-7 w-7 text-muted-foreground" /> : <Ban className="h-7 w-7 text-destructive" />}
        </div>
        <h1 className="text-xl font-semibold">
          {isPending ? "Account awaiting approval" : "Account disabled"}
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {isPending
            ? "Your account has been created but no role or permissions have been assigned yet. The Super Admin must approve it before you can use the system."
            : "Your access has been switched off by the Super Admin. Contact them to have it restored."}
        </p>
        <Button asChild className="mt-6" variant="outline"><Link to="/profile">Go to my profile</Link></Button>
      </div>
    );
  }

  const allowed = superAdminOnly ? isSuperAdmin : !permission || can(permission);
  if (allowed) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        You don't have permission to view this page. Contact the Super Admin if you need access.
      </p>
      <Button asChild className="mt-6" variant="outline"><Link to="/profile">Go to my profile</Link></Button>
    </div>
  );
}

/** Inline element guard for buttons and actions. */
export function Can({ permission, superAdminOnly, children }: { permission?: string; superAdminOnly?: boolean; children: ReactNode }) {
  const { can, isSuperAdmin } = usePermissions();
  const allowed = superAdminOnly ? isSuperAdmin : !permission || can(permission);
  return allowed ? <>{children}</> : null;
}