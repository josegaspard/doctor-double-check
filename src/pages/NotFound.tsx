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
    // Página inexistente: que Google no la indexe ni la tome por la home.
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex, nofollow';
    document.head.querySelector('link[rel="canonical"]')?.remove();
  }, [location.pathname]);

  return (
    <AppBackground className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="relative z-10 text-center px-4">
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
