import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Video,
  Radio,
  Loader2,
  X,
  Plus,
  DollarSign,
  MessageSquare,
  Tag,
  ChevronDown,
  Info,
  Mic,
  FilmIcon,
  Camera,
  Upload,
  Sparkles,
} from 'lucide-react';

const SPECIALTIES = [
  'Alergología', 'Anestesiología', 'Angiología', 'Cardiología', 'Cirugía General',
  'Cirugía Plástica', 'Coloproctología', 'Dermatología', 'Endocrinología',
  'Gastroenterología', 'Geriatría', 'Ginecología', 'Hematología', 'Infectología',
  'Medicina Crítica', 'Medicina de Urgencias', 'Medicina del Deporte', 'Medicina Familiar',
  'Medicina Física y Rehabilitación', 'Medicina General', 'Medicina Interna',
  'Nefrología', 'Neonatología', 'Neumología', 'Neurología', 'Nutriología',
  'Oftalmología', 'Oncología', 'Ortopedia', 'Otorrinolaringología', 'Patología',
  'Pediatría', 'Psiquiatría', 'Radiología', 'Reumatología', 'Traumatología',
  'Urología', 'Otra',
];

interface LiveSetupFormProps {
  onStartLive: (config: LiveConfig) => Promise<void>;
  isCreating: boolean;
}

export interface LiveConfig {
  title: string;
  description: string;
  specialty: string;
  tags: string[];
  recordingPrice: number;
  enableRecording: boolean;
  chatEnabled: boolean;
  maxQuestions: number | null;
  maxPaidChats: number | null;
  thumbnailFile: File | null;
  chatMode: 'free' | 'paid_only' | 'mixed';
  chatPrice: number;
  chatHighlightSeconds: number;
}

