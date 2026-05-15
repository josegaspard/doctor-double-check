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
    if (size === 'icon') {
      // Icon-only para grid de acciones: mismo tamaño/altura que sus vecinos
      // (Suscribirse · Ver Lives). Tooltip "Desbloquear" en hover.
      return (
        <Button
          variant="outline"
          size="icon"
          onClick={handleToggleBlock}
          disabled={isLoading}
          title="Desbloquear"
          aria-label="Desbloquear"
          className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 text-destructive border-destructive/40 hover:bg-destructive/10 rounded-md"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleToggleBlock}
        disabled={isLoading}
        className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10"
      >
        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
        Desbloquear
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {size === 'icon' ? (
          // Icon-only para grid: mismo alto que Suscribirse/Ver Lives (h-9 sm:h-10)
          <Button variant="outline" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md" title="Bloquear" aria-label="Bloquear">
            <Ban className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="ghost" size={size} className="gap-1.5 text-muted-foreground hover:text-destructive">
            <Ban className="w-3.5 h-3.5" />
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
