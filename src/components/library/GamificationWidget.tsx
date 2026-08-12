import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, Zap, Flame, Crown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function GamificationWidget() {
  const { profile } = usePermissions();
  const memberId = profile?.id;

  const stats = useQuery({
    queryKey: ["gamification-stats", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      // Fetch all loans to calculate XP
      const { data: allLoans } = await supabase.from("loans").select("status").eq("member_id", memberId);
      
      const activeCount = allLoans?.filter(l => l.status === 'active').length || 0;
      const returnedCount = allLoans?.filter(l => l.status === 'returned').length || 0;
      
      // Calculate XP
      const xp = (activeCount * 50) + (returnedCount * 150);
      const level = Math.floor(xp / 500) + 1;
      const currentLevelXp = xp % 500;
      const xpToNext = 500 - currentLevelXp;
      const progressPercent = (currentLevelXp / 500) * 100;

      // Determine Badges
      const badges = [];
      if (allLoans && allLoans.length > 0) badges.push({ name: "First Book", icon: Star, color: "text-yellow-400", bg: "bg-yellow-400/10" });
      if (returnedCount > 0) badges.push({ name: "Reliable Reader", icon: Trophy, color: "text-blue-400", bg: "bg-blue-400/10" });
      if (level >= 3) badges.push({ name: "Bookworm", icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10" });
      if (level >= 5) badges.push({ name: "Library Elite", icon: Crown, color: "text-purple-400", bg: "bg-purple-400/10" });
      if (activeCount >= 2) badges.push({ name: "Multi-tasker", icon: Zap, color: "text-green-400", bg: "bg-green-400/10" });

      return { xp, level, xpToNext, progressPercent, badges };
    },
  });

  if (!stats.data) return null;

  return (
    <Card className="glass-extreme border-primary/20 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none z-0" />
      
      <CardHeader className="relative z-10 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Reader Profile
        </CardTitle>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-3xl font-black text-white">LVL {stats.data.level}</div>
            <div className="text-xs text-muted-foreground">{stats.data.xp} Total XP</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-primary">{stats.data.xpToNext} XP</div>
            <div className="text-xs text-muted-foreground">to next level</div>
          </div>
        </div>
        
        <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden mb-6">
           <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-out" style={{ width: `${stats.data.progressPercent}%` }} />
           {/* Animated glow on progress bar */}
           <div className="absolute top-0 left-0 h-full w-20 bg-white/30 blur-sm mix-blend-overlay -skew-x-12 animate-[slide_2s_infinite]" />
        </div>

        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Unlocked Badges</h4>
        <div className="flex flex-wrap gap-2">
          {stats.data.badges.map((badge, idx) => {
            const Icon = badge.icon;
            return (
              <div key={idx} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/5 ${badge.bg}`} title={badge.name}>
                <Icon className={`w-3.5 h-3.5 ${badge.color}`} />
                <span className={`text-xs font-medium ${badge.color}`}>{badge.name}</span>
              </div>
            );
          })}
          {stats.data.badges.length === 0 && (
            <div className="text-xs text-muted-foreground">Borrow a book to earn your first badge!</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
