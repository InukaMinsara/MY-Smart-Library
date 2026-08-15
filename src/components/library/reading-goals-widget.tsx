import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Target, Trophy, Loader2, BookOpen } from "lucide-react";
import { toast } from "sonner";

export function ReadingGoalsWidget() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  
  const [isEditing, setIsEditing] = useState(false);
  const [targetBooks, setTargetBooks] = useState("12");
  const [submitting, setSubmitting] = useState(false);

  const { data: member } = useQuery({
    queryKey: ["current-member-id-goals"],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from("members").select("id").eq("email", user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email
  });

  const { data: goal, isLoading: loadingGoal } = useQuery({
    queryKey: ["reading-goal", member?.id, currentYear],
    queryFn: async () => {
      if (!member?.id) return null;
      const { data, error } = await supabase
        .from("reading_goals" as any)
        .select("*")
        .eq("member_id", member.id)
        .eq("year", currentYear)
        .maybeSingle();

      if (error && error.code !== "PGRST116") console.error(error);
      if (data && !isEditing) setTargetBooks(data.target_books.toString());
      return data;
    },
    enabled: !!member?.id
  });

  // Calculate how many books borrowed/read this year
  const { data: readCount, isLoading: loadingCount } = useQuery({
    queryKey: ["read-count", member?.id, currentYear],
    queryFn: async () => {
      if (!member?.id) return 0;
      const startOfYear = new Date(currentYear, 0, 1).toISOString();
      const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59).toISOString();
      
      const { count, error } = await supabase
        .from("loans")
        .select("*", { count: "exact", head: true })
        .eq("member_id", member.id)
        .gte("issued_at", startOfYear)
        .lte("issued_at", endOfYear);

      if (error) console.error(error);
      return count || 0;
    },
    enabled: !!member?.id
  });

  const saveGoal = async () => {
    if (!member?.id) return;
    const target = parseInt(targetBooks);
    if (isNaN(target) || target < 1) return toast.error("Please enter a valid number greater than 0");

    setSubmitting(true);
    try {
      if (goal) {
        await supabase.from("reading_goals" as any).update({ target_books: target }).eq("id", goal.id);
      } else {
        await supabase.from("reading_goals" as any).insert({
          member_id: member.id,
          year: currentYear,
          target_books: target
        });
      }
      toast.success("Reading goal updated!");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["reading-goal", member.id, currentYear] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = loadingGoal || loadingCount;
  const target = (goal as any)?.target_books || 0;
  const progressPercent = target > 0 ? Math.min(100, Math.round((readCount / target) * 100)) : 0;

  return (
    <Card className="shadow-lg overflow-hidden border-0 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent pointer-events-none" />
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> {currentYear} Reading Goal
          </div>
          {goal && !isEditing && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setIsEditing(true)}>
              Edit Goal
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !goal || isEditing ? (
          <div className="space-y-4 relative z-10 p-2">
            <p className="text-sm text-muted-foreground">Set a goal for how many books you want to read this year.</p>
            <div className="flex gap-2">
              <Input 
                type="number" 
                value={targetBooks} 
                onChange={(e) => setTargetBooks(e.target.value)}
                placeholder="E.g. 12"
                min="1"
              />
              <Button onClick={saveGoal} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
              {isEditing && (
                <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={submitting}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 relative z-10 pt-2">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-4xl font-bold tracking-tight">{readCount}</span>
                <span className="text-muted-foreground ml-1">/ {target} books</span>
              </div>
              {progressPercent >= 100 && (
                <Trophy className="h-8 w-8 text-yellow-500 fill-yellow-500 animate-bounce" />
              )}
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span>Progress</span>
                <span>{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
            
            {progressPercent >= 100 ? (
              <p className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-500/10 p-2 rounded-md">
                🎉 Congratulations! You reached your reading goal for {currentYear}!
              </p>
            ) : (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" /> {target - (readCount as number)} more books to go!
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
