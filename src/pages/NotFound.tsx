import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppBackground } from "@/components/layout/AppBackground";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppBackground className="flex min-h-screen items-center justify-center">
      <div className="text-center px-4">
        <h1 className="mb-4 text-5xl font-bold">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">Oops! Page not found</p>
        <Button asChild variant="outline">
          <a href="/">Return to Home</a>
        </Button>
      </div>
    </AppBackground>
  );
};

export default NotFound;
