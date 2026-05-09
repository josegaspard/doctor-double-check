// MIGRATION 2026-05-08: Lovable Cloud → external Supabase. Frontend OAuth now native.
// To revert: swap the LOVABLE-LEGACY block (uncomment) with the NATIVE-IMPL block (comment).

// ─── LOVABLE-LEGACY (kept for rollback) ─────────────────────────────────────
// import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
// import { supabase as supabaseClient } from "../supabase/client";
// const lovableAuth = createLovableAuth({});
//
// type LegacySignInOptions = {
//   redirect_uri?: string;
//   extraParams?: Record<string, string>;
// };
//
// export const lovable = {
//   auth: {
//     signInWithOAuth: async (
//       provider: "google" | "apple",
//       opts?: LegacySignInOptions,
//     ) => {
//       const result = await lovableAuth.signInWithOAuth(provider, {
//         redirect_uri: opts?.redirect_uri,
//         extraParams: { ...opts?.extraParams },
//       });
//       if (result.redirected) return result;
//       if (result.error) return result;
//       try {
//         await supabaseClient.auth.setSession(result.tokens);
//       } catch (e) {
//         return { error: e instanceof Error ? e : new Error(String(e)) };
//       }
//       return result;
//     },
//   },
// };

// ─── NATIVE-IMPL (active, post-migration) ───────────────────────────────────
import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (
      provider: "google" | "apple",
      opts?: SignInOptions,
    ) => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: opts?.redirect_uri,
          queryParams: opts?.extraParams,
        },
      });
      if (error) return { error };
      if (data?.url) {
        window.location.href = data.url;
        return { redirected: true as const };
      }
      return { error: new Error("No redirect URL returned") };
    },
  },
};
