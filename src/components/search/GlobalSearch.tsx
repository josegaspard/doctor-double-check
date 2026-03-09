import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Search, Stethoscope, PlayCircle, Video, X, Loader2, Folder, ArrowRight } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface SearchResult {
  id: string;
  type: 'doctor' | 'recording' | 'live' | 'content';
  title: string;
  subtitle?: string;
  specialty?: string;
  avatarUrl?: string;
  thumbnailUrl?: string;
}

const QUICK_ACCESS = [
  { key: 'doctors', icon: Stethoscope, href: '/doctors', labelKey: 'nav.doctors' },
  { key: 'recordings', icon: PlayCircle, href: '/recordings', labelKey: 'nav.recordings' },
  { key: 'lives', icon: Video, href: '/lives', labelKey: 'nav.lives' },
  { key: 'content', icon: Folder, href: '/content', labelKey: 'search.content' },
] as const;

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 200);

  // Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 1) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const searchResults: SearchResult[] = [];
        const searchTerm = debouncedQuery.toLowerCase();

        // Parallel searches
        const [doctorsRes, recordingsRes, livesRes, contentRes] = await Promise.all([
          supabase.rpc('search_doctors_public', { p_term: searchTerm, p_limit: 6 }),
          supabase.from('recordings').select('id, title, specialty, thumbnail_url').or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`).limit(3),
          supabase.from('lives').select('id, title, specialty, status, thumbnail_url').eq('status', 'live').or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`).limit(3),
          supabase.from('doctor_content').select('id, title, type, thumbnail_url').ilike('title', `%${searchTerm}%`).eq('is_public', true).limit(3),
        ]);

        if (doctorsRes.data) {
          for (const doc of doctorsRes.data) {
            searchResults.push({
              id: doc.user_id,
              type: 'doctor',
              title: doc.name || 'Doctor',
              subtitle: doc.specialty,
              specialty: doc.specialty,
              avatarUrl: doc.avatar_url || undefined,
            });
          }
        }

        if (recordingsRes.data) {
          for (const rec of recordingsRes.data) {
            searchResults.push({ id: rec.id, type: 'recording', title: rec.title, subtitle: rec.specialty, thumbnailUrl: rec.thumbnail_url || undefined });
          }
        }

        if (livesRes.data) {
          for (const live of livesRes.data) {
            searchResults.push({ id: live.id, type: 'live', title: live.title, subtitle: live.specialty, thumbnailUrl: live.thumbnail_url || undefined });
          }
        }

        if (contentRes.data) {
          for (const c of contentRes.data) {
            searchResults.push({ id: c.id, type: 'content', title: c.title, subtitle: String(c.type), thumbnailUrl: c.thumbnail_url || undefined });
          }
        }

        setResults(searchResults);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false);
    switch (result.type) {
      case 'doctor': navigate(`/doctor/${result.id}`); break;
      case 'recording': navigate(`/recording/${result.id}`); break;
      case 'live': navigate(`/live/${result.id}`); break;
      case 'content': navigate(`/content`); break;
    }
  }, [navigate]);

  const handleQuickAccess = useCallback((href: string) => {
    setOpen(false);
    navigate(href);
  }, [navigate]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'doctor': return <Stethoscope className="w-4 h-4 text-primary" />;
      case 'recording': return <PlayCircle className="w-4 h-4 text-accent-foreground" />;
      case 'live': return <Video className="w-4 h-4 text-destructive" />;
      case 'content': return <Folder className="w-4 h-4 text-muted-foreground" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getGroupLabel = (type: string) => {
    switch (type) {
      case 'doctor': return t('nav.doctors');
      case 'recording': return t('nav.recordings');
      case 'live': return t('nav.lives');
      case 'content': return t('search.content');
      default: return type;
    }
  };

  const groupedResults = ['doctor', 'recording', 'live', 'content']
    .map(type => ({ type, items: results.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0);

  return (
    <>
      {/* Trigger: Desktop = search bar, Mobile = icon */}
      {isMobile ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(true)}>
          <Search className="w-4 h-4" />
        </Button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-xs min-w-[180px] lg:min-w-[220px]"
        >
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">{t('search.placeholder')}</span>
          <kbd className="ml-auto hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      )}

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideClose
          className={
            isMobile
              ? 'fixed inset-0 max-w-none w-full h-full translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-0 flex flex-col'
              : 'max-w-lg p-0 gap-0 overflow-hidden'
          }
        >
          <VisuallyHidden>
            <DialogTitle>{t('common.search')}</DialogTitle>
          </VisuallyHidden>

          {/* Search Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 rounded-full hover:bg-muted">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            {isMobile && (
              <button onClick={() => setOpen(false)} className="text-xs font-medium text-primary ml-1">
                {t('common.cancel')}
              </button>
            )}
          </div>

          {/* Results area */}
          <div className={`overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-[60vh]'}`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : query.length < 1 ? (
              /* Quick Access — shown before typing */
              <div className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {t('search.quickAccess')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACCESS.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => handleQuickAccess(item.href)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t(item.labelKey)}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="py-12 text-center">
                <Search className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
              </div>
            ) : (
              <div className="py-2">
                {groupedResults.map(({ type, items }) => (
                  <div key={type}>
                    <p className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {getGroupLabel(type)}
                    </p>
                    {items.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors text-left"
                      >
                        {result.type === 'doctor' ? (
                          <Avatar className="h-9 w-9 ring-1 ring-border">
                            <AvatarImage src={result.avatarUrl} alt={result.title} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {result.title.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        ) : result.thumbnailUrl ? (
                          <div className="h-9 w-14 rounded-md overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
                            <img src={result.thumbnailUrl} alt={result.title} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                            {getIcon(result.type)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{result.title}</p>
                          {result.subtitle && (
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                          )}
                        </div>
                        {result.type === 'live' && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            LIVE
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
