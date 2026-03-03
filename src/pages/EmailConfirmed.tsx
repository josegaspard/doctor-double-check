import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const redirected = useRef(false);

  useEffect(() => {
    let errorTimeout: ReturnType<typeof setTimeout>;

    const checkSession = async () => {
      // Small delay to let Supabase client process the hash fragment
      await new Promise((r) => setTimeout(r, 500));

      if (redirected.current) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (redirected.current) return;

        if (session) {
          setStatus("success");
          // useAuthState's onAuthStateChange will handle redirect to /onboarding
          // Fallback redirect after 4s if auth listener hasn't fired
          errorTimeout = setTimeout(() => {
            if (!redirected.current) {
              redirected.current = true;
              navigate("/onboarding", { replace: true });
            }
          }, 4000);
        } else {
          // No session yet — wait a bit more then show error
          errorTimeout = setTimeout(async () => {
            if (redirected.current) return;
            const { data: { session: retrySession } } = await supabase.auth.getSession();
            if (retrySession) {
              setStatus("success");
              setTimeout(() => {
                if (!redirected.current) {
                  redirected.current = true;
                  navigate("/onboarding", { replace: true });
                }
              }, 3000);
            } else {
              setStatus("error");
            }
          }, 3000);
        }
      } catch {
        if (!redirected.current) setStatus("error");
      }
    };

    // Listen for auth state change — if SIGNED_IN fires, redirect immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && !redirected.current) {
        redirected.current = true;
        setStatus("success");
        setTimeout(() => {
          navigate("/onboarding", { replace: true });
        }, 1500);
      }
    });

    checkSession();

    return () => {
      clearTimeout(errorTimeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Verificando...</h1>
            <p className="text-muted-foreground">Estamos confirmando tu correo electrónico...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-in zoom-in-50 duration-500">
              <CheckCircle2 className="w-12 h-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">¡Correo confirmado!</h1>
            <p className="text-muted-foreground">
              Tu cuenta ha sido verificada exitosamente. Te redirigiremos en unos segundos...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="w-12 h-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Enlace expirado</h1>
            <p className="text-muted-foreground">
              Este enlace de confirmación ha expirado o ya fue utilizado. Intenta iniciar sesión o solicita un nuevo enlace.
            </p>
            <Button onClick={() => navigate("/login", { replace: true })} className="w-full">
              Ir a Iniciar Sesión
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
