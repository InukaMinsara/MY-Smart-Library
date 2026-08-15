import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/library/page-header";
import { Trophy, Star, BookOpen, Medal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/leaderboard/")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Leaderboards • Smart Library" }] }),
});

function LeaderboardPage() {
  // Query top readers (members with most loans)
  const topReaders = useQuery({
    queryKey: ["top_readers"],
    queryFn: async () => {
      // In Supabase without a custom RPC, we can get all loans and count them per member
      // For a small/medium library this is fine. For scale, an RPC is better.
      const { data: loans, error } = await supabase
        .from("loans")
        .select("member_id, members(full_name, avatar_url)")
        .not("member_id", "is", null);

      if (error) throw error;

      const counts: Record<string, { id: string, name: string, avatar: string | null, count: number }> = {};
      loans?.forEach(l => {
        if (!l.member_id) return;
        if (!counts[l.member_id]) {
          counts[l.member_id] = {
            id: l.member_id,
            name: l.members?.full_name || "Unknown",
            avatar: (l.members as any)?.avatar_url || null,
            count: 0
          };
        }
        counts[l.member_id].count++;
      });

      return Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
  });

  // Query top rated books
  const topBooks = useQuery({
    queryKey: ["top_books"],
    queryFn: async () => {
      const { data: reviews, error } = await supabase
        .from("book_reviews")
        .select("book_id, rating, books(title, author, cover_url)");
        
      if (error) throw error;

      const bookStats: Record<string, { id: string, title: string, author: string, cover: string | null, total: number, count: number }> = {};
      reviews?.forEach(r => {
        if (!r.book_id) return;
        if (!bookStats[r.book_id]) {
          bookStats[r.book_id] = {
            id: r.book_id,
            title: r.books?.title || "Unknown",
            author: r.books?.author || "Unknown",
            cover: (r.books as any)?.cover_url || null,
            total: 0,
            count: 0
          };
        }
        bookStats[r.book_id].total += r.rating;
        bookStats[r.book_id].count++;
      });

      return Object.values(bookStats)
        .map(b => ({ ...b, avg: b.total / b.count }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count) // sort by rating, then by number of reviews
        .slice(0, 10);
    }
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <PageHeader 
        title="Leaderboards" 
        description="Top readers and highest rated books in our library community."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Readers */}
        <Card className="border-t-4 border-t-yellow-500 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Top Readers
            </CardTitle>
            <CardDescription>Members who have borrowed the most books.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topReaders.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : topReaders.data?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No reading data yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {topReaders.data?.map((reader, index) => (
                  <div key={reader.id} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                    <div className="w-8 font-bold text-lg text-muted-foreground flex justify-center">
                      {index === 0 ? <Medal className="h-6 w-6 text-yellow-500" /> : 
                       index === 1 ? <Medal className="h-6 w-6 text-gray-400" /> : 
                       index === 2 ? <Medal className="h-6 w-6 text-amber-700" /> : 
                       `#${index + 1}`}
                    </div>
                    <Avatar className="h-10 w-10 mx-3 border border-border shadow-sm">
                      <AvatarImage src={reader.avatar || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary">{reader.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{reader.name}</div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      <BookOpen className="h-3.5 w-3.5" />
                      {reader.count} {reader.count === 1 ? 'book' : 'books'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Books */}
        <Card className="border-t-4 border-t-blue-500 shadow-md">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Star className="h-6 w-6 text-blue-500 fill-blue-500" />
              Top Rated Books
            </CardTitle>
            <CardDescription>Highest community-rated books in the library.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topBooks.isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : topBooks.data?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No ratings yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {topBooks.data?.map((book, index) => (
                  <div key={book.id} className="flex items-center p-4 hover:bg-muted/50 transition-colors">
                    <div className="w-8 font-bold text-lg text-muted-foreground flex justify-center">
                      {index === 0 ? <Medal className="h-6 w-6 text-yellow-500" /> : 
                       index === 1 ? <Medal className="h-6 w-6 text-gray-400" /> : 
                       index === 2 ? <Medal className="h-6 w-6 text-amber-700" /> : 
                       `#${index + 1}`}
                    </div>
                    <div className="h-12 w-9 bg-muted mx-3 rounded shadow-sm overflow-hidden flex-shrink-0">
                      {book.cover ? (
                        <img src={book.cover} alt={book.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-primary/10">
                          <BookOpen className="h-4 w-4 text-primary/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{book.title}</div>
                      <div className="text-sm text-muted-foreground truncate">{book.author}</div>
                    </div>
                    <div className="flex flex-col items-end pl-2">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        {book.avg.toFixed(1)} <Star className="h-4 w-4 fill-amber-500" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {book.count} {book.count === 1 ? 'review' : 'reviews'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
