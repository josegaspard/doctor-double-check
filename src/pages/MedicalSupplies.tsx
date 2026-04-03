import React, { useState, useMemo } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Search, Package, ExternalLink, ShoppingCart, Filter,
  Stethoscope, Syringe, HeartPulse, Microscope, Pill, Shield,
  Building2, Phone, Globe, MapPin,
} from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  description: string;
  website?: string;
  phone?: string;
  location: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  priceRange: string;
  imageUrl: string;
  supplierId: string;
}

const SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Medline México', description: 'Distribuidor líder de insumos médicos y quirúrgicos', website: 'https://www.medline.com', phone: '+52 55 5000 1000', location: 'CDMX' },
  { id: 's2', name: 'BD (Becton Dickinson)', description: 'Tecnología médica, dispositivos y sistemas de diagnóstico', website: 'https://www.bd.com/es-mx', phone: '+52 55 5999 8000', location: 'CDMX' },
  { id: 's3', name: '3M Salud', description: 'Soluciones para el cuidado de la salud y equipos médicos', website: 'https://www.3m.com.mx', phone: '+52 55 5270 2222', location: 'Edo. Méx.' },
  { id: 's4', name: 'Cardinal Health México', description: 'Productos farmacéuticos e insumos médico-quirúrgicos', website: 'https://www.cardinalhealth.com', phone: '+52 55 5200 3500', location: 'CDMX' },
  { id: 's5', name: 'Equipos Médicos Vizcarra', description: 'Equipos y mobiliario médico especializado', website: 'https://www.vizcarramedica.com.mx', phone: '+52 55 5561 7890', location: 'CDMX' },
  { id: 's6', name: 'Degasa', description: 'Materiales de curación y algodón absorbente', website: 'https://www.degasa.com', phone: '+52 33 3145 6000', location: 'Guadalajara' },
];

