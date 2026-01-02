import React from 'react';
import { Link } from 'react-router-dom';
import { useLives } from '@/contexts/LivesContext';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Video, 
  Users, 
  Clock, 
  Radio,
  Eye,
  Lock
} from 'lucide-react';

export default function LivesGrid() {
  const { lives } = useLives();
  const { role } = useAuth();

  const activeLives = lives.filter(l => l.status === 'live').slice(0, 20);

  const formatDuration = (startedAt: Date) => {
    const diff = Date.now() - startedAt.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Radio className="w-6 h-6 text-live animate-pulse" />
              Transmisiones en Vivo
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeLives.length} de 20 transmisiones activas
            </p>
          </div>
          
          {role === 'visitor' && (
            <div className="flex items-center gap-2 bg-accent/50 rounded-lg px-4 py-2">
              <Eye className="w-4 h-4 text-accent-foreground" />
              <span className="text-sm text-accent-foreground">
                Modo visitante - Los lives son gratis
              </span>
            </div>
          )}
        </div>

        {/* Lives Grid */}
        {activeLives.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeLives.map((live) => (
              <Link key={live.id} to={`/live/${live.id}`}>
                <Card className="card-live group cursor-pointer overflow-hidden hover:shadow-lg transition-all">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-info/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-12 h-12 text-primary/40" />
                    </div>
                    
                    {/* Live Badge */}
                    <div className="absolute top-2 left-2">
                      <Badge variant="live" className="gap-1">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        EN VIVO
                      </Badge>
                    </div>
                    
                    {/* Viewers */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
                        <Users className="w-3 h-3" />
                        {live.viewerCount}
                      </Badge>
                    </div>
                    
                    {/* Duration */}
                    <div className="absolute bottom-2 right-2">
                      <Badge variant="secondary" className="gap-1 bg-black/50 text-white border-0">
                        <Clock className="w-3 h-3" />
                        {formatDuration(live.startedAt)}
                      </Badge>
                    </div>
                    
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-white/0 group-hover:bg-white/90 flex items-center justify-center transition-colors">
                        <Video className="w-6 h-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
                      {live.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">
                          {live.doctorName.charAt(0)}
                        </span>
                      </div>
                      <span className="truncate">{live.doctorName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-3">
                      <Badge variant="outline" className="text-xs">
                        {live.specialty}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Video className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No hay transmisiones activas
            </h3>
            <p className="text-muted-foreground">
              Vuelve más tarde para ver contenido en vivo
            </p>
          </Card>
        )}

        {/* Info Banner for Visitors */}
        {role === 'visitor' && (
          <Card className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-info/5 border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">¿Quieres más?</h3>
                </div>
                <p className="text-muted-foreground">
                  Regístrate para acceder a grabaciones premium, chat con médicos y tu vault médico personal.
                </p>
              </div>
              <Link to="/login">
                <Button>Crear Cuenta Gratis</Button>
              </Link>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
