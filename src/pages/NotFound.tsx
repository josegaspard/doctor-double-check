import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { AppBackground } from "@/components/layout/AppBackground";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppBackground className="flex min-h-screen items-center justify-center">
      <div className="text-center px-4">
        <h1 className="mb-4 text-5xl font-bold">404</h1>
        <p className="mb-6 text-xl text-muted-foreground">{t('fix20.pages.notFoundMessage')}</p>
        <Button asChild variant="outline">
          <Link to="/">{t('fix20.pages.notFoundReturnHome')}</Link>
        </Button>
      </div>
    </AppBackground>
  );
};

export default NotFound;
