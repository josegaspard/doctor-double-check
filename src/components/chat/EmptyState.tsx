import React from 'react';
import { MessageSquare, History, Inbox } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-sessions' | 'no-selection' | 'no-history';
  activeTab?: 'active' | 'history';
}

export function EmptyState({ type, activeTab = 'active' }: EmptyStateProps) {
  if (type === 'no-sessions') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
          <Inbox className="w-8 h-8 text-primary/60" />
        </div>
        <h3 className="font-medium text-foreground mb-1">
          {activeTab === 'active' ? 'No hay conversaciones activas' : 'Sin historial'}
        </h3>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          {activeTab === 'active' 
            ? 'Tus consultas activas aparecerán aquí'
            : 'Las consultas cerradas se mostrarán aquí'
          }
        </p>
      </div>
    );
  }

  if (type === 'no-selection') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center mb-6">
          {activeTab === 'active' ? (
            <MessageSquare className="w-10 h-10 opacity-40" />
          ) : (
            <History className="w-10 h-10 opacity-40" />
          )}
        </div>
        <h3 className="font-medium text-foreground mb-2">
          {activeTab === 'active' ? 'Selecciona una conversación' : 'Revisa tu historial'}
        </h3>
        <p className="text-sm text-center max-w-[250px]">
          {activeTab === 'active' 
            ? 'Elige una conversación de la lista para comenzar a chatear'
            : 'Selecciona una consulta anterior para ver los mensajes'
          }
        </p>
      </div>
    );
  }

  return null;
}
