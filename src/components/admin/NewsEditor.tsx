import React, { useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Undo, Redo,
  Image as ImageIcon, Youtube as YoutubeIcon, Link as LinkIcon,
  Heading1, Heading2, Heading3, Save, Eye, Loader2, Upload
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

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, allowBase64: false }),
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
      Placeholder.configure({ placeholder: 'Escribe el contenido de la noticia aquí...' }),
    ],
    content: initialData?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] px-4 py-3 dark:prose-invert',
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

  const addImage = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await handleImageUpload(file);
      if (url && editor) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  }, [editor, handleImageUpload]);

  const addYoutube = useCallback(() => {
    const url = window.prompt('URL de YouTube:');
    if (url && editor) {
      editor.commands.setYoutubeVideo({ src: url });
    }
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt('URL del enlace:');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
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
      const payload = {
        title: title.trim(),
        summary: summary.trim() || null,
        content: editor.getHTML(),
        image_url: imageUrl || null,
        category,
        is_published: publish,
        published_at: publish ? new Date().toISOString() : null,
        slug,
        created_by: user.id,
      };

      if (initialData?.id) {
        const { error } = await supabase.from('medical_news').update(payload).eq('id', initialData.id);
        if (error) throw error;
        toast.success(publish ? 'Noticia publicada' : 'Borrador guardado');
      } else {
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

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label>Título</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título de la noticia"
          className="text-lg font-semibold"
        />
      </div>

      {/* Summary */}
      <div className="space-y-2">
        <Label>Resumen (opcional)</Label>
        <Input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Breve resumen de la noticia"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Category */}
        <div className="space-y-2">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NEWS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Cover Image */}
        <div className="space-y-2">
          <Label>Imagen de portada</Label>
          <div className="flex gap-2">
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="URL o sube una imagen"
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={handleCoverUpload} disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Cover Preview */}
      {imageUrl && (
        <div className="relative aspect-video max-h-48 rounded-lg overflow-hidden border">
          <img src={imageUrl} alt="Portada" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Toolbar */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex flex-wrap gap-0.5 p-2 bg-muted/50 border-b">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} data-active={editor.isActive('heading', { level: 1 })}>
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()} data-active={editor.isActive('bold')}>
            <Bold className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <Italic className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <UnderlineIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <Strikethrough className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addImage} disabled={isUploading}>
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addYoutube}>
            <YoutubeIcon className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addLink}>
            <LinkIcon className="w-4 h-4" />
          </Button>
          <Separator orientation="vertical" className="h-8 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().undo().run()}>
            <Undo className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().redo().run()}>
            <Redo className="w-4 h-4" />
          </Button>
        </div>

        {/* Editor Content */}
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
    </div>
  );
}
