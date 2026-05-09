// MIGRATION 2026-05-08: AI gateway switched from Lovable → Gemini API direct.
// To revert: swap the LOVABLE-LEGACY block (uncomment) with the NATIVE-IMPL block (comment).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, content, targetLang } = await req.json();

    if (!title || !content || !targetLang) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLangName = targetLang === 'en' ? 'English' : 'Spanish';

    // ─── LOVABLE-LEGACY (kept for rollback) ─────────────────────────────────
    // const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    // if (!LOVABLE_API_KEY) {
    //   return new Response(JSON.stringify({ error: "Translation service not configured" }), {
    //     status: 500,
    //     headers: { ...corsHeaders, "Content-Type": "application/json" },
    //   });
    // }
    // const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    //   method: "POST",
    //   headers: {
    //     Authorization: `Bearer ${LOVABLE_API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     model: "google/gemini-3-flash-preview",
    //     messages: [
    //       { role: "system", content: `You are a professional medical translator...` },
    //       { role: "user", content: `Translate this article:\n\nTitle: ${title}\n\nContent (HTML): ${content}` },
    //     ],
    //     tools: [{ type: "function", function: { name: "return_translation", parameters: { ... } } }],
    //     tool_choice: { type: "function", function: { name: "return_translation" } },
    //   }),
    // });
    // ... legacy parsing of tool_calls[0].function.arguments

    // ─── NATIVE-IMPL (active, post-migration) ───────────────────────────────
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Translation service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a professional medical translator. Translate the following medical news article to ${targetLangName}. Preserve all HTML formatting tags exactly as they are. Only translate the text content, not HTML tags or attributes. Return ONLY a JSON object with "title" and "content" fields, no markdown wrapping.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [{ text: `Translate this article:\n\nTitle: ${title}\n\nContent (HTML): ${content}` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                title: { type: "string" },
                content: { type: "string" },
              },
              required: ["title", "content"],
            },
          },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Translation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (text) {
      try {
        const translated = JSON.parse(text);
        return new Response(JSON.stringify(translated), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (parseErr) {
        console.error("Failed to parse Gemini JSON response:", text);
      }
    }

    return new Response(JSON.stringify({ error: "Unexpected response format" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
