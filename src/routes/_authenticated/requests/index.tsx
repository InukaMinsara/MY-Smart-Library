import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/library/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Plus, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/requests/")({
  component: BookRequestsPage,
  head: () => ({ meta: [{ title: "Book Requests • Smart Library" }] }),
});

function BookRequestsPage() {
  const { user } = useCurrentUser();
  const { isMember, isSuperAdmin, can } = usePermissions();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // Member Form State
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Admin Update State
  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [newStatus, setNewStatus] = useState("pending");

  const { data: requests, isLoading } = useQuery({
    queryKey: ["book-requests"],
    queryFn: async () => {
      // If admin, fetch all with member info. If member, RLS will filter to just their own.
      const query = supabase
        .from("book_requests" as any)
        .select(`*, members(full_name, member_number)`)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !author) return toast.error("Please fill in the title and author");
    
    setSubmitting(true);
    try {
      // Fetch member_id for the current user
      const { data: memberData } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", user?.id)
        .single();
        
      if (!memberData) throw new Error("Member record not found");

      const { error } = await supabase.from("book_requests" as any).insert({
        member_id: memberData.id,
        title,
        author,
        reason,
        status: "pending"
      });
      
      if (error) throw error;
      toast.success("Book request submitted successfully!");
      setIsOpen(false);
      setTitle("");
      setAuthor("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["book-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("book_requests" as any)
        .update({ status: newStatus })
        .eq("id", selectedRequest.id);
        
      if (error) throw error;
      toast.success("Request status updated!");
      setUpdateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["book-requests"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "purchased": return <Badge className="bg-green-500"><CheckCircle2 className="mr-1 h-3 w-3" /> Purchased</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" /> Rejected</Badge>;
      default: return <Badge variant="outline" className="text-yellow-600 border-yellow-500"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
    }
  };

  const isAdminView = !isMember && (isSuperAdmin || can("books"));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Book Requests" 
          description={isAdminView ? "Review and manage books requested by members." : "Can't find a book? Suggest it to the library!"}
        />
        
        {isMember && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Suggest a Book</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Suggest a New Book</DialogTitle>
                <CardDescription>We'll review your suggestion and consider buying it for the library.</CardDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Title *</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="E.g. The Martian" required />
                </div>
                <div className="space-y-2">
                  <Label>Author *</Label>
                  <Input value={author} onChange={e => setAuthor(e.target.value)} placeholder="E.g. Andy Weir" required />
                </div>
                <div className="space-y-2">
                  <Label>Why should we get this? (Optional)</Label>
                  <Textarea 
                    value={reason} 
                    onChange={e => setReason(e.target.value)} 
                    placeholder="It's a very popular sci-fi book that many people are looking for..." 
                    rows={3}
                  />
                </div>
                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit Request
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : !requests || requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No book requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book</TableHead>
                    {isAdminView && <TableHead>Requested By</TableHead>}
                    <TableHead>Reason</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdminView && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req: any) => (
                    <TableRow key={req.id}>
                      <TableCell>
                        <div className="font-semibold">{req.title}</div>
                        <div className="text-xs text-muted-foreground">by {req.author}</div>
                      </TableCell>
                      {isAdminView && (
                        <TableCell>
                          <div className="font-medium">{req.members?.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{req.members?.member_number}</div>
                        </TableCell>
                      )}
                      <TableCell className="max-w-[200px] truncate" title={req.reason}>
                        {req.reason || <span className="text-muted-foreground italic">None provided</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(req.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(req.status)}
                      </TableCell>
                      {isAdminView && (
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setNewStatus(req.status);
                              setUpdateOpen(true);
                            }}
                          >
                            Update
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Update Dialog */}
      {isAdminView && (
        <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Update Request Status</DialogTitle>
              <CardDescription>
                {selectedRequest?.title} by {selectedRequest?.author}
              </CardDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="purchased">Purchased</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUpdateOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateStatus} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
