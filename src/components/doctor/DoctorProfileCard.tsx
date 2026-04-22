import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CredentialStatusBadge, type CredentialStatus } from './CredentialStatusBadge';

interface CredentialsState {
  cedula_profesional: string | null;
  cedula_status: CredentialStatus;
  cedula_rejection_reason: string | null;
  cofepris_permit: string | null;
  cofepris_status: CredentialStatus;
  cofepris_rejection_reason: string | null;
}

export function DoctorProfileCard() {
  const { user, supabaseUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [creds, setCreds] = useState<CredentialsState | null>(null);

  const doctorProfile = user?.doctorProfile;
  const initials = (user?.name || 'Dr').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  useEffect(() => {
    let active = true;
    const loadCreds = async () => {
      if (!supabaseUser?.id) return;
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select(
          'cedula_profesional, cedula_status, cedula_rejection_reason, cofepris_permit, cofepris_status, cofepris_rejection_reason'
        )
        .eq('user_id', supabaseUser.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.warn('[DoctorProfileCard] credentials fetch error', error);
        return;
      }
      if (data) {
        setCreds({
          cedula_profesional: data.cedula_profesional ?? null,
          cedula_status: (data.cedula_status as CredentialStatus) ?? null,
          cedula_rejection_reason: data.cedula_rejection_reason ?? null,
          cofepris_permit: data.cofepris_permit ?? null,
          cofepris_status: (data.cofepris_status as CredentialStatus) ?? null,
          cofepris_rejection_reason: data.cofepris_rejection_reason ?? null,
        });
      }
    };
    loadCreds();
    return () => {
      active = false;
    };
  }, [supabaseUser?.id]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabaseUser?.id) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${supabaseUser.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .update({ avatar_url: urlWithCacheBust })
        .eq('id', supabaseUser.id);

      setAvatarUrl(urlWithCacheBust);
      toast.success('Foto de perfil actualizada');
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error('Error al subir la foto');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasAnyCredential =
    !!(creds?.cedula_profesional?.trim() || creds?.cofepris_permit?.trim());

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          {/* Avatar with edit overlay */}
          <div className="relative flex-shrink-0 group">
            <Avatar className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-primary/20">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base sm:text-lg text-foreground truncate">
              {user?.name || 'Doctor'}
            </h2>
            <p className="text-sm text-primary/80 font-medium truncate">
              {doctorProfile?.specialty || 'Especialidad'}
            </p>
            {doctorProfile?.location && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {doctorProfile.location}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px]">
                {doctorProfile?.status === 'approved' ? '✓ Aprobado' : doctorProfile?.status || 'Pendiente'}
              </Badge>
              {hasAnyCredential && creds?.cedula_profesional?.trim() && (
                <CredentialStatusBadge
                  type="cedula"
                  status={creds.cedula_status}
                  value={creds.cedula_profesional}
                  rejectionReason={creds.cedula_rejection_reason}
                  size="xs"
                />
              )}
              {hasAnyCredential && creds?.cofepris_permit?.trim() && (
                <CredentialStatusBadge
                  type="cofepris"
                  status={creds.cofepris_status}
                  value={creds.cofepris_permit}
                  rejectionReason={creds.cofepris_rejection_reason}
                  size="xs"
                />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
