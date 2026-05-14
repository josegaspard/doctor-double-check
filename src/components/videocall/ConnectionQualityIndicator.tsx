import React, { useState } from 'react';
import { Wifi, WifiOff, ChevronUp, ChevronDown } from 'lucide-react';
import type { NetworkStats, ConnectionQuality } from '@/hooks/useConnectionQuality';
import { motion, AnimatePresence } from 'framer-motion';

interface ConnectionQualityIndicatorProps {
  stats: NetworkStats;
}

const qualityConfig: Record<ConnectionQuality, { label: string; color: string; bars: number }> = {
  excellent: { label: 'Excelente', color: 'text-success', bars: 4 },
  good:      { label: 'Buena',     color: 'text-success',   bars: 3 },
  fair:      { label: 'Regular',   color: 'text-warning',   bars: 2 },
  poor:      { label: 'Débil',     color: 'text-destructive',     bars: 1 },
  unknown:   { label: '...',       color: 'text-white/50',    bars: 0 },
};

function SignalBars({ bars, colorClass }: { bars: number; colorClass: string }) {
  return (
    <div className="flex items-end gap-[2px] h-3.5">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`w-[3px] rounded-sm transition-colors ${
            i <= bars ? colorClass.replace('text-', 'bg-') : 'bg-white/20'
          }`}
          style={{ height: `${25 + i * 20}%` }}
        />
      ))}
    </div>
  );
}

export function ConnectionQualityIndicator({ stats }: ConnectionQualityIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const config = qualityConfig[stats.quality];

  return (
    <div className="absolute top-3 left-3 z-30">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm border border-white/10 hover:bg-black/80 transition-colors ${config.color}`}
      >
        {stats.quality === 'poor' ? (
          <WifiOff className="w-3.5 h-3.5" />
        ) : (
          <Wifi className="w-3.5 h-3.5" />
        )}
        <SignalBars bars={config.bars} colorClass={config.color} />
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-white/50" />
        ) : (
          <ChevronDown className="w-3 h-3 text-white/50" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="mt-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 min-w-[180px] text-xs"
          >
            <div className={`font-semibold mb-2 ${config.color}`}>
              {config.label}
            </div>
            <div className="space-y-1.5 text-white/70">
              {stats.latency !== null && (
                <div className="flex justify-between">
                  <span>Latencia</span>
                  <span className={`font-mono ${stats.latency > 300 ? 'text-destructive' : stats.latency > 150 ? 'text-warning' : 'text-white'}`}>
                    {stats.latency}ms
                  </span>
                </div>
              )}
              {stats.packetLoss !== null && (
                <div className="flex justify-between">
                  <span>Pérdida paquetes</span>
                  <span className={`font-mono ${stats.packetLoss > 5 ? 'text-destructive' : stats.packetLoss > 2 ? 'text-warning' : 'text-white'}`}>
                    {stats.packetLoss}%
                  </span>
                </div>
              )}
              {stats.sendBitrate !== null && (
                <div className="flex justify-between">
                  <span>Envío</span>
                  <span className="font-mono text-white">{stats.sendBitrate} kbps</span>
                </div>
              )}
              {stats.recvBitrate !== null && (
                <div className="flex justify-between">
                  <span>Recepción</span>
                  <span className="font-mono text-white">{stats.recvBitrate} kbps</span>
                </div>
              )}
              {stats.latency === null && stats.packetLoss === null && (
                <div className="text-white/40 italic">Recopilando datos...</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
