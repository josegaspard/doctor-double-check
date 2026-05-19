import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Search,
  MessageSquare,
  Loader2,
  UserPlus,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';

interface ResidentGroup {
  id: string;
  name: string;
  description?: string;
  specialty?: string;
  memberCount: number;
  imageUrl?: string;
  createdBy: string;
  isMember: boolean;
}

export default function ResidentGroups() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useLanguage();
  const [groups, setGroups] = useState<ResidentGroup[]>([]);
  const [myMemberships, setMyMemberships] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', specialty: '' });
  const [isCreating, setIsCreating] = useState(false);

  // Redirect non-residents
  if (role !== 'resident' && role !== 'doctor') {
    navigate('/lives');
    return null;
  }

  const fetchGroups = async () => {
    try {
      const { data: groupsData } = await supabase
        .from('resident_groups')
        .select('*')
        .order('member_count', { ascending: false });

      if (groupsData) {
        // Get user's memberships
        const { data: memberships } = await supabase
          .from('resident_group_members')
          .select('group_id')
          .eq('user_id', user?.id || '');

        const membershipSet = new Set(memberships?.map(m => m.group_id) || []);
        setMyMemberships(membershipSet);

        setGroups(groupsData.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description || undefined,
          specialty: g.specialty || undefined,
          memberCount: g.member_count,
          imageUrl: g.image_url || undefined,
          createdBy: g.created_by,
          isMember: membershipSet.has(g.id),
        })));
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [user?.id]);

  const handleCreateGroup = async () => {
    if (!newGroup.name.trim() || !user?.id) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('resident_groups')
        .insert({
          name: newGroup.name,
          description: newGroup.description || null,
          specialty: newGroup.specialty || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Auto-join the group
      await supabase
        .from('resident_group_members')
        .insert({ group_id: data.id, user_id: user.id });

      toast.success(t('residentGroupsPage.toastCreateSuccess'));
      setShowCreateDialog(false);
      setNewGroup({ name: '', description: '', specialty: '' });
      await fetchGroups();
    } catch (error: any) {
      toast.error(error.message || t('residentGroupsPage.toastCreateError'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('resident_group_members')
        .insert({ group_id: groupId, user_id: user.id });

      if (error) throw error;

      toast.success(t('residentGroupsPage.toastJoinSuccess'));
      await fetchGroups();
    } catch (error: any) {
      toast.error(error.message || t('residentGroupsPage.toastJoinError'));
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('resident_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success(t('residentGroupsPage.toastLeaveSuccess'));
      await fetchGroups();
    } catch (error: any) {
      toast.error(error.message || t('residentGroupsPage.toastLeaveError'));
    }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.specialty?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              {t('residentGroupsPage.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('residentGroupsPage.subtitle')}
            </p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                {t('residentGroupsPage.createGroupButton')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('residentGroupsPage.dialogTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium">{t('residentGroupsPage.fieldNameLabel')}</label>
                  <Input
                    value={newGroup.name}
                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                    placeholder={t('residentGroupsPage.fieldNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('residentGroupsPage.fieldSpecialtyLabel')}</label>
                  <Input
                    value={newGroup.specialty}
                    onChange={(e) => setNewGroup({ ...newGroup, specialty: e.target.value })}
                    placeholder={t('residentGroupsPage.fieldSpecialtyPlaceholder')}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('residentGroupsPage.fieldDescriptionLabel')}</label>
                  <Textarea
                    value={newGroup.description}
                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                    placeholder={t('residentGroupsPage.fieldDescriptionPlaceholder')}
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateGroup}
                  disabled={isCreating || !newGroup.name.trim()}
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  {t('residentGroupsPage.createGroupButton')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('inputs.searchGroups')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Groups List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredGroups.length > 0 ? (
          <div className="grid gap-4">
            {filteredGroups.map((group) => (
              <Card key={group.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-7 h-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-foreground">{group.name}</h3>
                          {group.specialty && (
                            <Badge variant="outline" className="mt-1">
                              {group.specialty}
                            </Badge>
                          )}
                        </div>
                        {group.isMember ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLeaveGroup(group.id)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <LogOut className="w-3 h-3" />
                            {t('residentGroupsPage.leaveButton')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleJoinGroup(group.id)}
                            className="gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            {t('residentGroupsPage.joinButton')}
                          </Button>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {group.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {group.memberCount} {t('residentGroupsPage.membersLabel')}
                        </span>
                        {group.isMember && (
                          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {t('residentGroupsPage.viewActivity')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('residentGroupsPage.emptyTitle')}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t('residentGroupsPage.emptyDescription')}
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('residentGroupsPage.createFirstGroup')}
            </Button>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
