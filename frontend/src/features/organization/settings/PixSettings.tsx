import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, QrCode } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface Props {
  settings: any;
  setSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

const KEY_TYPES = [
  { value: 'CPF', label: 'CPF' },
  { value: 'CNPJ', label: 'CNPJ' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'PHONE', label: 'Telefone' },
  { value: 'RANDOM', label: 'Chave aleatória' },
];

export const PixSettings: React.FC<Props> = ({ settings, setSettings }) => {
  const [saving, setSaving] = useState(false);

  const handleSavePix = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Envia somente os campos PIX para evitar reprocessar certificado/senhas
      await api.put('/api/organization/settings', {
        pixKey: settings.pixKey ?? null,
        pixKeyType: settings.pixKeyType ?? null,
        pixBeneficiary: settings.pixBeneficiary ?? null,
      });
      toast.success('Chave PIX salva!');
    } catch (err: any) {
      console.error('Erro ao salvar PIX:', err);
      toast.error(err?.response?.data?.message || 'Erro ao salvar chave PIX');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <CardTitle>Chave PIX para cobrança</CardTitle>
            <CardDescription>
              Aparece na página pública de acompanhamento quando o pedido tem saldo pendente.
              Permite ao cliente pagar via PIX (cópia da chave + QR Code).
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSavePix} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Tipo de chave</label>
              <select
                value={settings.pixKeyType || ''}
                onChange={(e) => setSettings((s: any) => ({ ...s, pixKeyType: e.target.value || null }))}
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">— Selecione —</option>
                {KEY_TYPES.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground">Chave PIX</label>
              <input
                type="text"
                value={settings.pixKey || ''}
                onChange={(e) => setSettings((s: any) => ({ ...s, pixKey: e.target.value }))}
                placeholder="Ex: 12.345.678/0001-90 ou chave-aleatoria-uuid"
                className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nome do beneficiário</label>
            <input
              type="text"
              value={settings.pixBeneficiary || ''}
              onChange={(e) => setSettings((s: any) => ({ ...s, pixBeneficiary: e.target.value }))}
              placeholder="Ex: Razão Social ou nome do titular"
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar PIX'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
