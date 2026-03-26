import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConnectionRequest {
  id: string;
  resident_id: string;
  resident_name: string;
  resident_avatar?: string;
  resident_specialty?: string;
  created_at: string;
}

export function DoctorResidentRequests() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchRequests();
  }, [user?.id]);

  const fetchRequests = async () => {
    if (!user?.id) return;
    try {
      const { data: connections } = await supabase
        .from('doctor_resident_connections')
        .select('id, resident_id, created_at')
        .eq('doctor_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (!connections || connections.length === 0) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const residentIds = connections.map(c => c.resident_id);
      const [{ data: profiles }, { data: resProfiles }] = await Promise.all([
        supabase.from('profiles').select('id, name, avatar_url').in('id', residentIds),
        supabase.from('resident_profiles').select('user_id, specialty').in('user_id', residentIds),
      ]);

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });
      const specMap: Record<string, string> = {};
      resProfiles?.forEach((r: any) => { specMap[r.user_id] = r.specialty; });

      setRequests(connections.map(c => ({
        id: c.id,
        resident_id: c.resident_id,
        resident_name: profileMap[c.resident_id]?.name || 'Residente',
        resident_avatar: profileMap[c.resident_id]?.avatar_url || undefined,
        resident_specialty: specMap[c.resident_id],
        created_at: c.created_at,
      })));
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRespond = async (connectionId: string, accept: boolean) => {
    setRespondingId(connectionId);
    try {
      const { error } = await supabase
        .from('doctor_resident_connections')
        .update({
          status: accept ? 'accepted' : 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', connectionId);

      if (error) throw error;
      toast.success(accept ? t('residents.requestAccepted') : t('residents.requestRejected'));
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setRespondingId(null);
    }
  };

  if (isLoading || requests.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-accent">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-accent" />
          {t('residents.connectionRequests')}
          <Badge variant="secondary" className="text-[10px]">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {requests.map(req => (
          <div key={req.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
            <Avatar className="w-9 h-9">
              <AvatarImage src={req.resident_avatar} />
              <AvatarFallback className="bg-accent/10 text-accent text-xs">
                {req.resident_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{req.resident_name}</p>
              {req.resident_specialty && (
                <p className="text-[10px] text-muted-foreground">{req.resident_specialty}</p>
              )}
            </div>
            <div className="flex gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-success hover:bg-success/10"
                disabled={respondingId === req.id}
                onClick={() => handleRespond(req.id, true)}
              >
                {respondingId === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                disabled={respondingId === req.id}
                onClick={() => handleRespond(req.id, false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
