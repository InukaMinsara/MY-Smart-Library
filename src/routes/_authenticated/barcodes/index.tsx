import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate } from "@/components/library/permission-gate";
import { Search, Printer, Loader2, ScanBarcode } from "lucide-react";
import Barcode from "react-barcode";
import { useReactToPrint } from "react-to-print";

export const Route = createFileRoute("/_authenticated/barcodes/")({
  component: BarcodeGeneratorPage,
  head: () => ({ meta: [{ title: "Barcode Labels • Smart Library" }] }),
});

function BarcodeGeneratorPage() {
  const [search, setSearch] = useState("");
  const [selectedCopies, setSelectedCopies] = useState<string[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: copies, isLoading } = useQuery({
    queryKey: ["book_copies_for_barcodes", search],
    queryFn: async () => {
      let query = supabase
        .from("book_copies")
        .select(`*, books(title, author)`)
        .order("created_at", { ascending: false })
        .limit(50);

      if (search) {
        // Simple search logic
        query = query.or(`barcode.ilike.%${search}%,books.title.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Library_Barcode_Labels',
  });

  const toggleSelection = (id: string) => {
    setSelectedCopies(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (!copies) return;
    if (selectedCopies.length === copies.length) {
      setSelectedCopies([]);
    } else {
      setSelectedCopies(copies.map(c => c.id));
    }
  };

  const selectedData = copies?.filter(c => selectedCopies.includes(c.id)) || [];

  return (
    <PermissionGate permission="books">
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
        <PageHeader 
          title="Print Barcode Labels" 
          description="Select books and generate printable standard barcode sticker labels."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Side: Selection */}
          <Card className="lg:col-span-2 flex flex-col min-h-[600px]">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center">
                <CardTitle className="flex items-center gap-2">
                  <ScanBarcode className="h-5 w-5 text-primary" /> Select Copies
                </CardTitle>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by title or barcode..." 
                    className="pl-9 bg-background"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
              {isLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="flex items-center p-4 bg-muted/30">
                    <Checkbox 
                      checked={copies?.length > 0 && selectedCopies.length === copies?.length}
                      onCheckedChange={selectAll}
                      className="mr-4"
                    />
                    <span className="text-sm font-medium">Select All ({copies?.length || 0})</span>
                  </div>
                  {copies?.map(copy => (
                    <div 
                      key={copy.id} 
                      className={`flex items-center p-4 hover:bg-muted/50 cursor-pointer transition-colors ${selectedCopies.includes(copy.id) ? 'bg-primary/5' : ''}`}
                      onClick={() => toggleSelection(copy.id)}
                    >
                      <Checkbox 
                        checked={selectedCopies.includes(copy.id)}
                        onCheckedChange={() => toggleSelection(copy.id)}
                        className="mr-4 pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{copy.books?.title}</div>
                        <div className="text-sm text-muted-foreground truncate">{copy.books?.author}</div>
                      </div>
                      <Badge variant="outline" className="ml-2 whitespace-nowrap font-mono">
                        {copy.barcode}
                      </Badge>
                    </div>
                  ))}
                  {copies?.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">No copies found.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Side: Preview & Print */}
          <Card className="flex flex-col h-fit sticky top-6">
            <CardHeader className="bg-primary/5 border-b border-border/50">
              <CardTitle>Print Preview</CardTitle>
              <CardDescription>{selectedCopies.length} labels selected</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {selectedCopies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <ScanBarcode className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Select copies from the list to preview and print labels.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border border-border rounded-lg p-4 bg-background max-h-[300px] overflow-auto shadow-inner flex flex-col gap-4 items-center">
                    {/* Visual Preview (Not for actual print layout, just to see them) */}
                    {selectedData.map(c => (
                      <div key={c.id} className="border p-3 rounded bg-white text-black w-[250px] flex flex-col items-center shadow-sm">
                        <div className="text-[10px] font-bold text-center truncate w-full mb-1">{c.books?.title}</div>
                        <Barcode value={c.barcode} width={1.5} height={40} fontSize={12} margin={0} />
                      </div>
                    ))}
                  </div>
                  
                  <Button onClick={handlePrint} className="w-full h-12" size="lg">
                    <Printer className="mr-2 h-5 w-5" /> Print {selectedCopies.length} Labels
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hidden Print Container */}
      <div className="hidden">
        <div ref={printRef} className="print-container">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page { margin: 0.5in; }
              body { -webkit-print-color-adjust: exact; }
              .label-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 0.5in 0.2in;
              }
              .barcode-label {
                border: 1px dashed #ccc;
                padding: 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                page-break-inside: avoid;
                font-family: Arial, sans-serif;
              }
              .barcode-title {
                font-size: 11px;
                font-weight: bold;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                margin-bottom: 5px;
              }
            }
          `}} />
          <div className="label-grid">
            {selectedData.map(c => (
              <div key={c.id} className="barcode-label">
                <div className="barcode-title">{c.books?.title}</div>
                <Barcode value={c.barcode} width={1.5} height={50} fontSize={14} margin={5} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </PermissionGate>
  );
}
