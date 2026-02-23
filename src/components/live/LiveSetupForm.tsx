import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { checkH264Support } from '@/hooks/cloudflare';

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
}

export function LiveSetupForm({ onStartLive, isCreating }: LiveSetupFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [recordingPrice, setRecordingPrice] = useState(0);
  const [enableRecording, setEnableRecording] = useState(true);
  const [showRtmpsInfo, setShowRtmpsInfo] = useState(false);

  const [codecCheck, setCodecCheck] = useState<{
    checked: boolean;
    h264Supported: boolean;
    availableCodecs: string[];
  }>({ checked: false, h264Supported: false, availableCodecs: [] });

  useEffect(() => {
    checkH264Support().then(result => {
      setCodecCheck({
        checked: true,
        h264Supported: result.h264Supported,
        availableCodecs: result.availableCodecs,
      });
    });
  }, []);

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

  const handleSubmit = () => {
    onStartLive({ title, description, specialty, tags, recordingPrice, enableRecording });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <Radio className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Iniciar Transmisión</h1>
          <p className="text-muted-foreground">Configura tu live antes de comenzar</p>
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

          {/* Specialty */}
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
                  onChange={(e) => setRecordingPrice(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Deja en 0 para ofrecer la grabación gratis</p>
              </div>
            )}
          </div>

          {/* Codec warnings */}
          {codecCheck.checked && enableRecording && !codecCheck.h264Supported && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Tu navegador no soporta grabaciones</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Tu navegador solo soporta: {codecCheck.availableCodecs.join(', ') || 'VP8'}.
                  Cloudflare requiere <strong>H.264</strong> para generar grabaciones.
                </p>
                <p className="font-medium">Opciones:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Usa <strong>Google Chrome</strong> (mejor soporte H.264)</li>
                  <li>Usa <strong>OBS con RTMPS</strong> para transmitir</li>
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowRtmpsInfo(!showRtmpsInfo)}
                >
                  {showRtmpsInfo ? 'Ocultar info RTMPS' : 'Ver cómo usar OBS'}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {codecCheck.checked && enableRecording && codecCheck.h264Supported && (
            <Alert className="border-primary/50 bg-primary/5">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle>Navegador compatible</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Tu navegador soporta H.264. Las grabaciones funcionarán correctamente.
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

          {/* Submit */}
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

          <p className="text-xs text-center text-muted-foreground">
            Al iniciar, se notificará automáticamente a tus suscriptores
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
