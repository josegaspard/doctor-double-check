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

        // Search by doctor name first (most common search)
        const { data: profiles } = await supabase
          .from('profiles_public')
          .select('id, name, avatar_url')
          .ilike('name', `%${searchTerm}%`)
          .limit(5);

        if (profiles) {
          // Get doctor profiles for matched profiles
          const userIds = profiles.map(p => p.id);
          const { data: doctorProfiles } = await supabase
            .from('doctor_profiles')
            .select('user_id, specialty, status')
            .in('user_id', userIds)
            .eq('status', 'approved');

          const doctorMap = new Map(doctorProfiles?.map(d => [d.user_id, d]) || []);

          for (const profile of profiles) {
            const docProfile = doctorMap.get(profile.id);
            if (docProfile) {
              searchResults.push({
                id: profile.id,
                type: 'doctor',
                title: profile.name || 'Doctor',
                subtitle: docProfile.specialty,
                specialty: docProfile.specialty,
                avatarUrl: profile.avatar_url || undefined,
              });
            }
          }
        }

        // Search doctors by specialty
        const { data: doctors } = await supabase
          .from('doctor_profiles')
          .select('user_id, specialty, status')
          .eq('status', 'approved')
          .ilike('specialty', `%${searchTerm}%`)
          .limit(3);

        if (doctors) {
          const newDoctorIds = doctors
            .filter(d => !searchResults.find(r => r.id === d.user_id))
            .map(d => d.user_id);

          if (newDoctorIds.length > 0) {
            const { data: doctorProfiles } = await supabase
              .from('profiles_public')
              .select('id, name, avatar_url')
              .in('id', newDoctorIds);

            const profileMap = new Map(doctorProfiles?.map(p => [p.id, p]) || []);

            for (const doc of doctors) {
              if (!searchResults.find(r => r.id === doc.user_id)) {
                const profile = profileMap.get(doc.user_id);
                if (profile) {
                  searchResults.push({
                    id: doc.user_id,
                    type: 'doctor',
                    title: profile.name || 'Doctor',
                    subtitle: doc.specialty,
                    specialty: doc.specialty,
                    avatarUrl: profile.avatar_url || undefined,
                  });
                }
              }
            }
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
        return <Stethoscope className="w-4 h-4 text-primary" />;
      case 'recording':
        return <PlayCircle className="w-4 h-4 text-purple-500" />;
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
                    >
                      {typeResults.map(result => (
                        <CommandItem
                          key={`${result.type}-${result.id}`}
                          onSelect={() => handleSelect(result)}
                          className="flex items-center gap-3 cursor-pointer p-2"
                        >
                          {result.type === 'doctor' ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={result.avatarUrl} alt={result.title} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {result.title.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          ) : result.thumbnailUrl ? (
                            <div className="h-8 w-12 rounded overflow-hidden bg-muted flex-shrink-0">
                              <img 
                                src={result.thumbnailUrl} 
                                alt={result.title}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              {getIcon(result.type)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-sm">{result.title}</p>
                            {result.subtitle && (
                              <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          {result.type === 'live' && (
                            <Badge variant="destructive" className="text-xs animate-pulse">
                              {t('lives.live')}
                            </Badge>
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
