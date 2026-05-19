import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, User, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PatientResult {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  country_code: string | null;
}

/** Doctor-only quick patient finder. Starts a chat session and navigates to /chat. */
export function DoctorPatientSearch() {
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('search_patients_for_doctor', {
        p_term: term.trim(),
        p_limit: 10,
      });
      setLoading(false);
      if (error) {
        console.error('[PatientSearch]', error);
        return;
      }
      setResults((data as PatientResult[]) || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [term]);

  const startConversation = async (p: PatientResult) => {
    if (!user?.id) return;
    setStarting(p.user_id);
    try {
      // Try to find existing active chat
      const { data: existing } = await supabase
        .from('chat_sessions')
        .select('id')
        .or(
          `and(participant1_id.eq.${user.id},participant2_id.eq.${p.user_id}),` +
          `and(participant1_id.eq.${p.user_id},participant2_id.eq.${user.id})`
        )
        .eq('status', 'active')
        .maybeSingle();

      let sessionId = existing?.id;
      if (!sessionId) {
        const { data: created, error } = await supabase
          .from('chat_sessions')
          .insert({
            participant1_id: user.id,
            participant1_type: 'doctor',
            participant2_id: p.user_id,
            participant2_type: 'patient',
            status: 'active',
            is_double_check: false,
          })
          .select('id')
          .single();
        if (error) throw error;
        sessionId = created.id;
      }
      navigate(`/chat?session=${sessionId}`);
    } catch (e: any) {
      console.error('[PatientSearch] start error', e);
      toast.error(t('doctorPatientSearch.toast.startError'));
    } finally {
      setStarting(null);
    }
  };

  if (role !== 'doctor') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          {t('doctorPatientSearch.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('doctorPatientSearch.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          placeholder={t('doctorPatientSearch.placeholder')}
          value={term}
          onChange={e => setTerm(e.target.value)}
        />
        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="space-y-2">
          {results.map(p => (
            <div key={p.user_id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/30 transition">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name || t('doctorPatientSearch.noName')}</p>
                <p className="text-xs text-muted-foreground truncate">{p.email}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => startConversation(p)}
                disabled={starting === p.user_id}
              >
                {starting === p.user_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5 mr-1" />
                    {t('doctorPatientSearch.openChat')}
                  </>
                )}
              </Button>
            </div>
          ))}
          {!loading && term.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-3">{t('doctorPatientSearch.noResults')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
