import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Video,
  Radio,
  Loader2,
  X,
  Plus,
  ExternalLink,
  CheckCircle2,
  XCircle,
  ImagePlus,
} from 'lucide-react';
// Codec check removed — local recording supports all codecs

const SPECIALTIES = [
  'Cardiología', 'Dermatología', 'Endocrinología', 'Gastroenterología',
  'Ginecología', 'Medicina General', 'Medicina Interna', 'Neurología',
  'Oftalmología', 'Oncología', 'Ortopedia', 'Pediatría',
  'Psiquiatría', 'Urología', 'Otra',
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
  thumbnailFile?: File | null;
  chatEnabled: boolean;
  maxQuestions: number | null;
  maxPaidChats: number | null;
}

export function LiveSetupForm({ onStartLive, isCreating }: LiveSetupFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recordingPrice, setRecordingPrice] = useState<number | ''>('');
  const [enableRecording, setEnableRecording] = useState(true);
  const [showRtmpsInfo, setShowRtmpsInfo] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [maxQuestions, setMaxQuestions] = useState<number | ''>('');
  const [maxPaidChats, setMaxPaidChats] = useState<number | ''>('');

  // Codec check removed — local recording supports all browser codecs

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

  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<File> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const compressed = await compressImage(file);
    setThumbnailFile(compressed);
    const reader = new FileReader();
    reader.onload = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(compressed);
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = () => {
    onStartLive({ title, description, specialty, tags, recordingPrice: Number(recordingPrice) || 0, enableRecording, thumbnailFile });
  };

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-2xl pb-24 sm:pb-8">
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold">Iniciar Transmisión</h1>
          <p className="text-sm text-muted-foreground">Configura tu live antes de comenzar</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalles del Live</CardTitle>
          <CardDescription>Esta información se mostrará a los espectadores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              placeholder="Ej: Consulta abierta sobre hipertensión"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{title.length}/100 caracteres</p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              placeholder="Describe de qué tratará tu transmisión..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{description.length}/500 caracteres</p>
          </div>

          {/* Thumbnail */}
          <div className="space-y-2">
            <Label>Portada del Live (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
            />
            {thumbnailPreview ? (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                <img src={thumbnailPreview} alt="Portada" className="w-full h-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7 rounded-full"
                  onClick={removeThumbnail}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-24 border-dashed gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">Subir imagen de portada</span>
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Recomendado: imagen menor a 1 MB. Se comprimirá automáticamente al subirla.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialty">Especialidad *</Label>
            <select
              id="specialty"
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>Selecciona una especialidad</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              La especialidad ayuda a los pacientes a encontrar tu transmisión
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Añade una etiqueta"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                maxLength={30}
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag} disabled={tags.length >= 5}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{tags.length}/5 etiquetas</p>
          </div>

          {/* Recording settings */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Grabar transmisión</Label>
                <p className="text-xs text-muted-foreground">Guarda la grabación para venderla después</p>
              </div>
              <Switch checked={enableRecording} onCheckedChange={setEnableRecording} />
            </div>

            {enableRecording && (
              <div className="space-y-2">
                <Label htmlFor="price">Precio de la grabación (MXN)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  step={10}
                  placeholder="0 = gratuita"
                  value={recordingPrice}
                  onChange={(e) => setRecordingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  onFocus={(e) => { if (e.target.value === '0') setRecordingPrice(''); }}
                />
                <p className="text-xs text-muted-foreground">Deja en 0 para ofrecer la grabación gratis</p>
              </div>
            )}
          </div>

          {/* Recording info */}
          {enableRecording && (
            <Alert className="border-primary/50 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle>Grabación local activa</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                La grabación se guardará localmente y se subirá al finalizar el live.
              </AlertDescription>
            </Alert>
          )}

          {showRtmpsInfo && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Transmitir con OBS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Puedes usar OBS Studio (gratuito) para transmitir con mejor calidad:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Descarga <a href="https://obsproject.com" target="_blank" rel="noopener" className="text-primary underline">OBS Studio</a></li>
                  <li>Ve a <strong>Configuración → Stream</strong></li>
                  <li>Selecciona <strong>Servicio: Personalizado</strong></li>
                  <li>La URL y clave se generarán al iniciar</li>
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Submit - hidden on mobile (sticky version below) */}
          <div className="hidden sm:block">
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSubmit}
              disabled={isCreating || !title.trim() || !specialty}
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Preparando transmisión...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Iniciar Transmisión en Vivo
                </>
              )}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Al iniciar, se notificará automáticamente a tus suscriptores
          </p>
        </CardContent>
      </Card>

      {/* Sticky mobile submit button */}
      <div className="fixed bottom-16 inset-x-0 z-50 p-3 bg-background/95 backdrop-blur border-t border-border sm:hidden" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <Button
          className="w-full gap-2"
          size="lg"
          onClick={handleSubmit}
          disabled={isCreating || !title.trim() || !specialty}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparando...
            </>
          ) : (
            <>
              <Video className="w-5 h-5" />
              Iniciar Transmisión
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
