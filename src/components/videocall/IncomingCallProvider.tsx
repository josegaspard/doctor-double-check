import React from 'react';
import { useIncomingCall } from '@/hooks/useIncomingCall';
import { IncomingCallModal } from '@/components/videocall/IncomingCallModal';

export function IncomingCallProvider({ children }: { children: React.ReactNode }) {
  const { incomingCall, dismissCall } = useIncomingCall();

  return (
    <>
      {children}
      {incomingCall && (
        <IncomingCallModal
          open={!!incomingCall}
          onClose={dismissCall}
          doctorName={incomingCall.doctorName}
          doctorSpecialty={incomingCall.doctorSpecialty}
          doctorAvatar={incomingCall.doctorAvatar}
          consultationId={incomingCall.consultationId}
          doctorId={incomingCall.doctorId}
        />
      )}
    </>
  );
}
