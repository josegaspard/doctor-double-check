import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BlockUserButtonProps {
  targetUserId: string;
  targetUserName: string;
  size?: 'sm' | 'default' | 'icon';
}

export function BlockUserButton({ targetUserId, targetUserName, size = 'sm' }: BlockUserButtonProps) {
  const { user } = useAuth();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkBlock = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', user.id)
        .eq('blocked_id', targetUserId)
        .maybeSingle();
      setIsBlocked(!!data);
    };
    checkBlock();
  }, [user?.id, targetUserId]);

  const handleToggleBlock = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      if (isBlocked) {
        await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user.id)
          .eq('blocked_id', targetUserId);
        setIsBlocked(false);
        toast.success(`${targetUserName} ha sido desbloqueado`);
      } else {
        await supabase
          .from('user_blocks')
          .insert({ blocker_id: user.id, blocked_id: targetUserId });
        setIsBlocked(true);
        toast.success(`${targetUserName} ha sido bloqueado`);
      }
    } catch (error) {
      toast.error('Error al actualizar el bloqueo');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user?.id || user.id === targetUserId) return null;

  if (isBlocked) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleToggleBlock}
        disabled={isLoading}
        className="gap-1 text-destructive border-destructive/30"
      >
        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
        Desbloquear
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {size === 'icon' ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full" title="Bloquear">
            <Ban className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size={size} className="gap-1 text-muted-foreground hover:text-destructive">
            <Ban className="w-3 h-3" />
            Bloquear
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Bloquear a {targetUserName}?</AlertDialogTitle>
          <AlertDialogDescription>
            No podrás ver su contenido ni iniciar orientaciones médicas con esta persona. Puedes desbloquear en cualquier momento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggleBlock} disabled={isLoading} className="bg-destructive hover:bg-destructive/90">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Bloquear
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
