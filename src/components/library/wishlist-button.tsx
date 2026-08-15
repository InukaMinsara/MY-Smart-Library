import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-current-user";

export function WishlistButton({ bookId }: { bookId: string }) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  // Use the members id from user email instead of auth user id, because wishlists uses member_id
  const { data: member } = useQuery({
    queryKey: ["current-member-id"],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase.from("members").select("id").eq("email", user.email).maybeSingle();
      return data;
    },
    enabled: !!user?.email
  });

  const { data: isSaved, isLoading: checking } = useQuery({
    queryKey: ["wishlist", bookId, member?.id],
    queryFn: async () => {
      if (!member?.id) return false;
      const { data, error } = await supabase
        .from("wishlists" as any)
        .select("id")
        .eq("book_id", bookId)
        .eq("member_id", member.id)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") {
        console.error("Wishlist check error:", error);
        return false;
      }
      return !!data;
    },
    enabled: !!member?.id
  });

  const toggleWishlist = async () => {
    if (!member?.id) return toast.error("Must be a registered member to save books.");
    setLoading(true);
    
    try {
      if (isSaved) {
        await supabase.from("wishlists" as any).delete().eq("book_id", bookId).eq("member_id", member.id);
        toast.success("Removed from wishlist");
      } else {
        await supabase.from("wishlists" as any).insert({ book_id: bookId, member_id: member.id });
        toast.success("Added to wishlist");
      }
      queryClient.invalidateQueries({ queryKey: ["wishlist", bookId, member?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-wishlist"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant={isSaved ? "default" : "outline"} 
      size="sm" 
      onClick={toggleWishlist}
      disabled={checking || loading || !member?.id}
      className={isSaved ? "bg-pink-600 hover:bg-pink-700 text-white border-pink-600" : ""}
    >
      {loading || checking ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Heart className={`h-4 w-4 mr-2 ${isSaved ? "fill-current" : ""}`} />
      )}
      {isSaved ? "Saved to Wishlist" : "Save to Wishlist"}
    </Button>
  );
}
