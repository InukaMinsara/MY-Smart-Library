import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, BookOpen, Users, ArrowLeftRight, RotateCcw,
  BookMarked, FileBarChart, Settings, LogOut, Moon, Sun, Library,
  ShieldCheck, ScrollText, UserCircle, Coins, Bell, Heart, BellRing
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { ThemeSwitcher } from "@/components/landing/ThemeSwitcher";
import { MagneticButton } from "@/components/landing/MagneticButton";

// ─── Staff navigation ──────────────────────────────────────────────────────
const staffNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { title: "Books", url: "/books", icon: BookOpen, permission: "books" },
  { title: "Library Members", url: "/members", icon: Users, permission: "members" },
  { title: "Loans", url: "/loans", icon: ArrowLeftRight, permission: "loans" },
  { title: "Returns", url: "/returns", icon: RotateCcw, permission: "returns" },
  { title: "Reservations", url: "/reservations", icon: BookMarked, permission: "reservations" },
  { title: "Fines", url: "/fines", icon: Coins, permission: "fine_management" },
  { title: "Notifications", url: "/notifications", icon: Bell, permission: "notification_management" },
  { title: "Reports", url: "/reports", icon: FileBarChart, permission: "reports" },
];

const adminNav = [
  { title: "System Employees", url: "/users", icon: ShieldCheck, superAdminOnly: true },
  { title: "Notice Board", url: "/notices", icon: BellRing, superAdminOnly: true },
  { title: "Activity Logs", url: "/activity-logs", icon: ScrollText, permission: "activity_logs" },
  { title: "Settings", url: "/settings", icon: Settings, permission: "settings" },
];

// ─── Member navigation (completely isolated) ───────────────────────────────
const memberNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Books", url: "/books", icon: BookOpen },
  { title: "My Wishlist", url: "/wishlist", icon: Heart },
  { title: "Members", url: "/members", icon: Users },
  { title: "My Loans", url: "/loans", icon: ArrowLeftRight },
  { title: "My Returns", url: "/returns", icon: RotateCcw },
  { title: "My Reservations", url: "/reservations", icon: BookMarked },
  { title: "My Reports", url: "/reports", icon: FileBarChart },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "My Profile", url: "/profile", icon: UserCircle },
];

// ─── Member Sidebar ────────────────────────────────────────────────────────
function MemberSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex items-center justify-center rounded-lg">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="h-10 w-10 object-contain drop-shadow-md" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-black text-gradient uppercase tracking-wider">Smart Library</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Member Portal</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>My Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {memberNav.map((item) => {
                const active = pathname === item.url || pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-[10px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          v1.0 • Library Member
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── Staff Sidebar ─────────────────────────────────────────────────────────
function StaffSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, isSuperAdmin } = usePermissions();
  const visibleAdmin = adminNav.filter((i) => (i.superAdminOnly ? isSuperAdmin : can(i.permission!)));
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="flex items-center justify-center rounded-lg">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="h-10 w-10 object-contain drop-shadow-md" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-black text-gradient uppercase tracking-wider">Smart Library</span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Management Pro</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {staffNav.filter((i) => can(i.permission)).map((item) => {
                const active = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/profile"} tooltip="My Profile">
                  <Link to="/profile" className="flex items-center gap-2">
                    <UserCircle className="h-4 w-4" />
                    <span>My Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visibleAdmin.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdmin.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-[10px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          v1.0 • IMBS DIT2145
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

// ─── Top Bar ───────────────────────────────────────────────────────────────
function TopBar() {
  const { user, profile, isSuperAdmin, isMember, roles, isPending, isDisabled } = usePermissions();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme") === "dark";
    setDark(stored);
    document.documentElement.classList.toggle("dark", stored);
  }, []);

  const name = (profile as any)?.full_name || user?.email || "Guest";
  const subtitle = isMember ? "Library Member" : (profile as any)?.job_name || (profile as any)?.job_title || "Employee";
  const roleLabel = isSuperAdmin ? "Super Admin" : isMember ? "Member" : isDisabled ? "Disabled" : isPending ? "Pending" : (roles[0] ?? "").replace(/_/g, " ");
  const initials = String(name).slice(0, 2).toUpperCase();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-white/10 glass-extreme px-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300">
      <SidebarTrigger className="hover:bg-primary/20 transition-colors rounded-full text-foreground/80 hover:scale-110 active:scale-95" />
      <div className="flex-1" />
      <Badge
        className={cn(
          "px-3 py-1 shadow-sm transition-transform hover:scale-105", 
          isSuperAdmin ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 capitalize"
        )}
        variant={isSuperAdmin ? undefined : isMember ? "outline" : "secondary"}
      >
        {roleLabel}
      </Badge>
      
      {/* Cinematic Radial Theme Switcher */}
      <div className="scale-75 md:scale-90">
        <ThemeSwitcher />
      </div>

      <MagneticButton>
        <Link to="/profile" className="interactive flex items-center gap-3 rounded-full px-2 py-1.5 hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20 bg-background/50 backdrop-blur-md">
          <div className="hidden text-right text-xs leading-tight md:block">
            <div className="font-semibold">{name}</div>
            <div className="text-muted-foreground opacity-80">{subtitle}</div>
          </div>
          <Avatar className="h-9 w-9 border-2 border-background shadow-md">
            {(profile as any)?.avatar_url && <AvatarImage src={(profile as any).avatar_url} alt={String(name)} />}
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </MagneticButton>

      <MagneticButton>
        <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" className="interactive rounded-full hover:bg-destructive/20 hover:text-destructive transition-colors text-foreground/80 bg-background/50 backdrop-blur-md">
          <LogOut className="h-5 w-5" />
        </Button>
      </MagneticButton>
    </header>
  );
}

// ─── App Shell (routes based on user type) ─────────────────────────────────
export function AppShell({ children }: { children: ReactNode }) {
  const { isMember } = usePermissions();

  return (
    <SidebarProvider>
      {/* Noise Overlay */}
      <div className="noise-overlay" />
      
      {/* Animated Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/30 blur-[140px] animate-blob mix-blend-screen dark:mix-blend-lighten" />
        <div className="absolute top-[20%] right-[-10%] w-[45%] h-[50%] rounded-full bg-accent/30 blur-[140px] animate-blob mix-blend-screen dark:mix-blend-lighten" style={{ animationDelay: "2s" }} />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-secondary/40 blur-[140px] animate-blob mix-blend-screen dark:mix-blend-lighten" style={{ animationDelay: "4s" }} />
      </div>

      <div className="flex min-h-screen w-full bg-transparent overflow-hidden">
        {/* Render completely different sidebar based on account type */}
        {isMember ? <MemberSidebar /> : <StaffSidebar />}
        <div className="flex flex-1 flex-col relative z-10 min-w-0 overflow-x-hidden">
          <TopBar />
          <main className="flex-1 p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="max-w-[1600px] mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}