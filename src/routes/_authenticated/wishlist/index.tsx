import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Heart, BookOpen, Trash2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PermissionGate } from "@/components/library/permission-gate";

export const Route = createFileRoute("/_authenticated/wishlist/")({
  component: WishlistPage,
  head: () => ({
    meta: [{ title: "My Wishlist • Smart Library" }],
  }),
});

function WishlistPage() {
  const { user } = useCurrentUser();

  const { data: member } = useQuery({
    queryKey: ["current-member-id-wishlist"],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from("members").select("id").eq("email", user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email
  });

  const { data: wishlist, isLoading, refetch } = useQuery({
    queryKey: ["my-wishlist", member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from("wishlists" as any)
        .select(`
          id, book_id, created_at,
          books (
            id, title, author, cover_url, categories(name)
          )
        `)
        .eq("member_id", member.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Wishlist fetch error:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!member?.id
  });

  const removeFromWishlist = async (wishlistId: string) => {
    try {
      const { error } = await supabase.from("wishlists" as any).delete().eq("id", wishlistId);
      if (error) throw error;
      toast.success("Book removed from wishlist");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove book");
    }
  };

  return (
    <PermissionGate permission="dashboard" memberAllowed>
      <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto py-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-pink-100 flex items-center justify-center">
            <Heart className="h-6 w-6 text-pink-600 fill-pink-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Wishlist</h1>
            <p className="text-muted-foreground">Books you have saved to read later.</p>
          </div>
        </div>

        <Card className="border-0 shadow-xl bg-gradient-to-br from-card to-accent/10">
          <CardContent className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : !wishlist || wishlist.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your wishlist is empty</h3>
                <p className="text-muted-foreground mb-6">Discover new books in the catalog and save them here.</p>
                <Link to="/books">
                  <Button>Browse Books</Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {wishlist.map((item: any) => (
                  <Card key={item.id} className="overflow-hidden group hover:shadow-lg transition-all">
                    <div className="relative h-48 bg-muted border-b">
                      {item.books?.cover_url ? (
                        <img src={item.books.cover_url} alt={item.books.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="destructive" size="icon" onClick={() => removeFromWishlist(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="text-xs text-muted-foreground mb-1 font-medium truncate uppercase tracking-wider">
                        {item.books?.categories?.name || "Uncategorized"}
                      </div>
                      <h3 className="font-bold text-lg leading-tight mb-1 line-clamp-1" title={item.books?.title}>
                        {item.books?.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{item.books?.author}</p>
                      
                      <div className="mt-4">
                        <Link to="/book/$bookId" params={{ bookId: item.books?.id }}>
                          <Button variant="outline" className="w-full text-xs h-8">View Details</Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}
