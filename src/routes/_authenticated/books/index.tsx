import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { PageHeader } from "@/components/library/page-header";
import { PermissionGate, Can } from "@/components/library/permission-gate";
import { usePermissions } from "@/hooks/use-current-user";
import { QRCodeSVG } from "qrcode.react";
import { exportCSV } from "@/lib/library-utils";
import { Plus, Search, Download, Pencil, Trash2, Boxes, QrCode, Check, ChevronsUpDown, FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/books/")({
  head: () => ({ meta: [{ title: "Books • Smart Library" }, { name: "description", content: "Manage the library book catalog." }] }),
  component: () => (
    <PermissionGate permission="books">
      <BooksPage />
    </PermissionGate>
  ),
});

function BooksPage() {
  const qc = useQueryClient();
  const { can, isSuperAdmin, isMember } = usePermissions();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [selectedBookForQr, setSelectedBookForQr] = useState<any | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [addCopyOpen, setAddCopyOpen] = useState(false);
  const [addCopyBook, setAddCopyBook] = useState<any | null>(null);
  const [newCopyBarcode, setNewCopyBarcode] = useState("");

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  // Track selected category ID separately so we can update it when a new one is created
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(editing?.category_id ?? "none");

  const books = useQuery({
    queryKey: ["books"],
    queryFn: async () => (await supabase.from("books").select("*, categories(name), book_copies(id,status)").order("created_at", { ascending: false })).data ?? [],
  });

  // Create a new category inline and auto-select it
  const createCategory = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { data, error } = await supabase.from("categories").insert({ name: trimmed }).select().single();
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["categories"] });
    setSelectedCategoryId(data.id);
    toast.success(`Category "${trimmed}" created and selected!`);
  };

  const filtered = (books.data ?? []).filter((b: any) => {
    const matches = !q || [b.title, b.author, b.isbn, b.book_number].some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase()));
    const catOk = cat === "all" || b.category_id === cat;
    return matches && catOk;
  });

  const save = async (form: FormData): Promise<void> => {
    let new_cover_url = editing?.cover_url || null;
    if (coverFile) {
      const fileExt = coverFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("book-covers").upload(fileName, coverFile);
      if (uploadError) {
        toast.error("Error uploading cover: " + uploadError.message);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("book-covers").getPublicUrl(fileName);
      new_cover_url = publicUrl;
    }

    const payload: any = {
      title: form.get("title"),
      author: form.get("author"),
      book_number: form.get("book_number") || null,
      price: form.get("price") ? Number(form.get("price")) : null,
      isbn: form.get("isbn") || null,
      publisher: form.get("publisher") || null,
      publication_year: form.get("year") ? Number(form.get("year")) : null,
      category_id: selectedCategoryId === "none" ? null : selectedCategoryId,
      shelf_location: form.get("shelf") || null,
      description: form.get("description") || null,
      cover_url: new_cover_url,
    };
    if (editing) {
      const { error } = await supabase.from("books").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Book updated");
    } else {
      const { data, error } = await supabase.from("books").insert(payload).select().single();
      if (error) { toast.error(error.message); return; }
      const initial = Number(form.get("copies") ?? 1);
      if (initial > 0 && data) {
        const rows = Array.from({ length: initial }, (_, i) => ({ book_id: data.id, copy_number: i + 1 }));
        await supabase.from("book_copies").insert(rows);
      }
      toast.success("Book added");
    }
    setOpen(false); setEditing(null); setSelectedCategoryId("none"); setCoverFile(null);
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Book deleted");
    qc.invalidateQueries({ queryKey: ["books"] });
  };

  const addCopy = async (b: any, barcode: string) => {
    if (!barcode.trim()) return toast.error("Please enter a book number / barcode");
    const { count } = await supabase.from("book_copies").select("*", { count: "exact", head: true }).eq("book_id", b.id);
    const { error } = await supabase.from("book_copies").insert({ book_id: b.id, copy_number: (count ?? 0) + 1, barcode: barcode.trim() });
    if (error) return toast.error(error.message);
    
    // Copy the book link to clipboard
    const bookUrl = `${window.location.origin}/book/${b.id}`;
    navigator.clipboard.writeText(bookUrl);
    
    toast.success("Copy added & link copied to clipboard!");
    qc.invalidateQueries({ queryKey: ["books"] });
    setAddCopyOpen(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Book Management" description="Catalog, copies and availability."
        actions={
          <>
            <Can permission="export_reports"><Button variant="outline" onClick={() => exportCSV("books.csv", filtered.map((b: any) => ({
              code: b.book_code, title: b.title, author: b.author, isbn: b.isbn, year: b.publication_year,
              category: b.categories?.name, shelf: b.shelf_location, copies: b.book_copies?.length ?? 0,
            })))}><Download className="mr-2 h-4 w-4" /> Export</Button></Can>
            {!isMember && (can("add_book") || can("edit_book")) && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setSelectedCategoryId("none"); setCoverFile(null); } }}>
              {can("add_book") && (
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add Book</Button></DialogTrigger>
              )}
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editing ? "Edit Book" : "Add Book"}</DialogTitle></DialogHeader>
                <form action={save} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Title</Label><Input name="title" required defaultValue={editing?.title} /></div>
                    <div><Label>Author</Label><Input name="author" required defaultValue={editing?.author} /></div>
                    <div><Label>Book Number / Code</Label><Input name="book_number" defaultValue={editing?.book_number ?? ""} placeholder="e.g. LIB-001" /></div>
                    <div><Label>Price</Label><Input name="price" type="number" step="0.01" defaultValue={editing?.price ?? ""} placeholder="e.g. 15.99" /></div>
                    <div><Label>ISBN</Label><Input name="isbn" defaultValue={editing?.isbn ?? ""} /></div>
                    <div><Label>Publisher</Label><Input name="publisher" defaultValue={editing?.publisher ?? ""} /></div>
                    <div><Label>Year</Label><Input name="year" type="number" defaultValue={editing?.publication_year ?? ""} /></div>
                    <div className="col-span-2">
                      <Label>Book Cover Image</Label>
                      <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                      {editing?.cover_url && !coverFile && (
                        <p className="text-xs text-muted-foreground mt-1">Leave empty to keep current cover.</p>
                      )}
                    </div>
                    <div>
                      <Label>Category</Label>
                      <CategoryCombobox
                        categories={cats.data ?? []}
                        value={selectedCategoryId}
                        onChange={setSelectedCategoryId}
                        onCreateNew={createCategory}
                      />
                    </div>
                    <div><Label>Shelf</Label><Input name="shelf" defaultValue={editing?.shelf_location ?? ""} /></div>
                    {!editing && <div><Label>Initial copies</Label><Input name="copies" type="number" min={0} defaultValue={1} /></div>}
                    <div className="col-span-2"><Label>Description</Label><Textarea name="description" defaultValue={editing?.description ?? ""} /></div>
                  </div>
                  <DialogFooter><Button type="submit">{editing ? "Save" : "Add Book"}</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
            
            <Dialog open={addCopyOpen} onOpenChange={setAddCopyOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Copy: {addCopyBook?.title}</DialogTitle>
                <DialogDescription>Enter a unique book number or barcode for this physical copy.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>Book Number / Barcode</Label>
                <Input value={newCopyBarcode} onChange={e => setNewCopyBarcode(e.target.value)} placeholder="e.g. BK-2023-001" autoFocus />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddCopyOpen(false)}>Cancel</Button>
                <Button onClick={() => addCopy(addCopyBook, newCopyBarcode)}>Add Copy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Create Book Dialog */}
            <Dialog open={qrOpen} onOpenChange={setQrOpen}>
              <DialogContent className="max-w-sm text-center flex flex-col items-center">
                <DialogHeader>
                  <DialogTitle>QR Code for {selectedBookForQr?.title}</DialogTitle>
                  <DialogDescription>Scan to view book details</DialogDescription>
                </DialogHeader>
                <div className="bg-white p-4 rounded-xl border mt-4">
                  <QRCodeSVG 
                    value={`${window.location.origin}/book/${selectedBookForQr?.id}`} 
                    size={200}
                    level="H"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 font-mono">
                  Code: {selectedBookForQr?.book_number || selectedBookForQr?.isbn || "N/A"}
                </p>
                <DialogFooter className="mt-4 w-full sm:justify-center">
                  <Button variant="outline" onClick={() => setQrOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        } />

      {/* Inline category creation component */}

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by title, author, ISBN, code…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(cats.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Title</TableHead><TableHead>Author</TableHead>
                  <TableHead>Category</TableHead><TableHead>Price</TableHead><TableHead>Shelf</TableHead>
                  <TableHead>Copies</TableHead><TableHead>Available</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b: any) => {
                  const total = b.book_copies?.length ?? 0;
                  const avail = (b.book_copies ?? []).filter((c: any) => c.status === "available").length;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.book_number || b.book_code}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {b.cover_url ? (
                            <img src={b.cover_url} alt="" className="w-8 h-10 object-cover rounded shadow-sm border" />
                          ) : (
                            <div className="w-8 h-10 bg-muted rounded border flex items-center justify-center">
                              <Boxes className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                          <span className="line-clamp-2 leading-tight">{b.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>{b.author}</TableCell>
                      <TableCell>{b.categories?.name ?? "—"}</TableCell>
                      <TableCell>{b.price ? `$${Number(b.price).toFixed(2)}` : "—"}</TableCell>
                      <TableCell>{b.shelf_location ?? "—"}</TableCell>
                      <TableCell>{total}</TableCell>
                      <TableCell>
                        {avail > 0 ? (
                          <Badge variant="default">{avail}</Badge>
                        ) : (
                          <Badge variant="destructive" className="uppercase text-[10px] font-bold tracking-wider">Sold Out</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedBookForQr(b); setQrOpen(true); }} title="QR Code">
                          <QrCode className="h-4 w-4" />
                        </Button>
                        {!isMember && <Can permission="edit_book">
                          <Button size="icon" variant="ghost" onClick={() => { setAddCopyBook(b); setNewCopyBarcode(""); setAddCopyOpen(true); }} title="Add copy"><Boxes className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        </Can>}
                        {isSuperAdmin && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete book?</AlertDialogTitle>
                              <AlertDialogDescription>This removes “{b.title}” and all its copies. Loans referencing copies must be cleared first.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(b.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No books match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Inline Category Combobox ──────────────────────────────────────────────
function CategoryCombobox({
  categories,
  value,
  onChange,
  onCreateNew,
}: {
  categories: any[];
  value: string;
  onChange: (id: string) => void;
  onCreateNew: (name: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = categories.find((c) => c.id === value);
  const label = selected ? selected.name : "Uncategorized";

  // Check if typed text matches an existing category (case-insensitive)
  const exactMatch = categories.some(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase()
  );
  const showCreate = search.trim().length > 0 && !exactMatch;

  const handleCreate = async () => {
    setCreating(true);
    await onCreateNew(search.trim());
    setSearch("");
    setOpen(false);
    setCreating(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          type="button"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search or create category…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => { onChange("none"); setOpen(false); setSearch(""); }}
              >
                <Check className={cn("mr-2 h-4 w-4", value === "none" ? "opacity-100" : "opacity-0")} />
                Uncategorized
              </CommandItem>
              {categories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => { onChange(cat.id); setOpen(false); setSearch(""); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === cat.id ? "opacity-100" : "opacity-0")} />
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>

            {showCreate && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleCreate}
                    disabled={creating}
                    className="text-primary font-medium"
                  >
                    <FolderPlus className="mr-2 h-4 w-4" />
                    {creating ? "Creating…" : `Create "${search.trim()}"`}
                  </CommandItem>
                </CommandGroup>
              </>
            )}

            {categories.length === 0 && !showCreate && (
              <CommandEmpty>No categories yet.</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}