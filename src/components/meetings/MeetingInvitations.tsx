import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Bell, User } from 'lucide-react';
import type { Meeting } from '@/pages/Meetings';

interface Props {
  invitations: Meeting[];
  onRespond: (sessionId: string, accept: boolean) => void;
}

export function MeetingInvitations({ invitations, onRespond }: Props) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(date);
  };

  return (
    <Card className="mb-5 border-primary/40 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Invitaciones pendientes
          <Badge variant="secondary" className="text-xs">{invitations.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map(inv => (
          <div key={inv.id} className="flex items-center justify-between gap-3 p-3 bg-background rounded-lg border border-border">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{inv.title}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">{inv.specialty}</Badge>
                {inv.organizerName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />{inv.organizerName}
                  </span>
                )}
              </div>
              {inv.scheduledAt && (
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{formatDate(inv.scheduledAt)}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => onRespond(inv.id, true)} className="gap-1 text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                Aceptar
              </Button>
              <Button size="sm" variant="outline" onClick={() => onRespond(inv.id, false)} className="gap-1 text-xs">
                <XCircle className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
