import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    // Supabase appends #access_token=...&type=signup to the redirect URL
    const hash = window.location.hash;
    if (hash && (hash.includes("access_token") || hash.includes("type=signup") || hash.includes("type=magiclink"))) {
      setStatus("success");
      // Auth state listener in useAuthState will handle session + redirect to onboarding
      const timer = setTimeout(() => {
        // Fallback redirect if auth listener hasn't redirected yet
        navigate("/onboarding", { replace: true });
      }, 4000);
      return () => clearTimeout(timer);
    } else {
      // No token in URL — might be expired or direct visit
      setStatus("error");
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground">Verificando...</h1>
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
