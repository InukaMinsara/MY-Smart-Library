import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/library/page-header";
import { AlertTriangle, Search, CheckCircle, Wrench, PackageX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/library/permission-gate";

export const Route = createFileRoute("/_authenticated/inventory-issues/")({
  component: InventoryIssuesPage,
  head: () => ({ meta: [{ title: "Inventory Issues • Smart Library" }] }),
});

function InventoryIssuesPage() {
  const queryClient = useQueryClient();
  const [searchBarcode, setSearchBarcode] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [resolvingCopy, setResolvingCopy] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reportStatus, setReportStatus] = useState("damaged");

  // Fetch only copies that are damaged or lost
  const { data: issues, isLoading } = useQuery({
    queryKey: ["inventory-issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_copies")
        .select(`*, books(title, author)`)
        .in("status", ["damaged", "lost"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchBarcode.trim()) return toast.error("Please enter a barcode");
    
    setSubmitting(true);
    try {
      // Find the copy
      const { data: copy, error: copyError } = await supabase
        .from("book_copies")
        .select("*")
        .eq("barcode", searchBarcode.trim())
        .maybeSingle();
        
      if (copyError || !copy) throw new Error("Copy not found with that barcode");

      if (copy.status === "borrowed") {
        throw new Error("This copy is currently borrowed. Please process a return first.");
      }

      const { error: updateError } = await supabase
        .from("book_copies")
        .update({ status: reportStatus as any })
        .eq("id", copy.id);
        
      if (updateError) throw updateError;
      
      toast.success(`Copy marked as ${reportStatus}`);
      setReportOpen(false);
      setSearchBarcode("");
      queryClient.invalidateQueries({ queryKey: ["inventory-issues"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to report issue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolveIssue = async (status: string) => {
    if (!resolvingCopy) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("book_copies")
        .update({ status: status as any })
        .eq("id", resolvingCopy.id);
        
      if (error) throw error;
      toast.success(`Copy status updated to ${status}`);
      setResolvingCopy(null);
      queryClient.invalidateQueries({ queryKey: ["inventory-issues"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "damaged") return <Badge variant="outline" className="text-orange-600 border-orange-500"><Wrench className="mr-1 h-3 w-3" /> Damaged</Badge>;
    if (status === "lost") return <Badge variant="destructive"><PackageX className="mr-1 h-3 w-3" /> Lost</Badge>;
    return <Badge>{status}</Badge>;
  };

  return (
    <PermissionGate permission="books">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <PageHeader 
            title="Inventory Issues" 
            description="Manage books that are damaged, lost, or need repair."
          />
          
          <Dialog open={reportOpen} onOpenChange={setReportOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive"><AlertTriangle className="mr-2 h-4 w-4" /> Report Issue</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Damaged or Lost Book</DialogTitle>
                <CardDescription>Enter the barcode of the specific copy to flag it.</CardDescription>
              </DialogHeader>
              <form onSubmit={handleReportIssue} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Book Barcode *</Label>
                  <Input 
                    value={searchBarcode} 
                    onChange={e => setSearchBarcode(e.target.value)} 
                    placeholder="E.g. BK-2023-001" 
                    required 
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Issue Type</Label>
                  <Select value={reportStatus} onValueChange={setReportStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="damaged">Damaged (Needs Repair)</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="pt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Flag Copy
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
            ) : !issues || issues.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p>All clear! No damaged or lost books in the inventory.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Book Details</TableHead>
                      <TableHead>Issue Type</TableHead>
                      <TableHead>Reported On</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {issues.map((copy: any) => (
                      <TableRow key={copy.id}>
                        <TableCell className="font-mono font-medium">{copy.barcode}</TableCell>
                        <TableCell>
                          <div className="font-semibold">{copy.books?.title}</div>
                          <div className="text-xs text-muted-foreground">{copy.books?.author}</div>
                        </TableCell>
                        <TableCell>{getStatusBadge(copy.status)}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(copy.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setResolvingCopy(copy)}
                          >
                            Resolve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolve Dialog */}
        <Dialog open={!!resolvingCopy} onOpenChange={(open) => !open && setResolvingCopy(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Resolve Inventory Issue</DialogTitle>
              <CardDescription>
                How would you like to update the status of barcode <strong>{resolvingCopy?.barcode}</strong>?
              </CardDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-4">
              <Button 
                variant="outline" 
                className="justify-start"
                onClick={() => handleResolveIssue("available")}
                disabled={submitting}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                Repaired / Found (Make Available)
              </Button>
              <Button 
                variant="outline" 
                className="justify-start text-destructive hover:bg-destructive/10"
                onClick={() => handleResolveIssue("lost")}
                disabled={submitting || resolvingCopy?.status === "lost"}
              >
                <PackageX className="mr-2 h-4 w-4" />
                Mark as Lost Permanently
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}
