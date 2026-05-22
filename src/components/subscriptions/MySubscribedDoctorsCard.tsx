import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Crown, Star, Heart, ChevronRight } from 'lucide-react';

// Lista rápida de doctores a los que el usuario sigue/está suscrito.
// Aparece en /profile para los 3 roles (paciente, doctor, residente) —
// los doctores también siguen a colegas.
export function MySubscribedDoctorsCard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { subscriptions, isLoading } = useSubscriptions();

  if (isLoading) return null;
  if (!subscriptions || subscriptions.length === 0) return null;

  const top = subscriptions.slice(0, 6);
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const tierBadge = (tier: string) => {
    if (tier === 'premium') return <Crown className="w-3 h-3 text-amber-500" />;
    if (tier === 'basic') return <Star className="w-3 h-3 text-primary" />;
    return <Heart className="w-3 h-3 text-pink-500" />;
  };

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          {t('mySubscribedDoctors.title') || 'Doctores que sigues'}
          <span className="text-xs text-muted-foreground font-normal">({subscriptions.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {top.map(sub => (
            <button
              key={sub.id}
              onClick={() => navigate(`/doctors/${sub.creatorId}`)}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 hover:bg-muted transition-colors text-left"
            >
              <Avatar className="w-9 h-9 flex-shrink-0">
                <AvatarImage src={sub.creatorAvatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {getInitials(sub.creatorName || 'Dr')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">{sub.creatorName || (t('mySubscriptions.defaultDoctorName') || 'Doctor')}</p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {tierBadge(sub.tier)}
                  <span className="capitalize">{sub.tier}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Button variant="ghost" className="w-full mt-2 text-sm gap-1" onClick={() => navigate('/settings')}>
          {t('mySubscribedDoctors.manage') || 'Administrar suscripciones'}
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
