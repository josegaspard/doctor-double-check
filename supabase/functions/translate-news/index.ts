// Traductor de noticias vía Gemini API directo.
// SECURITY 2026-05-17: requireUserJWT + CORS allowlist + input size cap.
// Antes: endpoint público que cualquiera podía invocar para quemar cuota Gemini
// con prompts arbitrarios (prompt-injection vector). Ahora: requiere usuario
// autenticado y limita el tamaño de la entrada.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUserJWT, AuthError, corsHeadersFor } from "../_shared/auth-guards.ts";

const MAX_CONTENT_BYTES = 32_000; // ~32KB ≈ 8K tokens, suficiente para una nota larga
const MAX_TITLE_BYTES = 500;

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: usuario autenticado obligatorio. Visitantes sin sesión reciben 401.
  try {
    await requireUserJWT(req);
  } catch (e) {
    if (e instanceof AuthError) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: e.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Auth check failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { title, content, targetLang } = await req.json();

    if (!title || !content || !targetLang) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof title !== "string" || typeof content !== "string" || typeof targetLang !== "string") {
      return new Response(JSON.stringify({ error: "Invalid field types" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (title.length > MAX_TITLE_BYTES || content.length > MAX_CONTENT_BYTES) {
      return new Response(JSON.stringify({ error: "Input too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetLang !== "en" && targetLang !== "es") {
      return new Response(JSON.stringify({ error: "Unsupported targetLang" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetLangName = targetLang === 'en' ? 'English' : 'Spanish';

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
