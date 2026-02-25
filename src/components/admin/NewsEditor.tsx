import React, { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Undo, Redo,
  Image as ImageIcon, Youtube as YoutubeIcon, Link as LinkIcon,
  Heading1, Heading2, Heading3, Heading4, Heading5, Heading6,
  Save, Eye, Loader2, Upload, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Minus,
} from 'lucide-react';

const NEWS_CATEGORIES = [
  'Cardiología', 'Neurología', 'Oncología', 'Pediatría', 
  'Investigación', 'Tecnología Médica', 'Salud Pública', 
  'Farmacología', 'Cirugía', 'General'
];

interface NewsEditorProps {
  initialData?: {
    id?: string;
    title: string;
    summary: string;
    content: string;
    image_url: string;
    category: string;
    is_published: boolean;
    slug: string;
    author_bio?: string;
    author_social?: { website?: string; twitter?: string; linkedin?: string; instagram?: string };
  };
  onSaved?: () => void;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function NewsEditor({ initialData, onSaved }: NewsEditorProps) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [summary, setSummary] = useState(initialData?.summary || '');
  const [imageUrl, setImageUrl] = useState(initialData?.image_url || '');
  const [category, setCategory] = useState(initialData?.category || 'General');
  const [isPublished, setIsPublished] = useState(initialData?.is_published || false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [authorBio, setAuthorBio] = useState(initialData?.author_bio || '');
  const [authorSocial, setAuthorSocial] = useState<{ website?: string; twitter?: string; linkedin?: string; instagram?: string }>(
    initialData?.author_social || {}
  );

  // Image editing dialog state
  const [imageDialog, setImageDialog] = useState(false);
  const [editingImageSrc, setEditingImageSrc] = useState('');
  const [editingImageAlt, setEditingImageAlt] = useState('');
  const [editingImageWidth, setEditingImageWidth] = useState('100');
  const [editingImageAlign, setEditingImageAlign] = useState<'left' | 'center' | 'right'>('center');

  // Video dialog state
  const [videoDialog, setVideoDialog] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoWidth, setVideoWidth] = useState('640');
  const [videoHeight, setVideoHeight] = useState('360');

