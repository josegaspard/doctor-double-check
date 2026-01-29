import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Stethoscope, PlayCircle, Video, X, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchResult {
  id: string;
  type: 'doctor' | 'recording' | 'live';
  title: string;
  subtitle?: string;
  specialty?: string;
  avatarUrl?: string;
  thumbnailUrl?: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  // supabaseUser removed – always use public views for discovery
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search immediately on each character (reduced debounce for instant feel)
  const debouncedQuery = useDebounce(query, 150);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

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

        // Use secure RPC function for doctor search (works for anon & authenticated)
        const { data: doctors, error: rpcError } = await supabase.rpc(
          'search_doctors_public',
          { p_term: searchTerm, p_limit: 8 }
        );

        if (rpcError) {
          console.error('search_doctors_public error:', rpcError);
        }

        if (doctors && doctors.length > 0) {
          for (const doc of doctors) {
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

        // Search recordings
        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, title, specialty, thumbnail_url')
          .or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`)
          .limit(3);

        if (recordings) {
          recordings.forEach(rec => {
            searchResults.push({
              id: rec.id,
              type: 'recording',
              title: rec.title,
              subtitle: rec.specialty,
              specialty: rec.specialty,
              thumbnailUrl: rec.thumbnail_url || undefined,
            });
          });
        }

        // Search lives
        const { data: lives } = await supabase
          .from('lives')
          .select('id, title, specialty, status, thumbnail_url')
          .eq('status', 'live')
          .or(`title.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%`)
          .limit(3);

        if (lives) {
          lives.forEach(live => {
            searchResults.push({
              id: live.id,
              type: 'live',
              title: live.title,
              subtitle: live.specialty,
              specialty: live.specialty,
              thumbnailUrl: live.thumbnail_url || undefined,
            });
          });
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

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'doctor':
        navigate(`/doctor/${result.id}`);
        break;
      case 'recording':
        navigate(`/recording/${result.id}`);
        break;
      case 'live':
        navigate(`/live/${result.id}`);
        break;
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'doctor':
        return <Stethoscope className="w-4 h-4 text-secondary" />;
      case 'recording':
        return <PlayCircle className="w-4 h-4 text-accent" />;
      case 'live':
        return <Video className="w-4 h-4 text-live" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  const getGroupHeading = (type: string) => {
    switch (type) {
      case 'doctor':
        return t('admin.doctors');
      case 'recording':
        return t('nav.recordings');
      case 'live':
        return t('lives.live');
      default:
        return type;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-[200px] justify-start text-muted-foreground"
        >
          <Search className="w-4 h-4 mr-2" />
          <span>{t('common.search')}...</span>
          <kbd className="pointer-events-none ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="w-4 h-4 mr-2 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              placeholder={`${t('common.search')} ${t('admin.doctors').toLowerCase()}, ${t('nav.recordings').toLowerCase()}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setQuery('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
          <CommandList className="max-h-[60vh] sm:max-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : query.length < 1 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {t('common.search')}...
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>{t('common.noResults')}</CommandEmpty>
            ) : (
              <>
                {['doctor', 'recording', 'live'].map(type => {
                  const typeResults = results.filter(r => r.type === type);
                  if (typeResults.length === 0) return null;
                  
                    return (
                      <CommandGroup 
                        key={type} 
                        heading={getGroupHeading(type)}
                        className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-secondary"
                      >
                        {typeResults.map(result => (
                          <CommandItem
                            key={`${result.type}-${result.id}`}
                            onSelect={() => handleSelect(result)}
                            className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg mx-1 aria-selected:bg-secondary/10 aria-selected:text-foreground hover:bg-muted"
                          >
                            {result.type === 'doctor' ? (
                              <Avatar className="h-9 w-9 ring-2 ring-secondary/20">
                                <AvatarImage src={result.avatarUrl} alt={result.title} />
                                <AvatarFallback className="bg-secondary/10 text-secondary text-sm font-semibold">
                                  {result.title.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : result.thumbnailUrl ? (
                              <div className="h-9 w-14 rounded-md overflow-hidden bg-muted flex-shrink-0 ring-1 ring-border">
                                <img 
                                  src={result.thumbnailUrl} 
                                  alt={result.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                {getIcon(result.type)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-sm text-foreground">{result.title}</p>
                              {result.subtitle && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                                    {result.subtitle}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            {result.type === 'live' && (
                              <Badge variant="live" className="text-[10px] px-2">
                                {t('lives.live')}
                              </Badge>
                            )}
                            {result.type === 'doctor' && (
                              <Stethoscope className="w-4 h-4 text-secondary/50" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
