import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BellRing, Calendar, AlertCircle, Info, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/library/permission-gate";
import { PageHeader } from "@/components/library/page-header";

export const Route = createFileRoute("/_authenticated/notices")({
  component: NoticesPage,
  head: () => ({ meta: [{ title: "Manage Notices • Smart Library" }] }),
});

function NoticesPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState("info");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: notices, isLoading } = useQuery({
    queryKey: ["admin-notices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Notices fetch error:", error);
        return [];
      }
      return data || [];
    }
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "event": return <Calendar className="h-5 w-5 text-blue-500" />;
      case "holiday": return <BellRing className="h-5 w-5 text-green-500" />;
      case "alert": return <AlertCircle className="h-5 w-5 text-destructive" />;
      default: return <Info className="h-5 w-5 text-primary" />;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return toast.error("Please fill in all required fields");
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from("notices" as any).insert({
        title,
        content,
        type,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: user?.id
      });
      
      if (error) throw error;
      toast.success("Notice created successfully!");
      setIsOpen(false);
      setTitle("");
      setContent("");
      setType("info");
      setExpiresAt("");
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["active-notices"] }); // Update member dashboard
    } catch (err: any) {
      toast.error(err.message || "Failed to create notice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this notice?")) return;
    try {
      const { error } = await supabase.from("notices" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Notice deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-notices"] });
      queryClient.invalidateQueries({ queryKey: ["active-notices"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <PermissionGate permission="settings">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader 
            title="Notice Board" 
            description="Manage announcements, events, and alerts for library members."
          />
          
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> New Notice</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create New Notice</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. Library closed on Monday" required />
                </div>
                
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">General Information</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="holiday">Holiday / Closure</SelectItem>
                      <SelectItem value="alert">Important Alert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Content *</Label>
                  <Textarea 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="Notice details..." 
                    rows={4}
                    required 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Expiry Date (Optional)</Label>
                  <Input 
                    type="datetime-local" 
                    value={expiresAt} 
                    onChange={e => setExpiresAt(e.target.value)} 
                  />
                  <p className="text-xs text-muted-foreground">The notice will be hidden from members after this date.</p>
                </div>
                
                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish Notice
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !notices || notices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BellRing className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No notices found. Create one to notify your members.</p>
              </div>
            ) : (
              <div className="divide-y">
                {notices.map((notice: any) => {
                  const isExpired = notice.expires_at && new Date(notice.expires_at) < new Date();
                  return (
                    <div key={notice.id} className={`p-4 sm:p-6 flex flex-col sm:flex-row gap-4 justify-between items-start ${isExpired ? "opacity-60 bg-muted/30" : ""}`}>
                      <div className="flex gap-4">
                        <div className="mt-1 bg-background p-2 rounded-lg border shadow-sm shrink-0">
                          {getIcon(notice.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg">{notice.title}</h3>
                            {isExpired && <span className="text-xs bg-muted px-2 py-0.5 rounded-md font-medium">Expired</span>}
                          </div>
                          <p className="text-muted-foreground whitespace-pre-wrap max-w-3xl">{notice.content}</p>
                          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground font-medium">
                            <span>Posted: {new Date(notice.created_at).toLocaleString()}</span>
                            {notice.expires_at && <span>Expires: {new Date(notice.expires_at).toLocaleString()}</span>}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={() => handleDelete(notice.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
