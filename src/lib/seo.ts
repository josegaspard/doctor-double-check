// El motor SEO vive en supabase/functions/_shared para que la función seo-meta (Deno),
// middleware.ts (Vercel) y el panel usen exactamente el mismo código.
export * from '../../supabase/functions/_shared/seo-render.ts';
