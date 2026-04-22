import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle, ArrowLeft, KeyRound, Facebook, Instagram, Twitter, Linkedin, Youtube } from 'lucide-react';
import { PasswordStrength, getPasswordStrength } from '@/components/ui/password-strength';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSocialLinks } from '@/hooks/useSiteSettings';
import { LanguageSwitcher } from '@/components/settings/LanguageSwitcher';
import logoMedicalMasters from '@/assets/logo-medical-masters.png';
import logoMedicalMastersWhite from '@/assets/logo-medical-masters-white.png';
import { AppBackground } from '@/components/layout/AppBackground';
export default function ResetPassword() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { socialLinks } = useSocialLinks();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  // Check if this is a password reset callback
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth callback error:', error);
      }
    };
    handleAuthCallback();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const { score } = getPasswordStrength(password);
    
    if (score < 60) {
      setError(t('resetPassword.passwordTooWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordMismatch'));
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      toast.success(t('resetPassword.success'));
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      setError(error.message || t('resetPassword.error'));
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <AppBackground className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/login')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Link to="/">
                <img src={logoMedicalMasters} alt="Medical Masters" className="h-8 w-auto" />
              </Link>
            </div>
          </div>
        </header>
        
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-success/30 bg-success/5">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h3 className="font-heading text-xl font-bold mb-2">
                {t('resetPassword.successTitle')}
              </h3>
              <p className="text-muted-foreground mb-4">
                {t('resetPassword.successMessage')}
              </p>
              <Button onClick={() => navigate('/login')}>
                {t('resetPassword.goToLogin')}
              </Button>
            </CardContent>
          </Card>
        </main>

        {/* Footer */}
        <footer className="bg-dark text-dark-foreground py-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
                  <span className="text-sm text-light">{t('footer.platform')}</span>
                </div>
                <div className="flex items-center gap-4">
                  {socialLinks.facebook && (
                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.instagram && (
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.linkedin && (
                    <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                  {socialLinks.youtube && (
                    <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              <div className="border-t border-light/20" />
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <nav className="flex items-center gap-6">
                  <Link to="/terms" className="text-sm text-light/70 hover:text-light transition-colors">
                    {t('footer.termsOfService')}
                  </Link>
                  <Link to="/privacy" className="text-sm text-light/70 hover:text-light transition-colors">
                    {t('footer.privacyPolicy')}
                  </Link>
                </nav>
                <p className="text-sm text-light/70">{t('footer.copyright')}</p>
              </div>
            </div>
          </div>
        </footer>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/login')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Link to="/">
                <img src={logoMedicalMasters} alt="Medical Masters" className="h-8 w-auto" />
              </Link>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>{t('resetPassword.title')}</CardTitle>
            <CardDescription>
              {t('resetPassword.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <PasswordStrength password={password} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {t('resetPassword.updateButton')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-dark text-dark-foreground py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <img src={logoMedicalMastersWhite} alt="Medical Masters" className="h-8 w-auto" />
                <span className="text-sm text-light">{t('footer.platform')}</span>
              </div>
              <div className="flex items-center gap-4">
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Facebook className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.twitter && (
                  <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Twitter className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.linkedin && (
                  <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-light/70 hover:text-light transition-colors">
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
              </div>
            </div>
            <div className="border-t border-light/20" />
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <nav className="flex items-center gap-6">
                <Link to="/terms" className="text-sm text-light/70 hover:text-light transition-colors">
                  {t('footer.termsOfService')}
                </Link>
                <Link to="/privacy" className="text-sm text-light/70 hover:text-light transition-colors">
                  {t('footer.privacyPolicy')}
                </Link>
              </nav>
              <p className="text-sm text-light/70">{t('footer.copyright')}</p>
            </div>
          </div>
        </div>
      </footer>
    </AppBackground>
  );
}
