import React, { useState, useEffect, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  MapPin, Navigation, Search, Phone, Clock, Building2,
  ExternalLink, Loader2, Globe, ChevronDown, ChevronUp, Star,
  Shield, Stethoscope,
} from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  website?: string;
  type: 'public' | 'private' | 'clinic';
  level: string;
  specialties: string[];
  hours: string;
  zone: string;
  imageUrl: string;
  lat: number;
  lng: number;
  distance?: number;
}

const HOSPITALS: Hospital[] = [
  {
    id: '1', name: 'Hospital General de México "Dr. Eduardo Liceaga"',
    address: 'Dr. Balmis 148, Col. Doctores, Cuauhtémoc, CDMX',
    phone: '+52 55 2789 2000', website: 'https://hgm.salud.gob.mx',
    type: 'public', level: '3er Nivel', zone: 'Centro',
    specialties: ['Oncología', 'Cardiología', 'Neurología', 'Cirugía General', 'Medicina Interna'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&q=80',
    lat: 19.4115, lng: -99.1524,
  },
  {
    id: '2', name: 'Hospital Ángeles Pedregal',
    address: 'Camino a Santa Teresa 1055, Héroes de Padierna, CDMX',
    phone: '+52 55 5449 5500', website: 'https://hospitalesangeles.com/pedregal',
    type: 'private', level: '3er Nivel', zone: 'Sur',
    specialties: ['Traumatología', 'Cardiología', 'Oncología', 'Pediatría', 'Neurología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
    lat: 19.3118, lng: -99.2089,
  },
  {
    id: '3', name: 'Hospital ABC Santa Fe',
    address: 'Av. Carlos Graef Fernández 154, Santa Fe, CDMX',
    phone: '+52 55 1103 1600', website: 'https://centromedicoabc.com',
    type: 'private', level: '3er Nivel', zone: 'Poniente',
    specialties: ['Cardiología', 'Oncología', 'Trasplantes', 'Neurocirugía', 'Neonatología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=600&q=80',
    lat: 19.3591, lng: -99.2618,
  },
  {
    id: '4', name: 'Instituto Nacional de Cardiología "Ignacio Chávez"',
    address: 'Juan Badiano 1, Belisario Domínguez Secc 16, Tlalpan, CDMX',
    phone: '+52 55 5573 2911', website: 'https://www.cardiologia.org.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Cardiología', 'Cirugía Cardiotorácica', 'Hemodinámica', 'Electrofisiología'],
    hours: 'Lun-Vie 7:00-20:00 | Urgencias 24h', imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&q=80',
    lat: 19.2929, lng: -99.1561,
  },
  {
    id: '5', name: 'Hospital Médica Sur',
    address: 'Puente de Piedra 150, Toriello Guerra, Tlalpan, CDMX',
    phone: '+52 55 5424 7200', website: 'https://www.medicasur.com.mx',
    type: 'private', level: '3er Nivel', zone: 'Sur',
    specialties: ['Oncología', 'Trasplantes', 'Neurología', 'Gastroenterología', 'Urología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=600&q=80',
    lat: 19.3015, lng: -99.1550,
  },
  {
    id: '6', name: 'Hospital Español',
    address: 'Av. Ejército Nacional 613, Granada, Miguel Hidalgo, CDMX',
    phone: '+52 55 5255 9600', website: 'https://www.hespanol.com',
    type: 'private', level: '2do Nivel', zone: 'Poniente',
    specialties: ['Medicina Interna', 'Cirugía General', 'Ginecología', 'Ortopedia', 'Pediatría'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1596541223130-5d31a73fb6c6?w=600&q=80',
    lat: 19.4401, lng: -99.1901,
  },
  {
    id: '7', name: 'Hospital Juárez de México',
    address: 'Av. Instituto Politécnico Nacional 5160, Magdalena de las Salinas, CDMX',
    phone: '+52 55 5747 7560', website: 'https://www.gob.mx/hospitaljuarez',
    type: 'public', level: '3er Nivel', zone: 'Norte',
    specialties: ['Cirugía General', 'Traumatología', 'Medicina Interna', 'Pediatría', 'Urgencias'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=600&q=80',
    lat: 19.4832, lng: -99.1324,
  },
  {
    id: '8', name: 'Hospital Infantil de México "Federico Gómez"',
    address: 'Dr. Márquez 162, Doctores, Cuauhtémoc, CDMX',
    phone: '+52 55 5228 9917', website: 'https://himfg.com.mx',
    type: 'public', level: '3er Nivel', zone: 'Centro',
    specialties: ['Pediatría', 'Neonatología', 'Cirugía Pediátrica', 'Oncología Pediátrica'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80',
    lat: 19.4139, lng: -99.1509,
  },
  {
    id: '9', name: 'Instituto Nacional de Ciencias Médicas y Nutrición "Salvador Zubirán"',
    address: 'Vasco de Quiroga 15, Belisario Domínguez Secc 16, Tlalpan, CDMX',
    phone: '+52 55 5487 0900', website: 'https://www.incmnsz.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Gastroenterología', 'Endocrinología', 'Nutrición', 'Infectología', 'Nefrología'],
    hours: 'Lun-Vie 7:00-20:00 | Urgencias 24h', imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80',
    lat: 19.2917, lng: -99.1603,
  },
  {
    id: '10', name: 'Instituto Nacional de Cancerología (INCan)',
    address: 'Av. San Fernando 22, Belisario Domínguez Secc 16, Tlalpan, CDMX',
    phone: '+52 55 5628 0400', website: 'https://www.incan.salud.gob.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Oncología Médica', 'Oncología Quirúrgica', 'Radioterapia', 'Hematología'],
    hours: 'Lun-Vie 7:00-20:00', imageUrl: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=600&q=80',
    lat: 19.2898, lng: -99.1555,
  },
  {
    id: '11', name: 'Hospital Star Médica Centro',
    address: 'Av. Juárez 64, Col. Centro, Cuauhtémoc, CDMX',
    phone: '+52 55 1084 5600', website: 'https://www.starmedica.com',
    type: 'private', level: '2do Nivel', zone: 'Centro',
    specialties: ['Medicina Interna', 'Cirugía General', 'Ginecología', 'Urología', 'Otorrinolaringología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1626315869436-d6781ba69d6e?w=600&q=80',
    lat: 19.4348, lng: -99.1440,
  },
  {
    id: '12', name: 'Hospital ABC Observatorio',
    address: 'Sur 136 No. 116, Las Américas, Álvaro Obregón, CDMX',
    phone: '+52 55 5230 8000', website: 'https://centromedicoabc.com',
    type: 'private', level: '3er Nivel', zone: 'Poniente',
    specialties: ['Cardiología', 'Neurocirugía', 'Oncología', 'Trasplantes', 'Urgencias'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=600&q=80',
    lat: 19.3984, lng: -99.1946,
  },
  {
    id: '13', name: 'Instituto Nacional de Neurología y Neurocirugía',
    address: 'Insurgentes Sur 3877, La Fama, Tlalpan, CDMX',
    phone: '+52 55 5606 3822', website: 'https://www.innn.salud.gob.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Neurología', 'Neurocirugía', 'Psiquiatría', 'Neurorrehabilitación'],
    hours: 'Lun-Vie 7:00-20:00 | Urgencias 24h', imageUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=600&q=80',
    lat: 19.2887, lng: -99.1627,
  },
  {
    id: '14', name: 'Hospital Ángeles Lomas',
    address: 'Vialidad de la Barranca 240, Hacienda de las Palmas, Huixquilucan, Edo. Méx.',
    phone: '+52 55 5246 5000', website: 'https://hospitalesangeles.com/lomas',
    type: 'private', level: '3er Nivel', zone: 'Poniente',
    specialties: ['Cardiología', 'Traumatología', 'Oncología', 'Urología', 'Cirugía Robótica'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
    lat: 19.3948, lng: -99.2836,
  },
  {
    id: '15', name: 'Hospital General "Dr. Manuel Gea González"',
    address: 'Calz. de Tlalpan 4800, Belisario Domínguez Secc 16, Tlalpan, CDMX',
    phone: '+52 55 4000 3000', website: 'https://www.hospitalgea.salud.gob.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Dermatología', 'Cirugía Plástica', 'Medicina Interna', 'Gastroenterología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1580281657527-47f249e8f4df?w=600&q=80',
    lat: 19.2952, lng: -99.1525,
  },
  {
    id: '16', name: 'Hospital 20 de Noviembre (ISSSTE)',
    address: 'Av. Félix Cuevas 540, Del Valle, Benito Juárez, CDMX',
    phone: '+52 55 5200 5003',
    type: 'public', level: '3er Nivel', zone: 'Centro',
    specialties: ['Cardiología', 'Nefrología', 'Trasplantes', 'Hematología', 'Medicina Interna'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=600&q=80',
    lat: 19.3744, lng: -99.1736,
  },
  {
    id: '17', name: 'Instituto Nacional de Enfermedades Respiratorias (INER)',
    address: 'Calz. de Tlalpan 4502, Belisario Domínguez Secc 16, Tlalpan, CDMX',
    phone: '+52 55 5487 1700', website: 'https://www.iner.salud.gob.mx',
    type: 'public', level: '3er Nivel', zone: 'Sur',
    specialties: ['Neumología', 'Cirugía de Tórax', 'Alergología', 'Medicina Crítica'],
    hours: 'Lun-Vie 7:00-20:00 | Urgencias 24h', imageUrl: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=600&q=80',
    lat: 19.2970, lng: -99.1533,
  },
  {
    id: '18', name: 'Hospital Ángeles Metropolitano',
    address: 'Tlacotalpan 59, Roma Sur, Cuauhtémoc, CDMX',
    phone: '+52 55 5265 1800', website: 'https://hospitalesangeles.com/metropolitano',
    type: 'private', level: '2do Nivel', zone: 'Centro',
    specialties: ['Ginecología', 'Pediatría', 'Cirugía General', 'Medicina Interna', 'Traumatología'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=600&q=80',
    lat: 19.4054, lng: -99.1605,
  },
  {
    id: '19', name: 'Hospital Regional "Lic. Adolfo López Mateos" (ISSSTE)',
    address: 'Av. Universidad 1321, Florida, Álvaro Obregón, CDMX',
    phone: '+52 55 5322 2300',
    type: 'public', level: '2do Nivel', zone: 'Poniente',
    specialties: ['Medicina Interna', 'Cirugía General', 'Traumatología', 'Pediatría'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1632833239869-a37e3a5806d2?w=600&q=80',
    lat: 19.3523, lng: -99.1821,
  },
  {
    id: '20', name: 'Hospital Star Médica Tlalnepantla',
    address: 'Av. San Andrés Atoto 150, Naucalpan, Edo. Méx.',
    phone: '+52 55 2628 3200', website: 'https://www.starmedica.com',
    type: 'private', level: '2do Nivel', zone: 'Norte',
    specialties: ['Cirugía General', 'Ginecología', 'Ortopedia', 'Medicina Interna', 'Urgencias'],
    hours: '24 horas', imageUrl: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&q=80',
    lat: 19.4802, lng: -99.2263,
  },
];

const ZONES = ['Centro', 'Norte', 'Sur', 'Poniente', 'Oriente'];

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function HospitalCard({ hospital, language, typeLabels }: { hospital: Hospital & { distance?: number }; language: string; typeLabels: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);

  const openInMaps = (app: 'google' | 'waze') => {
    const url = app === 'waze'
      ? `https://www.waze.com/ul?ll=${hospital.lat},${hospital.lng}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`;
    window.open(url, '_blank');
  };

  const typeBadgeVariant = hospital.type === 'public' ? 'info' as const : hospital.type === 'private' ? 'premium' as const : 'secondary' as const;

  return (
    <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/60">
      {/* Image */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-muted">
        <img
          src={hospital.imageUrl}
          alt={hospital.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge variant={typeBadgeVariant} className="text-[10px] font-bold shadow-md">
            {typeLabels[hospital.type]}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-bold shadow-md bg-background/80 backdrop-blur-sm">
            {hospital.level}
          </Badge>
        </div>
        {hospital.distance !== undefined && (
          <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-2.5 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1">
            <Navigation className="w-3 h-3" />
            {hospital.distance < 1 ? `${Math.round(hospital.distance * 1000)} m` : `${hospital.distance.toFixed(1)} km`}
          </div>
        )}
        {/* Initials logo overlay */}
        <div className="absolute bottom-3 left-3 w-10 h-10 rounded-lg bg-background/90 backdrop-blur-sm flex items-center justify-center shadow-md border border-border/50">
          <span className="text-xs font-bold text-primary">
            {hospital.name.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('')}
          </span>
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-bold text-foreground text-sm sm:text-base leading-tight mb-2 line-clamp-2">
          {hospital.name}
        </h3>

        <div className="space-y-1.5 mb-3">
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-primary/70" />
            <span>{hospital.address}</span>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
            <a href={`tel:${hospital.phone}`} className="hover:text-primary transition-colors">{hospital.phone}</a>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
            <span>{hospital.hours}</span>
          </p>
          {hospital.website && (
            <p className="text-xs flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 flex-shrink-0 text-primary/70" />
              <a href={hospital.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                {hospital.website.replace(/^https?:\/\/(www\.)?/, '')}
              </a>
            </p>
          )}
        </div>

        {/* Specialties */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 w-full"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span className="font-medium">{language === 'es' ? 'Especialidades' : 'Specialties'} ({hospital.specialties.length})</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
        </button>
        {expanded && (
          <div className="flex flex-wrap gap-1 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {hospital.specialties.map(s => (
              <Badge key={s} variant="outline" className="text-[10px] py-0.5">{s}</Badge>
            ))}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => openInMaps('google')}>
            <ExternalLink className="w-3.5 h-3.5" />
            Google Maps
          </Button>
          <Button variant="default" size="sm" className="gap-1.5 text-xs flex-1" onClick={() => openInMaps('waze')}>
            <Navigation className="w-3.5 h-3.5" />
            Waze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HospitalLocator() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private' | 'clinic'>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');

  useEffect(() => {
    setIsLoadingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setIsLoadingLocation(false); },
        () => setIsLoadingLocation(false),
        { timeout: 10000 }
      );
    } else {
      setIsLoadingLocation(false);
    }
  }, []);

  const typeLabels: Record<string, string> = {
    all: language === 'es' ? 'Todos' : 'All',
    public: language === 'es' ? 'Público' : 'Public',
    private: language === 'es' ? 'Privado' : 'Private',
    clinic: language === 'es' ? 'Clínica' : 'Clinic',
  };

  const hospitals = useMemo(() =>
    HOSPITALS
      .map(h => ({ ...h, distance: userLocation ? getDistance(userLocation.lat, userLocation.lng, h.lat, h.lng) : undefined }))
      .filter(h => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || h.name.toLowerCase().includes(q) || h.address.toLowerCase().includes(q) || h.specialties.some(s => s.toLowerCase().includes(q));
        const matchesType = typeFilter === 'all' || h.type === typeFilter;
        const matchesZone = zoneFilter === 'all' || h.zone === zoneFilter;
        return matchesSearch && matchesType && matchesZone;
      })
      .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)),
    [searchQuery, typeFilter, zoneFilter, userLocation]
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/20 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {language === 'es' ? 'Localiza un Hospital' : 'Find a Hospital'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {language === 'es' ? 'Directorio de hospitales en la Ciudad de México y área metropolitana' : 'Hospital directory in Mexico City and metropolitan area'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {hospitals.length} {language === 'es' ? 'hospitales' : 'hospitals'}</span>
            <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> {language === 'es' ? 'Información verificada' : 'Verified info'}</span>
            {userLocation && <span className="flex items-center gap-1 text-primary font-medium"><MapPin className="w-3.5 h-3.5" /> {language === 'es' ? 'Ubicación activa' : 'Location active'}</span>}
          </div>
        </div>

        {/* Search + Filters */}
        <div className="space-y-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={language === 'es' ? 'Buscar por nombre, dirección o especialidad...' : 'Search by name, address or specialty...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Type filters */}
            {(['all', 'public', 'private'] as const).map(type => (
              <button key={type} onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${typeFilter === type ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'}`}>
                {typeLabels[type]}
              </button>
            ))}
            <span className="w-px h-6 bg-border self-center" />
            {/* Zone filters */}
            {[{ key: 'all', label: language === 'es' ? 'Todas las zonas' : 'All zones' }, ...ZONES.map(z => ({ key: z, label: z }))].map(z => (
              <button key={z.key} onClick={() => setZoneFilter(z.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${zoneFilter === z.key ? 'bg-accent text-accent-foreground border-accent' : 'bg-muted/50 text-muted-foreground border-border hover:border-accent/50'}`}>
                {z.label}
              </button>
            ))}
          </div>
        </div>

        {isLoadingLocation && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            {language === 'es' ? 'Obteniendo tu ubicación...' : 'Getting your location...'}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hospitals.map(h => (
            <HospitalCard key={h.id} hospital={h} language={language} typeLabels={typeLabels} />
          ))}
        </div>

        {hospitals.length === 0 && (
          <Card className="p-12 text-center mt-4">
            <Building2 className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground font-medium">{language === 'es' ? 'No se encontraron hospitales' : 'No hospitals found'}</p>
            <p className="text-xs text-muted-foreground mt-1">{language === 'es' ? 'Intenta ajustar los filtros de búsqueda' : 'Try adjusting the search filters'}</p>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