const PRODUCTS: Product[] = [
  { id: 'p1', name: 'Guantes de Nitrilo (Caja 100)', description: 'Guantes de exploración sin polvo, hipoalergénicos. Tallas S, M, L, XL.', category: 'insumos', brand: 'Medline', priceRange: '$180 – $250 MXN', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', supplierId: 's1' },
  { id: 'p2', name: 'Estetoscopio Littmann Classic III', description: 'Estetoscopio de doble campana para auscultación cardíaca y pulmonar.', category: 'diagnóstico', brand: '3M', priceRange: '$2,800 – $3,500 MXN', imageUrl: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&q=80', supplierId: 's3' },
  { id: 'p3', name: 'Jeringa Desechable 10ml (Caja 100)', description: 'Jeringas estériles con aguja integrada 21G para aplicación intramuscular.', category: 'insumos', brand: 'BD', priceRange: '$350 – $450 MXN', imageUrl: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=400&q=80', supplierId: 's2' },
  { id: 'p4', name: 'Baumanómetro Digital de Brazo', description: 'Monitor de presión arterial automático con pantalla LCD y memoria de lecturas.', category: 'diagnóstico', brand: 'Omron', priceRange: '$900 – $1,500 MXN', imageUrl: 'https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&q=80', supplierId: 's5' },
  { id: 'p5', name: 'Kit de Sutura (12 piezas)', description: 'Set de sutura quirúrgica con porta agujas, tijeras y pinzas de disección.', category: 'quirúrgico', brand: 'Medline', priceRange: '$450 – $700 MXN', imageUrl: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=400&q=80', supplierId: 's1' },
  { id: 'p6', name: 'Oxímetro de Pulso de Dedo', description: 'Oxímetro portátil con lectura de SpO2 y frecuencia cardíaca en pantalla LED.', category: 'diagnóstico', brand: 'Nonin', priceRange: '$600 – $1,200 MXN', imageUrl: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&q=80', supplierId: 's4' },
  { id: 'p7', name: 'Gasas Estériles 10x10cm (Paquete 200)', description: 'Gasas de algodón 100% tejido abierto para curación de heridas.', category: 'insumos', brand: 'Degasa', priceRange: '$120 – $180 MXN', imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80', supplierId: 's6' },
  { id: 'p8', name: 'Microscopio Binocular LED', description: 'Microscopio óptico binocular con 4 objetivos, iluminación LED y platina mecánica.', category: 'laboratorio', brand: 'Leica', priceRange: '$18,000 – $25,000 MXN', imageUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&q=80', supplierId: 's5' },
  { id: 'p9', name: 'Carro de Curaciones Acero Inoxidable', description: 'Carro móvil con 3 charolas para instrumental y material de curación.', category: 'mobiliario', brand: 'Vizcarra', priceRange: '$4,500 – $6,500 MXN', imageUrl: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=400&q=80', supplierId: 's5' },
  { id: 'p10', name: 'Termómetro Infrarrojo Sin Contacto', description: 'Termómetro digital con lectura instantánea y memoria de 32 registros.', category: 'diagnóstico', brand: 'Braun', priceRange: '$450 – $800 MXN', imageUrl: 'https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=400&q=80', supplierId: 's3' },
  { id: 'p11', name: 'Bata Quirúrgica Desechable (Paquete 10)', description: 'Bata estéril reforzada con puños elásticos, nivel AAMI 3.', category: 'quirúrgico', brand: 'Cardinal Health', priceRange: '$550 – $750 MXN', imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&q=80', supplierId: 's4' },
  { id: 'p12', name: 'Desfibrilador Externo Automático (DEA)', description: 'DEA portátil con instrucciones de voz en español, incluye electrodos y estuche.', category: 'emergencia', brand: 'Philips', priceRange: '$28,000 – $35,000 MXN', imageUrl: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=400&q=80', supplierId: 's5' },
];

const CATEGORIES = [
  { key: 'all', icon: Package },
  { key: 'insumos', icon: Syringe },
  { key: 'diagnóstico', icon: HeartPulse },
  { key: 'quirúrgico', icon: Stethoscope },
  { key: 'laboratorio', icon: Microscope },
  { key: 'mobiliario', icon: Building2 },
  { key: 'emergencia', icon: Shield },
];

export default function MedicalSupplies() {
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showSuppliers, setShowSuppliers] = useState(false);

  const categoryLabels: Record<string, string> = {
    all: language === 'es' ? 'Todos' : 'All',
    insumos: language === 'es' ? 'Insumos' : 'Supplies',
    diagnóstico: language === 'es' ? 'Diagnóstico' : 'Diagnostic',
    quirúrgico: language === 'es' ? 'Quirúrgico' : 'Surgical',
    laboratorio: language === 'es' ? 'Laboratorio' : 'Lab',
    mobiliario: language === 'es' ? 'Mobiliario' : 'Furniture',
    emergencia: language === 'es' ? 'Emergencia' : 'Emergency',
  };

  const filtered = useMemo(() =>
    PRODUCTS.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCat;
    }),
    [searchQuery, categoryFilter]
  );

  const getSupplier = (id: string) => SUPPLIERS.find(s => s.id === id);

  return (
    <MainLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5 border border-primary/20 p-6 sm:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/15">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground">
                {language === 'es' ? 'Material Médico' : 'Medical Supplies'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {language === 'es' ? 'Directorio de equipos, insumos y material para profesionales de la salud' : 'Equipment, supplies and materials directory for healthcare professionals'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> {filtered.length} {language === 'es' ? 'productos' : 'products'}</span>
            <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {SUPPLIERS.length} {language === 'es' ? 'proveedores' : 'suppliers'}</span>
          </div>
        </div>

        {/* Tabs: Products / Suppliers */}
        <div className="flex gap-2 mb-4">
          <Button variant={!showSuppliers ? 'default' : 'outline'} size="sm" onClick={() => setShowSuppliers(false)}>
            <ShoppingCart className="w-4 h-4 mr-1.5" />
            {language === 'es' ? 'Productos' : 'Products'}
          </Button>
          <Button variant={showSuppliers ? 'default' : 'outline'} size="sm" onClick={() => setShowSuppliers(true)}>
            <Building2 className="w-4 h-4 mr-1.5" />
            {language === 'es' ? 'Proveedores' : 'Suppliers'}
          </Button>
        </div>

        {!showSuppliers ? (
          <>
            {/* Search + Category filters */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={language === 'es' ? 'Buscar producto, marca...' : 'Search product, brand...'}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  return (
                    <button key={cat.key} onClick={() => setCategoryFilter(cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ${categoryFilter === cat.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/50'}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {categoryLabels[cat.key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map(product => {
                const supplier = getSupplier(product.supplierId);
                return (
                  <Card key={product.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="relative h-40 overflow-hidden bg-muted">
                      <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="text-[10px] font-bold shadow-md bg-background/80 backdrop-blur-sm">
                          {categoryLabels[product.category]}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-sm text-foreground mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="outline" className="text-[10px]">{product.brand}</Badge>
                        <span className="text-xs font-bold text-primary">{product.priceRange}</span>
                      </div>
                      {supplier && (
                        <p className="text-[10px] text-muted-foreground mb-3 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {supplier.name}
                        </p>
                      )}
                      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5"
                        onClick={() => supplier?.website && window.open(supplier.website, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                        {language === 'es' ? 'Solicitar información' : 'Request info'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <Card className="p-12 text-center mt-4">
                <Package className="w-16 h-16 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">{language === 'es' ? 'No se encontraron productos' : 'No products found'}</p>
              </Card>
            )}
          </>
        ) : (
          /* Suppliers List */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUPPLIERS.map(supplier => (
              <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground text-sm mb-1">{supplier.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{supplier.description}</p>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="w-3 h-3" /> {supplier.location}
                        </p>
                        {supplier.phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3 h-3" />
                            <a href={`tel:${supplier.phone}`} className="hover:text-primary">{supplier.phone}</a>
                          </p>
                        )}
                        {supplier.website && (
                          <p className="text-xs flex items-center gap-1.5">
                            <Globe className="w-3 h-3 text-primary/70" />
                            <a href={supplier.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                              {supplier.website.replace(/^https?:\/\/(www\.)?/, '')}
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
