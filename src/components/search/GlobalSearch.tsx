import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface SearchResult {
  id: string;
  type: 'doctor' | 'recording' | 'live';
  title: string;
  subtitle?: string;
  specialty?: string;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

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
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      setIsLoading(true);
      try {
        const searchResults: SearchResult[] = [];

        // Search doctors
        const { data: doctors } = await supabase
          .from('doctor_profiles')
          .select('user_id, specialty, status')
          .eq('status', 'approved')
          .ilike('specialty', `%${debouncedQuery}%`)
          .limit(3);

        if (doctors) {
          for (const doc of doctors) {
            const { data: profile } = await supabase
              .from('profiles_public')
              .select('id, name')
              .eq('id', doc.user_id)
              .single();

            if (profile) {
              searchResults.push({
                id: doc.user_id,
                type: 'doctor',
                title: profile.name || 'Doctor',
                subtitle: doc.specialty,
                specialty: doc.specialty,
              });
            }
          }
        }

        // Search by doctor name
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name')
          .ilike('name', `%${debouncedQuery}%`)
          .limit(5);

        if (profiles) {
          for (const profile of profiles) {
            const { data: docProfile } = await supabase
              .from('doctor_profiles')
              .select('specialty, status')
              .eq('user_id', profile.id)
              .eq('status', 'approved')
              .single();

            if (docProfile && !searchResults.find(r => r.id === profile.id)) {
              searchResults.push({
                id: profile.id,
                type: 'doctor',
                title: profile.name || 'Doctor',
                subtitle: docProfile.specialty,
                specialty: docProfile.specialty,
              });
            }
          }
        }

        // Search recordings
        const { data: recordings } = await supabase
          .from('recordings')
          .select('id, title, specialty')
          .or(`title.ilike.%${debouncedQuery}%,specialty.ilike.%${debouncedQuery}%`)
          .limit(3);

        if (recordings) {
          recordings.forEach(rec => {
            searchResults.push({
              id: rec.id,
              type: 'recording',
              title: rec.title,
              subtitle: rec.specialty,
              specialty: rec.specialty,
            });
          });
        }

        // Search lives
        const { data: lives } = await supabase
          .from('lives')
          .select('id, title, specialty, status')
          .eq('status', 'live')
          .or(`title.ilike.%${debouncedQuery}%,specialty.ilike.%${debouncedQuery}%`)
          .limit(3);

        if (lives) {
          lives.forEach(live => {
            searchResults.push({
              id: live.id,
              type: 'live',
              title: live.title,
              subtitle: live.specialty,
              specialty: live.specialty,
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
        return <Stethoscope className="w-4 h-4 text-blue-500" />;
      case 'recording':
        return <PlayCircle className="w-4 h-4 text-purple-500" />;
      case 'live':
        return <Video className="w-4 h-4 text-red-500" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-[200px] justify-start text-muted-foreground hidden md:flex"
        >
          <Search className="w-4 h-4 mr-2" />
          <span>Buscar...</span>
          <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="w-4 h-4 mr-2 shrink-0 opacity-50" />
            <Input
              ref={inputRef}
              placeholder="Buscar doctores, grabaciones, lives..."
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
          <CommandList>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : query.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Escribe al menos 2 caracteres para buscar
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>No se encontraron resultados</CommandEmpty>
            ) : (
              <>
                {['doctor', 'recording', 'live'].map(type => {
                  const typeResults = results.filter(r => r.type === type);
                  if (typeResults.length === 0) return null;
                  
                  return (
                    <CommandGroup 
                      key={type} 
                      heading={type === 'doctor' ? 'Doctores' : type === 'recording' ? 'Grabaciones' : 'En Vivo'}
                    >
                      {typeResults.map(result => (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          {getIcon(result.type)}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {result.type === 'live' && (
                            <Badge variant="destructive" className="text-xs">EN VIVO</Badge>
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
