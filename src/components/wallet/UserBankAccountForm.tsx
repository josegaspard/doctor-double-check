import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronDown, CheckCircle, Loader2, AlertCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const MEXICAN_BANKS = [
  'BBVA', 'Banorte', 'Santander', 'HSBC', 'Scotiabank', 'Citibanamex',
  'Banco Azteca', 'BanCoppel', 'Inbursa', 'Banregio', 'Afirme',
  'Banco del Bajío', 'Multiva', 'Banbajío', 'Intercam', 'Otro',
];

interface BankAccount {
  id: string;
  bank_name: string;
  clabe: string;
  clabe_last4: string;
  account_holder_name: string;
  rfc: string | null;
}

export function UserBankAccountForm() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);

  const [bankName, setBankName] = useState('');
  const [clabe, setClabe] = useState('');
  const [holderName, setHolderName] = useState('');
  const [rfc, setRfc] = useState('');

  useEffect(() => {
    loadBankAccount();
  }, [user?.id]);

  const loadBankAccount = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('user_bank_accounts' as any)
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      const account = data as any as BankAccount;
      setBankAccount(account);
      setBankName(account.bank_name);
      setClabe(account.clabe);
      setHolderName(account.account_holder_name);
      setRfc(account.rfc || '');
    }
    setIsLoading(false);
  };

  const validateClabe = (value: string) => /^\d{18}$/.test(value);

  const handleSave = async () => {
    if (!user?.id) return;
    if (!bankName || !clabe || !holderName) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    if (!validateClabe(clabe)) {
      toast.error('La CLABE debe tener exactamente 18 dígitos numéricos');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        bank_name: bankName,
        clabe,
        clabe_last4: clabe.slice(-4),
        account_holder_name: holderName,
        rfc: rfc || null,
        updated_at: new Date().toISOString(),
      };

      if (bankAccount) {
        const { error } = await supabase
          .from('user_bank_accounts' as any)
          .update(payload as any)
          .eq('id', bankAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_bank_accounts' as any)
          .insert(payload as any);
        if (error) throw error;
      }

      toast.success('Cuenta bancaria guardada');
      setIsEditing(false);
      await loadBankAccount();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                Cuenta Bancaria
                {bankAccount && (
                  <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
                    <CheckCircle className="w-3 h-3" />Registrada
                  </Badge>
                )}
              </span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {!bankAccount && !isEditing && (
              <div className="flex items-start gap-3 p-3 bg-info/10 border border-info/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">Registra tu cuenta bancaria</p>
                  <p className="text-muted-foreground">Para recibir reembolsos directamente en tu cuenta, registra tu CLABE interbancaria.</p>
                </div>
              </div>
            )}

            {bankAccount && !isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Banco</p>
                    <p className="font-medium text-sm">{bankAccount.bank_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CLABE</p>
                    <p className="font-medium text-sm font-mono">••••••••••••••{bankAccount.clabe_last4}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Titular</p>
                    <p className="font-medium text-sm">{bankAccount.account_holder_name}</p>
                  </div>
                  {bankAccount.rfc && (
                    <div>
                      <p className="text-xs text-muted-foreground">RFC</p>
                      <p className="font-medium text-sm font-mono">{bankAccount.rfc}</p>
                    </div>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                  <Pencil className="w-3 h-3" />Editar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Banco *</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger><SelectValue placeholder="Selecciona tu banco" /></SelectTrigger>
                    <SelectContent>
                      {MEXICAN_BANKS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CLABE Interbancaria (18 dígitos) *</Label>
                  <Input
                    value={clabe}
                    onChange={(e) => setClabe(e.target.value.replace(/\D/g, '').slice(0, 18))}
                    placeholder="012345678901234567"
                    className="font-mono"
                    maxLength={18}
                  />
                  {clabe && !validateClabe(clabe) && (
                    <p className="text-xs text-destructive mt-1">La CLABE debe tener 18 dígitos</p>
                  )}
                </div>
                <div>
                  <Label>Nombre del Titular *</Label>
                  <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Nombre completo" />
                </div>
                <div>
                  <Label>RFC (opcional)</Label>
                  <Input
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase().slice(0, 13))}
                    placeholder="XXXX000000XXX"
                    className="font-mono uppercase"
                    maxLength={13}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving || !bankName || !holderName || !validateClabe(clabe)} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Guardar
                  </Button>
                  {bankAccount && (
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancelar</Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
