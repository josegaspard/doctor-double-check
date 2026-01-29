import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, CheckCircle, XCircle, Video, FileText, Image, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface EmailHistoryItem {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  emailType: string;
  subject: string;
  contentId: string | null;
  contentTitle: string | null;
  status: 'sent' | 'failed';
  errorMessage: string | null;
  createdAt: Date;
}

const getEmailTypeIcon = (type: string) => {
  switch (type) {
    case 'new_content':
      return <Video className="w-4 h-4" />;
    case 'live_started':
      return <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />;
    case 'availability':
      return <Calendar className="w-4 h-4" />;
    default:
      return <Mail className="w-4 h-4" />;
  }
};

const getEmailTypeLabel = (type: string) => {
  switch (type) {
    case 'new_content':
      return 'Nuevo contenido';
    case 'live_started':
      return 'Live iniciado';
    case 'availability':
      return 'Disponibilidad';
    default:
      return type;
  }
};

export function EmailHistoryCard() {
  const { supabaseUser } = useAuth();
  const [emails, setEmails] = useState<EmailHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!supabaseUser?.id) return;

    const fetchEmailHistory = async () => {
      const { data, error } = await supabase
        .from('email_history')
        .select('*')
        .eq('doctor_id', supabaseUser.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setEmails(data.map(e => ({
          id: e.id,
          recipientEmail: e.recipient_email,
          recipientName: e.recipient_name,
          emailType: e.email_type,
          subject: e.subject,
          contentId: e.content_id,
          contentTitle: e.content_title,
          status: e.status as 'sent' | 'failed',
          errorMessage: e.error_message,
          createdAt: new Date(e.created_at),
        })));
      }
      setIsLoading(false);
    };

    fetchEmailHistory();
  }, [supabaseUser?.id]);

  const sentCount = emails.filter(e => e.status === 'sent').length;
  const failedCount = emails.filter(e => e.status === 'failed').length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Historial de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Historial de Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Mail className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aún no has enviado emails a tus suscriptores</p>
            <p className="text-xs mt-1">Los emails aparecerán aquí cuando subas contenido o inicies un live</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedEmails = isExpanded ? emails : emails.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Historial de Emails
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              {sentCount}
            </Badge>
            {failedCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                {failedCount}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className={isExpanded ? 'h-[400px]' : ''}>
          <div className="space-y-3">
            {displayedEmails.map(email => (
              <div
                key={email.id}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center flex-shrink-0">
                  {getEmailTypeIcon(email.emailType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {email.recipientName || email.recipientEmail}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getEmailTypeLabel(email.emailType)}
                    </Badge>
                    {email.status === 'sent' ? (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    ) : (
                      <XCircle className="w-3 h-3 text-destructive" />
                    )}
                  </div>
                  {email.contentTitle && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.contentTitle}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(email.createdAt, "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                  {email.status === 'failed' && email.errorMessage && (
                    <p className="text-xs text-destructive mt-1">{email.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {emails.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Mostrar menos
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                Ver todos ({emails.length})
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
