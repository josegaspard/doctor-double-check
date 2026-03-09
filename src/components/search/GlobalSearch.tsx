import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Search, Stethoscope, PlayCircle, Video, X, Loader2, Folder, ArrowRight, TrendingUp, Sparkles } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  id: string;
  type: 'doctor' | 'recording' | 'live' | 'content';
  title: string;
  subtitle?: string;
  specialty?: string;
  avatarUrl?: string;
  thumbnailUrl?: string;
}

const CATEGORY_FILTERS = ['all', 'doctor', 'recording', 'live', 'content'] as const;
type CategoryFilter = typeof CATEGORY_FILTERS[number];

const QUICK_ACCESS = [
  { key: 'doctors', icon: Stethoscope, href: '/doctors', labelKey: 'nav.doctors', color: 'text-primary', bg: 'bg-primary/10' },
  { key: 'recordings', icon: PlayCircle, href: '/recordings', labelKey: 'nav.recordings', color: 'text-accent-foreground', bg: 'bg-accent/50' },
  { key: 'lives', icon: Video, href: '/lives', labelKey: 'nav.lives', color: 'text-destructive', bg: 'bg-destructive/10' },
  { key: 'content', icon: Folder, href: '/content', labelKey: 'search.content', color: 'text-muted-foreground', bg: 'bg-muted' },
] as const;

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 1) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-primary font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
      setActiveIndex(-1);
      setCategoryFilter('all');
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

        const [doctorsRes, recordingsRes, livesRes, contentRes] = await Promise.all([
          supabase.rpc('search_doctors_public', { p_term: searchTerm, p_limit: 6 }),
          supabase.from('recordings').select('id, title, specialty, thumbnail_url').or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`).limit(3),
          supabase.from('lives').select('id, title, specialty, status, thumbnail_url').eq('status', 'live').or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`).limit(3),
          supabase.from('doctor_content').select('id, title, type, thumbnail_url').ilike('title', `%${searchTerm}%`).eq('is_public', true).limit(3),
        ]);

        if (doctorsRes.data) {
          for (const doc of doctorsRes.data) {
            searchResults.push({
              id: doc.user_id, type: 'doctor', title: doc.name || 'Doctor',
              subtitle: doc.specialty, specialty: doc.specialty, avatarUrl: doc.avatar_url || undefined,
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
        setActiveIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    search();
  }, [debouncedQuery]);

  const filteredResults = useMemo(() => {
    if (categoryFilter === 'all') return results;
    return results.filter(r => r.type === categoryFilter);
  }, [results, categoryFilter]);

  const flatResults = filteredResults;

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

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < flatResults.length) {
      e.preventDefault();
      handleSelect(flatResults[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }, [activeIndex, flatResults, handleSelect]);

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-search-item]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

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

  const getCategoryLabel = (cat: CategoryFilter) => {
    if (cat === 'all') return t('common.all') || 'All';
    return getGroupLabel(cat);
  };

  const groupedResults = useMemo(() => {
    return ['doctor', 'recording', 'live', 'content']
      .map(type => ({ type, items: filteredResults.filter(r => r.type === type) }))
      .filter(g => g.items.length > 0);
  }, [filteredResults]);

  // Flatten for indexing
  let globalIdx = 0;

  return (
    <>
      {/* Trigger: Mobile icon */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground md:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4" />
      </Button>
      
      {/* Trigger: Tablet icon (md-lg) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:flex xl:hidden h-8 w-8 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4" />
      </Button>
      
      {/* Trigger: Desktop search bar (xl+) */}
      <button
        onClick={() => setOpen(true)}
        className="hidden xl:flex items-center gap-2 h-8 px-3 rounded-lg border border-input bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-[11px] min-w-[120px] 2xl:min-w-[160px]"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{t('search.placeholder')}</span>
        <kbd className="ml-auto hidden 2xl:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          hideClose
          className={
            isMobile
              ? 'fixed inset-0 max-w-none w-full h-full translate-x-0 translate-y-0 top-0 left-0 rounded-none border-0 p-0 flex flex-col'
              : 'max-w-lg p-0 gap-0 overflow-hidden rounded-xl shadow-2xl border-border/50'
          }
        >
          <VisuallyHidden>
            <DialogTitle>{t('common.search')}</DialogTitle>
          </VisuallyHidden>

          {/* Search Input Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30" style={isMobile ? { paddingTop: 'max(12px, env(safe-area-inset-top))' } : undefined}>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Search className="w-4 h-4 text-primary" />
            </div>
            <input
              ref={inputRef}
              type="text"
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
              autoComplete="off"
            />
            {query && (
              <button onClick={() => { setQuery(''); setActiveIndex(-1); }} className="p-1 rounded-full hover:bg-muted transition-colors">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
            {isMobile ? (
              <button onClick={() => setOpen(false)} className="text-xs font-medium text-primary ml-1">
                {t('common.cancel')}
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ESC
              </kbd>
            )}
          </div>

          {/* Category Filter Chips — only when there are results */}
          {results.length > 0 && query.length >= 1 && (
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto scrollbar-hide">
              {CATEGORY_FILTERS.map((cat) => {
                const count = cat === 'all' ? results.length : results.filter(r => r.type === cat).length;
                if (cat !== 'all' && count === 0) return null;
                const isActive = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setActiveIndex(-1); }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {getCategoryLabel(cat)}
                    <span className={`text-[10px] ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Results area */}
          <div ref={listRef} className={`overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-[55vh]'}`}>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-16 gap-3"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground">{t('common.loading')}...</p>
                </motion.div>
              ) : query.length < 1 ? (
                /* Quick Access — shown before typing */
                <motion.div key="quick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('search.quickAccess')}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {QUICK_ACCESS.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => handleQuickAccess(item.href)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted transition-all text-left group hover:shadow-sm active:scale-[0.98]"
                      >
                        <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0`}>
                          <item.icon className={`w-4 h-4 ${item.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{t(item.labelKey)}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>

                  {/* Tip */}
                  <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                    <TrendingUp className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      {t('search.tip') || 'Search doctors, recordings, live streams, and content'}
                    </p>
                  </div>
                </motion.div>
              ) : flatResults.length === 0 ? (
                <motion.div key="empty" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
                    <Search className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.noResults')}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{t('search.tryDifferent') || 'Try a different search term'}</p>
                </motion.div>
              ) : (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-1">
                  {groupedResults.map(({ type, items }) => (
                    <div key={type}>
                      <p className="px-4 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        {getIcon(type)}
                        {getGroupLabel(type)}
                        <span className="text-muted-foreground/50">({items.length})</span>
                      </p>
                      {items.map((result) => {
                        const idx = globalIdx++;
                        const isActive = idx === activeIndex;
                        return (
                          <button
                            key={`${result.type}-${result.id}`}
                            data-search-item
                            onClick={() => handleSelect(result)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                              isActive ? 'bg-primary/8 border-l-2 border-primary' : 'hover:bg-muted/60 border-l-2 border-transparent'
                            }`}
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
                              <p className="font-medium text-sm text-foreground truncate">
                                <HighlightMatch text={result.title} query={query} />
                              </p>
                              {result.subtitle && (
                                <p className="text-xs text-muted-foreground truncate">
                                  <HighlightMatch text={result.subtitle} query={query} />
                                </p>
                              )}
                            </div>
                            {result.type === 'live' && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 animate-pulse">
                                LIVE
                              </Badge>
                            )}
                            <ArrowRight className={`w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {/* Reset global index for next render */}
                  {(() => { globalIdx = 0; return null; })()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer hint */}
          {!isMobile && (
            <div className="flex items-center gap-3 px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-border bg-background font-mono">↑↓</kbd>
                {t('search.navigate') || 'navigate'}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-border bg-background font-mono">↵</kbd>
                {t('search.select') || 'select'}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded border border-border bg-background font-mono">esc</kbd>
                {t('search.close') || 'close'}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
