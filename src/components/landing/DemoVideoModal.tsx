import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Play } from 'lucide-react';

interface DemoVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemoVideoModal({ open, onOpenChange }: DemoVideoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Demo Interactiva</DialogTitle>
        </DialogHeader>
        <div className="relative w-full aspect-video">
          <video
            autoPlay
            controls
            playsInline
            className="w-full h-full object-contain"
            poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1920' height='1080' viewBox='0 0 1920 1080'%3E%3Crect fill='%23163a83' width='1920' height='1080'/%3E%3C/svg%3E"
          >
            <source
              src="https://gestomarketing.com.mx/wp-content/uploads/2026/01/Video_de_Landing_Page_Hiperrealista.mp4"
              type="video/mp4"
            />
            Tu navegador no soporta la reproducción de video.
          </video>
          
          {/* Play overlay - hidden when video starts */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
