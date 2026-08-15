import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Library, BookOpen, Layers, MapPin, Loader2, Tag, ArrowLeft } from "lucide-react";
import { WishlistButton } from "@/components/library/wishlist-button";
import { BookReviews } from "@/components/library/book-reviews";

export const Route = createFileRoute("/book/$bookId")({
  head: () => ({
    meta: [{ title: "Book Details • Smart Library" }],
  }),
  component: BookDetailsPage,
});

function BookDetailsPage() {
  const { bookId } = Route.useParams();

  const { data: _book, isLoading, error } = useQuery({
    queryKey: ["book", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("books")
        .select("*, categories(name), book_copies(id, status)")
        .eq("id", bookId)
        .single();
      
      if (error) throw error;
      return data;
    },
  });
  
  const book = _book as any;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Library className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Book Not Found</CardTitle>
            <CardDescription>The requested book could not be found or has been removed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const totalCopies = book.book_copies?.length || 0;
  const availableCopies = (book.book_copies || []).filter((c: any) => c.status === "available").length;

  return (
    <div className="min-h-screen bg-muted/20 flex flex-col items-center py-12 px-4 sm:px-6">
      <div className="max-w-2xl w-full">
        {/* Header Branding */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Library className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-xl font-bold leading-none">Smart Library</div>
              <div className="text-xs text-muted-foreground mt-1">Book Catalog</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Book Details Card */}
        <Card className="shadow-2xl border-0 overflow-hidden">
          <div className="h-32 bg-gradient-to-r from-primary/80 to-accent/80 relative">
            <div className="absolute -bottom-10 left-6">
              <div className="h-24 w-16 sm:h-32 sm:w-24 bg-muted border-4 border-background shadow-lg rounded-md flex items-center justify-center overflow-hidden">
                {book.cover_url ? (
                  <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                ) : (
                  <BookOpen className="h-8 w-8 sm:h-12 sm:w-12 text-muted-foreground/50" />
                )}
              </div>
            </div>
            <div className="absolute top-4 right-4">
              <Badge variant={availableCopies > 0 ? "default" : "destructive"} className="shadow-sm text-sm py-1">
                {availableCopies > 0 ? `${availableCopies} of ${totalCopies} Available` : "Checked Out"}
              </Badge>
            </div>
          </div>
          
          <CardContent className="pt-16 pb-8 px-6 sm:px-8">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{book.title}</h1>
                  <p className="text-lg text-muted-foreground font-medium">by {book.author}</p>
                </div>
                <div className="shrink-0">
                  <WishlistButton bookId={book.id} />
                </div>
              </div>

              {book.description && (
                <div className="prose prose-sm text-muted-foreground">
                  <p>{book.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                {/* Code / Number */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> Book Code
                  </span>
                  <span className="font-mono">{book.book_number || book.book_code || "N/A"}</span>
                </div>

                {/* Price */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Price
                  </span>
                  <span className="font-medium text-green-600 dark:text-green-500">
                    {book.price ? `$${Number(book.price).toFixed(2)}` : "—"}
                  </span>
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3 w-3" /> Category
                  </span>
                  <span>{book.categories?.name || "Uncategorized"}</span>
                </div>

                {/* Shelf Location */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Shelf
                  </span>
                  <span>{book.shelf_location || "—"}</span>
                </div>

                {/* ISBN */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ISBN</span>
                  <span className="font-mono text-sm">{book.isbn || "—"}</span>
                </div>

                {/* Publisher & Year */}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Published</span>
                  <span>{book.publisher || "—"} {book.publication_year ? `(${book.publication_year})` : ""}</span>
                </div>
              </div>

              <BookReviews bookId={book.id} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