  // Link dialog state
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Image.configure({ 
        inline: false, 
        allowBase64: false,
        HTMLAttributes: {
          class: 'rounded-lg',
        },
      }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
      Placeholder.configure({ placeholder: 'Escribe el contenido de la noticia aquí...' }),
    ],
    content: initialData?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] px-4 py-3 dark:prose-invert [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-2 [&_h5]:text-base [&_h5]:font-medium [&_h5]:mt-3 [&_h5]:mb-1 [&_h6]:text-sm [&_h6]:font-medium [&_h6]:mt-2 [&_h6]:mb-1 [&_img]:mx-auto [&_img]:max-w-full [&_blockquote]:border-l-4 [&_blockquote]:border-primary/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground',
      },
    },
  });

  const handleImageUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `news/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('thumbnails').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(path);
      return publicUrl;
    } catch (err) {
      toast.error('Error al subir imagen');
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const openImageDialog = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await handleImageUpload(file);
      if (url) {
        setEditingImageSrc(url);
        setEditingImageAlt('');
        setEditingImageWidth('100');
        setEditingImageAlign('center');
        setImageDialog(true);
      }
    };
    input.click();
  }, [handleImageUpload]);

  const insertImage = useCallback(() => {
    if (!editingImageSrc || !editor) return;
    const widthPct = parseInt(editingImageWidth) || 100;
    const style = `width: ${widthPct}%; ${editingImageAlign === 'left' ? 'margin-right: auto;' : editingImageAlign === 'right' ? 'margin-left: auto;' : 'margin: 0 auto;'} display: block;`;
    editor.chain().focus().setImage({ 
      src: editingImageSrc, 
      alt: editingImageAlt,
      title: editingImageAlt,
    }).run();
    // Apply styles via the last inserted node
    const { state } = editor;
    const pos = state.selection.from;
    // We'll use the HTML attribute approach through the style
    editor.commands.updateAttributes('image', {
      style,
      width: `${widthPct}%`,
    });
    setImageDialog(false);
  }, [editor, editingImageSrc, editingImageAlt, editingImageWidth, editingImageAlign]);

  const openVideoDialog = useCallback(() => {
    setVideoUrl('');
    setVideoWidth('640');
    setVideoHeight('360');
    setVideoDialog(true);
  }, []);

  const insertVideo = useCallback(() => {
    if (!videoUrl || !editor) return;
    editor.commands.setYoutubeVideo({ 
      src: videoUrl, 
      width: parseInt(videoWidth) || 640, 
      height: parseInt(videoHeight) || 360 
    });
    setVideoDialog(false);
  }, [editor, videoUrl, videoWidth, videoHeight]);

  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    setLinkText(selectedText);
    setLinkUrl(editor.getAttributes('link').href || '');
    setLinkDialog(true);
  }, [editor]);

  const insertLink = useCallback(() => {
    if (!linkUrl || !editor) return;
    if (linkText && editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${linkUrl}">${linkText}</a>`).run();
    } else {
      editor.chain().focus().setLink({ href: linkUrl }).run();
    }
    setLinkDialog(false);
  }, [editor, linkUrl, linkText]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
    setLinkDialog(false);
  }, [editor]);

  const handleCoverUpload = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await handleImageUpload(file);
      if (url) setImageUrl(url);
    };
    input.click();
  }, [handleImageUpload]);

  const handleSave = async (publish: boolean) => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return; }
    if (!editor) return;

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated');

      const slug = initialData?.id ? (initialData.slug || generateSlug(title)) : generateSlug(title);
      const payload: any = {
        title: title.trim(),
        summary: summary.trim() || null,
        content: editor.getHTML(),
        image_url: imageUrl || null,
        category,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        slug,
        author_bio: authorBio.trim() || null,
        author_social: authorSocial,
      };

      if (initialData?.id) {
        payload.last_edited_at = new Date().toISOString();
        payload.last_edited_by = user.id;
        const { error } = await supabase.from('medical_news').update(payload).eq('id', initialData.id);
        if (error) throw error;
        toast.success(publish ? 'Noticia actualizada y publicada' : 'Borrador actualizado');
      } else {
        payload.created_by = user.id;
        const { error } = await supabase.from('medical_news').insert(payload);
        if (error) throw error;
        toast.success(publish ? 'Noticia publicada' : 'Borrador creado');
      }
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!editor) return null;

  const ToolbarButton = ({ active, onClick, children, disabled, title: btnTitle }: { active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) => (
    <Button 
      variant="ghost" 
      size="icon" 
      className={`h-8 w-8 ${active ? 'bg-primary/10 text-primary' : ''}`} 
      onClick={onClick} 
      disabled={disabled}
      title={btnTitle}
    >
      {children}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label>Título</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la noticia" className="text-lg font-semibold" />
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <Label>Resumen (opcional)</Label>
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Breve resumen de la noticia" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NEWS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Imagen de portada</Label>
          <div className="flex gap-2">
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL o sube una imagen" className="flex-1" />
            <Button variant="outline" size="icon" onClick={handleCoverUpload} disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {imageUrl && (
        <div className="relative aspect-video max-h-48 rounded-lg overflow-hidden border">
          <img src={imageUrl} alt="Portada" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Author Info Section */}
      <Separator />
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Información del autor</h3>
        <div className="space-y-2">
          <Label>Bio del autor (aparece al final del artículo)</Label>
          <Textarea value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} placeholder="Ej: Cardiólogo con 15 años de experiencia..." rows={2} maxLength={500} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Sitio web</Label>
            <Input value={authorSocial.website || ''} onChange={(e) => setAuthorSocial(prev => ({ ...prev, website: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Twitter / X</Label>
            <Input value={authorSocial.twitter || ''} onChange={(e) => setAuthorSocial(prev => ({ ...prev, twitter: e.target.value }))} placeholder="@usuario" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">LinkedIn</Label>
            <Input value={authorSocial.linkedin || ''} onChange={(e) => setAuthorSocial(prev => ({ ...prev, linkedin: e.target.value }))} placeholder="URL de LinkedIn" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Instagram</Label>
            <Input value={authorSocial.instagram || ''} onChange={(e) => setAuthorSocial(prev => ({ ...prev, instagram: e.target.value }))} placeholder="@usuario" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex flex-wrap gap-0.5 p-2 bg-muted/50 border-b">
          {/* Headings */}
          <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="H3">
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 4 })} onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} title="H4">
            <Heading4 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 5 })} onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} title="H5">
            <Heading5 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('heading', { level: 6 })} onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} title="H6">
            <Heading6 className="w-4 h-4" />
          </ToolbarButton>
          <Separator orientation="vertical" className="h-8 mx-1" />

          {/* Text formatting */}
          <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita">
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva">
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado">
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado">
            <Strikethrough className="w-4 h-4" />
          </ToolbarButton>
          <Separator orientation="vertical" className="h-8 mx-1" />

          {/* Alignment */}
          <ToolbarButton active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Alinear izquierda">
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centrar">
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Alinear derecha">
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justificar">
            <AlignJustify className="w-4 h-4" />
          </ToolbarButton>
          <Separator orientation="vertical" className="h-8 mx-1" />

          {/* Lists and blocks */}
          <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Lista">
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Lista numerada">
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita">
            <Quote className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código">
            <Code className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea separadora">
            <Minus className="w-4 h-4" />
          </ToolbarButton>
          <Separator orientation="vertical" className="h-8 mx-1" />

          {/* Media */}
          <ToolbarButton onClick={openImageDialog} disabled={isUploading} title="Insertar imagen">
            <ImageIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={openVideoDialog} title="Insertar video de YouTube">
            <YoutubeIcon className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={openLinkDialog} active={editor.isActive('link')} title="Insertar enlace">
            <LinkIcon className="w-4 h-4" />
          </ToolbarButton>
          <Separator orientation="vertical" className="h-8 mx-1" />

          {/* History */}
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Deshacer">
            <Undo className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Rehacer">
            <Redo className="w-4 h-4" />
          </ToolbarButton>
        </div>

        <EditorContent editor={editor} />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar borrador
        </Button>
        <Button onClick={() => handleSave(true)} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
          Publicar
        </Button>
      </div>

      {/* Image Dialog */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar imagen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editingImageSrc && (
              <div className="border rounded-lg overflow-hidden max-h-48">
                <img src={editingImageSrc} alt="Preview" className="w-full h-full object-contain" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Descripción (alt text)</Label>
              <Input value={editingImageAlt} onChange={(e) => setEditingImageAlt(e.target.value)} placeholder="Descripción de la imagen..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ancho (%)</Label>
                <Select value={editingImageWidth} onValueChange={setEditingImageWidth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25%</SelectItem>
                    <SelectItem value="33">33%</SelectItem>
                    <SelectItem value="50">50%</SelectItem>
                    <SelectItem value="75">75%</SelectItem>
                    <SelectItem value="100">100%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Alineación</Label>
                <Select value={editingImageAlign} onValueChange={(v) => setEditingImageAlign(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Izquierda</SelectItem>
                    <SelectItem value="center">Centro</SelectItem>
                    <SelectItem value="right">Derecha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageDialog(false)}>Cancelar</Button>
            <Button onClick={insertImage}>Insertar imagen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Dialog */}
      <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insertar video de YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL de YouTube</Label>
              <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ancho (px)</Label>
                <Input type="number" value={videoWidth} onChange={(e) => setVideoWidth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Alto (px)</Label>
                <Input type="number" value={videoHeight} onChange={(e) => setVideoHeight(e.target.value)} />
              </div>
            </div>
            {videoUrl && (
              <p className="text-xs text-muted-foreground">
                El video se incrustará directamente en el artículo. Asegúrate de que la URL sea válida.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDialog(false)}>Cancelar</Button>
            <Button onClick={insertVideo} disabled={!videoUrl}>Insertar video</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialog} onOpenChange={setLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insertar enlace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
            </div>
            {editor?.state.selection.empty && (
              <div className="space-y-2">
                <Label>Texto del enlace</Label>
                <Input value={linkText} onChange={(e) => setLinkText(e.target.value)} placeholder="Texto visible..." />
              </div>
            )}
          </div>
          <DialogFooter>
            {editor?.isActive('link') && (
              <Button variant="destructive" onClick={removeLink}>Quitar enlace</Button>
            )}
            <Button variant="outline" onClick={() => setLinkDialog(false)}>Cancelar</Button>
            <Button onClick={insertLink} disabled={!linkUrl}>Aplicar enlace</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