function SectionHeader({ number, icon: Icon, title, subtitle }: { number: number; icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
        {number}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-foreground text-base">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

interface ChatModeCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function ChatModeCard({ icon: Icon, title, description, selected, onClick }: ChatModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className={`font-semibold text-sm ${selected ? 'text-primary' : 'text-foreground'}`}>{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </button>
  );
}

export function LiveSetupForm({ onStartLive, isCreating }: LiveSetupFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recordingPrice, setRecordingPrice] = useState<number | ''>('');
  const [enableRecording, setEnableRecording] = useState(true);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [maxQuestions, setMaxQuestions] = useState<number | ''>('');
  const [maxPaidChats, setMaxPaidChats] = useState<number | ''>('');
  const [showAdvancedChat, setShowAdvancedChat] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [chatMode, setChatMode] = useState<'free' | 'paid_only' | 'mixed'>('free');
  const [chatPrice, setChatPrice] = useState<number | ''>('');
  const [chatHighlightSeconds, setChatHighlightSeconds] = useState<number>(120);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleThumbnailSelect = (file: File) => {
    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setThumbnailPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    onStartLive({
      title,
      description,
      specialty,
      tags,
      recordingPrice: Number(recordingPrice) || 0,
      enableRecording,
      chatEnabled,
      maxQuestions: maxQuestions === '' ? null : Number(maxQuestions),
      maxPaidChats: maxPaidChats === '' ? null : Number(maxPaidChats),
      thumbnailFile,
      chatMode,
      chatPrice: Number(chatPrice) || 0,
      chatHighlightSeconds,
    });
  };

  const isValid = title.trim().length > 0 && specialty.length > 0;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-xl pb-36 sm:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
          <Radio className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold">Iniciar Transmisión</h1>
          <p className="text-xs text-muted-foreground">Completa los campos y comienza tu live</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Section 1: About your live + Thumbnail ── */}
        <section className="space-y-4">
          <SectionHeader number={1} icon={Mic} title="¿De qué trata tu live?" subtitle="Estos datos se muestran a los espectadores" />
          
          {/* ★ THUMBNAIL — now prominent and always visible */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="w-4 h-4" />
              Imagen de portada
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Esta imagen aparecerá cuando los espectadores vean tu live
            </p>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleThumbnailSelect(f); }}
            />
            {thumbnailPreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/30">
                <img src={thumbnailPreview} alt="Portada" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (thumbnailInputRef.current) thumbnailInputRef.current.value = ''; }}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/10 transition-all active:scale-[0.98]"
                onClick={() => thumbnailInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/10'); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/10'); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-primary', 'bg-primary/10'); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith('image/')) handleThumbnailSelect(f); }}
              >
                <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  Toca aquí para subir tu imagen de portada
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Arrastra una imagen o haz clic para seleccionar
                </p>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); thumbnailInputRef.current?.click(); }}>
                  <Upload className="w-4 h-4" />
                  Seleccionar imagen
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title" className="flex items-center gap-1 text-sm font-semibold">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ej: Consulta abierta sobre hipertensión"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className={`min-h-12 text-base ${!title.trim() && title.length > 0 ? 'border-destructive' : ''}`}
            />
            <p className="text-[11px] text-muted-foreground text-right">{title.length}/100</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-semibold">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe brevemente tu transmisión..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              className="text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="specialty" className="flex items-center gap-1 text-sm font-semibold">
              Especialidad <span className="text-destructive">*</span>
            </Label>
            <select
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="flex min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="" disabled>Selecciona una especialidad</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </section>

        <div className="border-t border-border" />

        {/* ── Section 2: Recording & Monetization ── */}
        <section className="space-y-4">
          <SectionHeader number={2} icon={FilmIcon} title="Grabación y monetización" subtitle="Decide si grabas y cuánto cobrarás" />

          <div className="flex items-center justify-between min-h-12">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Grabar transmisión</Label>
              <p className="text-xs text-muted-foreground">Podrás vender la grabación después</p>
            </div>
            <Switch checked={enableRecording} onCheckedChange={setEnableRecording} />
          </div>

          {enableRecording && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
              <Label htmlFor="price" className="flex items-center gap-2 text-sm font-semibold text-primary">
                <DollarSign className="w-4 h-4" />
                Precio de la grabación (MXN)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-base">$</span>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={10}
                  placeholder="0"
                  value={recordingPrice}
                  onChange={(e) => setRecordingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  onFocus={(e) => { if (e.target.value === '0') setRecordingPrice(''); }}
                  className="pl-8 text-lg min-h-12 font-semibold"
                />
              </div>
              <div className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Escribe <strong>0</strong> si será gratuita. Los suscriptores premium la obtienen gratis.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="border-t border-border" />

        {/* ── Section 3: Chat ── */}
        <section className="space-y-4">
          <SectionHeader number={3} icon={MessageSquare} title="Chat en vivo" subtitle="Configura cómo interactúan los espectadores" />

          <div className="flex items-center justify-between min-h-12">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Permitir preguntas</Label>
              <p className="text-xs text-muted-foreground">Los espectadores pueden escribir en el chat</p>
            </div>
            <Switch checked={chatEnabled} onCheckedChange={setChatEnabled} />
          </div>

          {chatEnabled && (
            <>
              {/* ★ Visual Chat Mode Cards — replaces confusing radio buttons */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">¿Cómo quieres que funcione el chat?</Label>
                <div className="space-y-2">
                  <ChatModeCard
                    icon={MessageSquare}
                    title="Chat gratuito"
                    description="Todos pueden comentar gratis"
                    selected={chatMode === 'free'}
                    onClick={() => setChatMode('free')}
                  />
                  <ChatModeCard
                    icon={Sparkles}
                    title="Chat con mensajes destacados"
                    description="Los espectadores pueden pagar para que su mensaje se destaque. Tú defines el precio."
                    selected={chatMode === 'mixed'}
                    onClick={() => setChatMode('mixed')}
                  />
                  <ChatModeCard
                    icon={DollarSign}
                    title="Solo pacientes suscritos"
                    description="Solo pueden comentar los pacientes que estén suscritos a ti"
                    selected={chatMode === 'paid_only'}
                    onClick={() => setChatMode('paid_only')}
                  />
                </div>
              </div>

              {/* ★ Price input — immediately visible when paid mode selected */}
              {(chatMode === 'paid_only' || chatMode === 'mixed') && (
                <div className="rounded-xl border-2 border-accent/30 bg-accent/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Label htmlFor="chatPrice" className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    ¿Cuánto cobrar por mensaje?
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-base">$</span>
                    <Input
                      id="chatPrice"
                      type="number"
                      min={1}
                      placeholder="Ej: 20"
                      value={chatPrice}
                      onChange={(e) => setChatPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      className="pl-8 text-lg min-h-12 font-semibold"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cada mensaje pagado se destacará por {chatHighlightSeconds >= 60 ? `${Math.round(chatHighlightSeconds / 60)} minuto(s)` : `${chatHighlightSeconds} segundos`}
                  </p>
                </div>
              )}

              <Collapsible open={showAdvancedChat} onOpenChange={setShowAdvancedChat}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedChat ? 'rotate-180' : ''}`} />
                    Opciones avanzadas
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 space-y-3">
                  {(chatMode === 'paid_only' || chatMode === 'mixed') && (
                    <div className="space-y-1.5">
                      <Label htmlFor="chatHighlight" className="text-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Duración del destacado (segundos)
                      </Label>
                      <Input
                        id="chatHighlight"
                        type="number"
                        min={10}
                        max={600}
                        placeholder="120"
                        value={chatHighlightSeconds}
                        onChange={(e) => setChatHighlightSeconds(Number(e.target.value) || 120)}
                        className="min-h-12"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="maxQuestions" className="text-xs">Límite de preguntas</Label>
                    <Input
                      id="maxQuestions"
                      type="number"
                      min={1}
                      placeholder="Sin límite"
                      value={maxQuestions}
                      onChange={(e) => setMaxQuestions(e.target.value === '' ? '' : Number(e.target.value))}
                      className="min-h-12"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="maxPaidChats" className="text-xs">Límite de orientaciones pagadas</Label>
                    <Input
                      id="maxPaidChats"
                      type="number"
                      min={1}
                      placeholder="Sin límite"
                      value={maxPaidChats}
                      onChange={(e) => setMaxPaidChats(e.target.value === '' ? '' : Number(e.target.value))}
                      className="min-h-12"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </section>

        <div className="border-t border-border" />

        {/* ── Section 4: Tags (compact) ── */}
        <section className="space-y-3">
          <SectionHeader number={4} icon={Tag} title="Etiquetas" subtitle="Opcional · Ayudan a encontrar tu live" />
          <div className="flex gap-2">
            <Input
              placeholder="Añade una etiqueta"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              maxLength={30}
              className="min-h-12"
            />
            <Button type="button" variant="outline" size="icon" onClick={addTag} disabled={tags.length >= 5} className="h-12 w-12">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </section>

        {/* Desktop submit */}
        <div className="hidden sm:block pt-2">
          <Button
            className="w-full gap-2 min-h-12 text-base"
            size="lg"
            onClick={handleSubmit}
            disabled={isCreating || !isValid}
          >
            {isCreating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Preparando transmisión...</>
            ) : (
              <><Video className="w-5 h-5" /> Iniciar Transmisión en Vivo</>
            )}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground mt-2">
            Se notificará automáticamente a tus suscriptores
          </p>
        </div>
      </div>

      {/* Sticky mobile submit */}
      <div className="fixed bottom-16 inset-x-0 z-50 p-3 bg-background/95 backdrop-blur border-t border-border sm:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Button
          className="w-full gap-2 min-h-12 text-base"
          size="lg"
          onClick={handleSubmit}
          disabled={isCreating || !isValid}
        >
          {isCreating ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Preparando...</>
          ) : (
            <><Video className="w-5 h-5" /> Iniciar Transmisión</>
          )}
        </Button>
      </div>
    </div>
  );
}
