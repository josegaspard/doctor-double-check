import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MapPin,
  Navigation,
  Search,
  Phone,
  Clock,
  Building2,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone?: string;
  type: 'public' | 'private' | 'clinic';
  lat: number;
  lng: number;
  distance?: number;
}

const SAMPLE_HOSPITALS: Hospital[] = [
  { id: '1', name: 'Hospital General de México', address: 'Dr. Balmis 148, Doctores, Ciudad de México', phone: '+52 55 2789 2000', type: 'public', lat: 19.4115, lng: -99.1524 },
  { id: '2', name: 'Hospital Ángeles Pedregal', address: 'Camino a Santa Teresa 1055, Héroes de Padierna, CDMX', phone: '+52 55 5449 5500', type: 'private', lat: 19.3118, lng: -99.2089 },
  { id: '3', name: 'Hospital ABC Santa Fe', address: 'Av. Carlos Graef Fernández 154, Santa Fe, CDMX', phone: '+52 55 1103 1600', type: 'private', lat: 19.3591, lng: -99.2618 },
  { id: '4', name: 'Instituto Nacional de Cardiología', address: 'Juan Badiano 1, Belisario Domínguez Secc 16, CDMX', phone: '+52 55 5573 2911', type: 'public', lat: 19.2929, lng: -99.1561 },
  { id: '5', name: 'Hospital Médica Sur', address: 'Puente de Piedra 150, Toriello Guerra, CDMX', phone: '+52 55 5424 7200', type: 'private', lat: 19.3015, lng: -99.1550 },
  { id: '6', name: 'Hospital Español', address: 'Av. Ejército Nacional 613, Granada, CDMX', phone: '+52 55 5255 9600', type: 'private', lat: 19.4401, lng: -99.1901 },
  { id: '7', name: 'Hospital Juárez de México', address: 'Av. Instituto Politécnico Nacional 5160, Magdalena de las Salinas, CDMX', phone: '+52 55 5747 7560', type: 'public', lat: 19.4832, lng: -99.1324 },
  { id: '8', name: 'Hospital Infantil de México Federico Gómez', address: 'Dr. Márquez 162, Doctores, CDMX', phone: '+52 55 5228 9917', type: 'public', lat: 19.4139, lng: -99.1509 },
];

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function HospitalLocator() {
  const { t, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private' | 'clinic'>('all');

  useEffect(() => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsLoadingLocation(false);
        },
        () => setIsLoadingLocation(false),
        { timeout: 10000 }
      );
    } else {
      setIsLoadingLocation(false);
    }
  }, []);

  const hospitals = SAMPLE_HOSPITALS
    .map(h => ({
      ...h,
      distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, h.lat, h.lng) : undefined,
    }))
    .filter(h => {
      const matchesSearch = h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || h.type === typeFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));

  const openInMaps = (hospital: Hospital, app: 'google' | 'waze') => {
    if (app === 'waze') {
      window.open(`https://www.waze.com/ul?ll=${hospital.lat},${hospital.lng}&navigate=yes`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`, '_blank');
    }
  };

  const typeLabels: Record<string, string> = {
    all: language === 'es' ? 'Todos' : 'All',
    public: language === 'es' ? 'Público' : 'Public',
    private: language === 'es' ? 'Privado' : 'Private',
    clinic: language === 'es' ? 'Clínica' : 'Clinic',
  };

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            {language === 'es' ? 'Localiza un Hospital' : 'Find a Hospital'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {language === 'es' ? 'Encuentra hospitales cercanos y abre la ruta en Waze o Google Maps' : 'Find nearby hospitals and open directions in Waze or Google Maps'}
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={language === 'es' ? 'Buscar hospital...' : 'Search hospital...'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Type filter chips */}
        <div className="flex gap-2 mb-4">
          {(['all', 'public', 'private', 'clinic'] as const).map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                typeFilter === type
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {typeLabels[type]}
            </button>
          ))}
        </div>

        {isLoadingLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {language === 'es' ? 'Obteniendo tu ubicación...' : 'Getting your location...'}
          </div>
        )}

        {/* Hospital list */}
        <div className="space-y-3">
          {hospitals.map(hospital => (
            <Card key={hospital.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate">{hospital.name}</h3>
                      <Badge variant={hospital.type === 'public' ? 'secondary' : 'outline'} className="text-[10px] flex-shrink-0">
                        {typeLabels[hospital.type]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {hospital.address}
                    </p>
                    {hospital.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <a href={`tel:${hospital.phone}`} className="hover:text-primary">{hospital.phone}</a>
                      </p>
                    )}
                    {hospital.distance !== undefined && (
                      <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        {hospital.distance < 1
                          ? `${Math.round(hospital.distance * 1000)} m`
                          : `${hospital.distance.toFixed(1)} km`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={() => openInMaps(hospital, 'google')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Google Maps
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-xs flex-1"
                    onClick={() => openInMaps(hospital, 'waze')}
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Waze
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {hospitals.length === 0 && (
            <Card className="p-8 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {language === 'es' ? 'No se encontraron hospitales' : 'No hospitals found'}
              </p>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
