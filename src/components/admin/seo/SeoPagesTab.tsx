import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Pencil, Plus, Search } from 'lucide-react';
import {
  PUBLIC_PAGES, isPrivatePath, matchRoute, normalizePath, resolveSeo, seoWarnings,
  type ResolvedSeo, type SeoConfig, type SeoFields,
} from '@/lib/seo';
import { SeoEditorDialog } from './SeoEditorDialog';
import { SEO_CARD } from './SeoGeneralTab';

type Filter = 'all' | 'visible' | 'hidden' | 'custom';

interface Props {
  config: SeoConfig;
  saving: boolean;
  saveFields: (path: string, fields: SeoFields | null) => Promise<boolean>;
}

export function SeoStatusBadges({ r, warnings }: { r: ResolvedSeo; warnings: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {r.index ? (
        <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15 text-[10px]">Visible en Google</Badge>
      ) : (
        <Badge variant="outline" className="text-secondary/70 border-secondary/25 text-[10px]">Oculta a Google</Badge>
      )}
      {r.customized && <Badge className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/10 text-[10px]">Personalizada</Badge>}
      {warnings > 0 && (
        <Badge variant="outline" className="border-warning/40 text-warning text-[10px] gap-1">
          <AlertTriangle className="w-3 h-3" />{warnings}
        </Badge>
      )}
    </div>
  );
}

export function SeoPagesTab({ config, saving, saveFields }: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<{ path: string; heading: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [newPath, setNewPath] = useState('');
  const [newPathError, setNewPathError] = useState('');

  const rows = useMemo(() => {
    const pages = PUBLIC_PAGES.map((p) => ({ path: p.path, label: p.label, group: p.group }));
    const custom = Object.keys(config.pages)
      .filter((path) => matchRoute(path).kind === 'unknown')
      .map((path) => ({ path, label: 'URL personalizada', group: 'Otras URLs personalizadas' }));
    return [...pages, ...custom].map((row) => {
      const r = resolveSeo(config, row.path);
      return { ...row, r, warnings: seoWarnings(r, config) };
    });
  }, [config]);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (q && !`${row.label} ${row.path} ${row.r.title}`.toLowerCase().includes(q)) return false;
    if (filter === 'visible') return row.r.index;
    if (filter === 'hidden') return !row.r.index;
    if (filter === 'custom') return row.r.customized;
    return true;
  });
  const groups = [...new Set(visible.map((row) => row.group))];

  const confirmNewPath = () => {
    const raw = newPath.trim();
    if (!raw.startsWith('/')) return setNewPathError('La URL tiene que empezar por «/», por ejemplo /especialidades/cardiologia');
    const path = normalizePath(raw);
    if (/\.[a-z0-9]{1,8}$/i.test(path)) return setNewPathError('Eso es un archivo, no una página.');
    if (isPrivatePath(path)) return setNewPathError('Es zona privada de la plataforma: nunca se muestra a Google.');
    const kind = matchRoute(path).kind;
    if (kind === 'entity') return setNewPathError('Las fichas de médicos, lives, grabaciones, noticias y congresos se editan en «Contenido de usuarios».');
    if (kind === 'alias') return setNewPathError('Esa URL solo redirige a otra página: edita la página de destino.');
    setAdding(false);
    setNewPath('');
    setNewPathError('');
    const page = PUBLIC_PAGES.find((p) => p.path === path);
    setEditing({ path, heading: page ? page.label : 'URL personalizada' });
  };

  return (
    <div className="space-y-4">
      <Card className={SEO_CARD}>
        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-secondary/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar página, URL o título…" className="pl-9 text-sm" />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="sm:w-[190px] text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="visible">Visibles en Google</SelectItem>
              <SelectItem value="hidden">Ocultas a Google</SelectItem>
              <SelectItem value="custom">Personalizadas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Otra URL</Button>
        </CardContent>
      </Card>

      {groups.length === 0 && (
        <Card className={SEO_CARD}><CardContent className="p-6 text-center text-sm text-secondary/70">Ninguna página coincide con la búsqueda.</CardContent></Card>
      )}

      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <h3 className="font-heading text-sm font-semibold text-white">{group}</h3>
          <div className="grid gap-2">
            {visible.filter((row) => row.group === group).map((row) => (
              <Card key={row.path} className={SEO_CARD}>
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="font-semibold text-sm text-secondary">{row.label}</p>
                      <p className="font-mono text-[11px] text-secondary/60 break-all">{row.path}</p>
                    </div>
                    <p className="text-xs text-secondary/80 truncate">{row.r.title}</p>
                    <SeoStatusBadges r={row.r} warnings={row.warnings.length} />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ path: row.path, heading: row.label })} className="gap-1.5 self-start sm:self-center">
                    <Pencil className="w-3.5 h-3.5" />Editar SEO
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={adding} onOpenChange={(open) => { setAdding(open); if (!open) setNewPathError(''); }}>
        <DialogContent className="bg-white max-w-md w-[calc(100vw-2rem)]">
          <DialogHeader className="text-left">
            <DialogTitle className="text-secondary">Personalizar otra URL</DialogTitle>
            <DialogDescription className="text-secondary/70">Para cualquier página pública que no esté en la lista.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="seo-new-path" className="text-xs text-secondary">Ruta de la página</Label>
            <Input id="seo-new-path" value={newPath} onChange={(e) => { setNewPath(e.target.value); setNewPathError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') confirmNewPath(); }} placeholder="/especialidades/cardiologia" className="text-sm font-mono" />
            {newPathError && <p className="text-xs text-destructive">{newPathError}</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button onClick={confirmNewPath}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <SeoEditorDialog
          open={!!editing}
          onOpenChange={(open) => { if (!open) setEditing(null); }}
          config={config}
          path={editing.path}
          heading={editing.heading}
          saving={saving}
          onSave={(fields) => saveFields(editing.path, fields)}
        />
      )}
    </div>
  );
}
