import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

export function BookReviews({ bookId }: { bookId: string }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: member } = useQuery({
    queryKey: ["current-member-id-review"],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from("members").select("id, full_name").eq("email", user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["reviews", bookId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("book_reviews" as any)
        .select(`
          id, rating, review_text, created_at, member_id,
          members(full_name)
        `)
        .eq("book_id", bookId)
        .order("created_at", { ascending: false });
      
      if (error) {
        console.error("Reviews error:", error);
        return [];
      }
      return data || [];
    }
  });

  const hasReviewed = reviews?.some(r => r.member_id === member?.id);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member?.id) return toast.error("You must be logged in as a member to review.");
    if (rating === 0) return toast.error("Please select a star rating.");
    
    setSubmitting(true);
    try {
      const { error } = await supabase.from("book_reviews" as any).insert({
        book_id: bookId,
        member_id: member.id,
        rating,
        review_text: reviewText.trim() || null
      });

      if (error) throw error;
      
      toast.success("Review submitted!");
      setRating(0);
      setReviewText("");
      queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating = reviews?.length 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) 
    : 0;

  return (
    <div className="space-y-6 mt-8 border-t pt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">Reviews & Ratings</h3>
        {reviews && reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <span className="font-bold">{avgRating}</span>
            <span className="text-muted-foreground text-sm">({reviews.length} reviews)</span>
          </div>
        )}
      </div>

      {member?.id && !hasReviewed && (
        <form onSubmit={submitReview} className="bg-muted/30 p-4 rounded-xl border space-y-4">
          <h4 className="font-semibold text-sm">Write a review</h4>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-6 w-6 cursor-pointer transition-colors ${(hoverRating || rating) >= star ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              />
            ))}
          </div>
          <Textarea 
            placeholder="What did you think of this book? (Optional)" 
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            className="resize-none"
            rows={3}
          />
          <Button type="submit" disabled={submitting || rating === 0}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Review
          </Button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : reviews?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          No reviews yet. Be the first to review this book!
        </div>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review) => (
            <div key={review.id} className="p-4 rounded-xl border bg-card text-card-foreground">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{review.members?.full_name || "Unknown Member"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${review.rating >= star ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
              </div>
              {review.review_text && (
                <p className="text-sm text-muted-foreground mt-3 pl-10">
                  {review.review_text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
