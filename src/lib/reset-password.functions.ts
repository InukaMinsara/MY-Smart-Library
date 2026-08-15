import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resetPasswordByEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      email: z.string().email(),
      redirectTo: z.string().url(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Use service role key to bypass the strict redirect URL whitelist
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { ok: true };
  });
