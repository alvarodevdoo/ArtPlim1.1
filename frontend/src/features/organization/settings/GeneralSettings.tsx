import React from 'react';
import { Building, Award, MapPin, Phone, Mail, Loader2, Search, Image as ImageIcon, Upload, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { maskCnpj, maskCep, toTitleCaseBR } from '@/services/lookup';
import { useCnpjLookup } from '@/hooks/useCnpjLookup';
import { useCepLookup } from '@/hooks/useCepLookup';
import { toast } from 'sonner';
import { ModalPortal } from '@/components/ui/ModalPortal';

interface OrganizationData {
  name: string;
  slug?: string;
  subdomain?: string | null;
  razaoSocial?: string;
  cnpj: string;
  plan: string;
  email?: string;
  phone?: string;
  zipCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  logoFull?: string | null;
  logoIcon?: string | null;
  logoScale?: number;
}

const MAX_LOGO_SIZE = 512 * 1024; // 512KB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface LogoUploaderProps {
  title: string;
  subtitle: string;
  hint: string;
  value?: string | null;
  aspect: 'wide' | 'square';
  onChange: (dataUrl: string | null) => void;
}

const LogoUploader: React.FC<LogoUploaderProps> = ({ title, subtitle, hint, value, aspect, onChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem (PNG, JPG, SVG).');
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      toast.error('Imagem muito grande. Limite: 512 KB.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl);
    } catch {
      toast.error('Não foi possível ler o arquivo.');
    }
  };

  const previewClass = aspect === 'wide' ? 'aspect-[16/7] w-full' : 'aspect-square w-full max-w-[180px] mx-auto';

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b bg-slate-50/70">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <p className="text-caption text-muted-foreground leading-snug">{subtitle}</p>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div
          className={`relative rounded-lg border-2 border-dashed transition-all ${previewClass} ${
            dragOver ? 'border-primary bg-primary/5' : value ? 'border-slate-200 bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f8fafc_75%),linear-gradient(-45deg,transparent_75%,#f8fafc_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px]' : 'border-slate-200 bg-slate-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !value && inputRef.current?.click()}
          style={{ cursor: value ? 'default' : 'pointer' }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-3">
            {value
              ? <img src={value} alt={title} className="max-w-full max-h-full object-contain" />
              : (
                <div className="text-center text-slate-400">
                  <Upload className="w-7 h-7 mx-auto mb-1.5 opacity-60" />
                  <p className="text-caption font-medium">Clique ou arraste a imagem</p>
                </div>
              )
            }
          </div>
        </div>

        <p className="text-caption text-muted-foreground leading-snug">{hint}</p>

        <div className="flex gap-2 mt-auto">
          <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => inputRef.current?.click()}>
            <Upload className="w-3.5 h-3.5 mr-1.5" /> {value ? 'Trocar imagem' : 'Selecionar arquivo'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => onChange(null)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
};

interface GeneralSettingsProps {
  organizationData: OrganizationData;
  setOrganizationData: React.Dispatch<React.SetStateAction<OrganizationData>>;
  handleSaveOrganization: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  organizationData,
  setOrganizationData,
  handleSaveOrganization,
  loading
}) => {
  const [showLogoModal, setShowLogoModal] = React.useState(false);
  // Referência para o campo número para focar após buscar CEP
  const addressNumberRef = React.useRef<HTMLInputElement>(null);

  const { loading: fetchingCnpj, fetchDebounced: fetchCnpjDebounced } = useCnpjLookup({
    onSuccess: (data) => {
      setOrganizationData(prev => ({
        ...prev,
        cnpj: data.cnpjFormatted,
        name: toTitleCaseBR(data.nomeFantasia || data.razaoSocial) || prev.name,
        razaoSocial: toTitleCaseBR(data.razaoSocial) || prev.razaoSocial,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        zipCode: data.zipCode || prev.zipCode,
        address: toTitleCaseBR(data.address) || prev.address,
        addressNumber: data.addressNumber || prev.addressNumber,
        complement: toTitleCaseBR(data.complement) || prev.complement,
        neighborhood: toTitleCaseBR(data.neighborhood) || prev.neighborhood,
        city: toTitleCaseBR(data.city) || prev.city,
        state: data.state || prev.state,
      }));
    },
  });

  const { loading: fetchingCep, fetchDebounced: fetchCepDebounced } = useCepLookup({
    onSuccess: (data) => {
      setOrganizationData(prev => ({
        ...prev,
        zipCode: data.cepFormatted,
        address: toTitleCaseBR(data.address) || prev.address,
        neighborhood: toTitleCaseBR(data.neighborhood) || prev.neighborhood,
        city: toTitleCaseBR(data.city) || prev.city,
        state: data.state || prev.state,
      }));
      // Focar no campo número para agilizar a digitação
      setTimeout(() => addressNumberRef.current?.focus(), 100);
    },
  });

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCnpj(e.target.value);
    setOrganizationData(prev => ({ ...prev, cnpj: masked }));
    fetchCnpjDebounced(masked);
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setOrganizationData(prev => ({ ...prev, zipCode: masked }));
    fetchCepDebounced(masked);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dados da Empresa</CardTitle>
          <CardDescription>Informações cadastrais e contato oficial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOrganization} className="space-y-8">
            {/* Seção 1: Identificação */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b pb-2">
                <Building className="w-4 h-4" /> Identificação Jurídica
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label">Nome Fantasia</label>
                  <Input
                    value={organizationData.name || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: ArtPlim Gráfica"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label">Razão Social</label>
                  <Input
                    value={organizationData.razaoSocial || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                    placeholder="Ex: ArtPlim Serviços de Impressão LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label flex items-center justify-between">
                    <span>CNPJ</span>
                    {fetchingCnpj && <span className="text-caption text-primary flex items-center gap-1"><Loader2 className="w-2 h-2 animate-spin" /> Buscando...</span>}
                  </label>
                  <div className="relative">
                    <Input
                      value={organizationData.cnpj || ''}
                      onChange={handleCnpjChange}
                      placeholder="00.000.000/0000-00"
                      className={fetchingCnpj ? "pr-10 opacity-70" : "pr-10"}
                    />
                    <div className="absolute right-3 top-2.5">
                       {fetchingCnpj ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Search className="w-4 h-4 text-muted-foreground opacity-50" />}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-label flex items-center gap-1">
                    <Award className="w-3 h-3" /> Plano
                  </label>
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30">
                    <span className="text-sm font-bold uppercase">{organizationData.plan || 'BASIC'}</span>
                    <Button variant="ghost" size="sm" type="button" className="ml-auto text-caption h-6">Upgrade</Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Contato */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b pb-2">
                 Canais de Contato
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-label flex items-center gap-1">
                    <Mail className="w-3 h-3" /> E-mail Comercial
                  </label>
                  <Input
                    type="email"
                    value={organizationData.email || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contato@artplim.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-label flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Telefone
                  </label>
                  <Input
                    value={organizationData.phone || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b pb-2">
                <MapPin className="w-4 h-4" /> Localização
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="col-span-2 space-y-2">
                  <label className="text-label flex items-center justify-between">
                    <span>CEP</span>
                    {fetchingCep && <span className="text-caption text-primary flex items-center gap-1 animate-pulse">Buscando...</span>}
                  </label>
                  <div className="relative">
                    <Input
                      value={organizationData.zipCode || ''}
                      onChange={handleCepChange}
                      placeholder="00000-000"
                    />
                    <div className="absolute right-3 top-2.5">
                       {fetchingCep ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <MapPin className="w-4 h-4 text-muted-foreground opacity-50" />}
                    </div>
                  </div>
                </div>
                <div className="col-span-2 md:col-span-3 space-y-2">
                  <label className="text-label">Logradouro (Rua/Av)</label>
                  <Input
                    value={organizationData.address || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Rua Exemplo"
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <label className="text-label">Número</label>
                  <Input
                    ref={addressNumberRef}
                    value={organizationData.addressNumber || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, addressNumber: e.target.value }))}
                    placeholder="123"
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <label className="text-label">Complemento</label>
                  <Input
                    value={organizationData.complement || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, complement: e.target.value }))}
                    placeholder="Sala, Bloco, etc"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-label">Bairro</label>
                  <Input
                    value={organizationData.neighborhood || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, neighborhood: e.target.value }))}
                    placeholder="Centro"
                  />
                </div>
                <div className="col-span-1 md:col-span-1 space-y-2">
                   <label className="text-label">UF</label>
                   <Input
                    maxLength={2}
                    className="uppercase"
                    value={organizationData.state || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                  />
                </div>
                <div className="col-span-1 md:col-span-1 space-y-2">
                   <label className="text-label">Cidade</label>
                   <Input
                    value={organizationData.city || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Sua Cidade"
                  />
                </div>
              </div>
            </div>

            {/* Seção: Identidade Visual (atalho para modal) */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-primary border-b pb-2">
                <ImageIcon className="w-4 h-4" /> Identidade Visual
              </h3>
              <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-indigo-50/50 to-slate-50 border border-indigo-100/60">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex -space-x-2 shrink-0">
                    <div className="w-16 h-12 rounded-md border-2 border-white bg-white shadow flex items-center justify-center overflow-hidden">
                      {organizationData.logoFull
                        ? <img src={organizationData.logoFull} className="max-w-full max-h-full object-contain" alt="Logo" />
                        : <ImageIcon className="w-5 h-5 text-slate-300" />}
                    </div>
                    <div className="w-12 h-12 rounded-md border-2 border-white bg-white shadow flex items-center justify-center overflow-hidden">
                      {organizationData.logoIcon
                        ? <img src={organizationData.logoIcon} className="max-w-full max-h-full object-contain" alt="Ícone" />
                        : <ImageIcon className="w-4 h-4 text-slate-300" />}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">Logo e ícone da empresa</p>
                    <p className="text-caption text-muted-foreground leading-snug">Exibidos em comprovantes impressos (A4 e cupom térmico 80mm).</p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setShowLogoModal(true)}>
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  {(organizationData.logoFull || organizationData.logoIcon) ? 'Gerenciar' : 'Adicionar logo'}
                </Button>
              </div>
            </div>

            {/* Seção: Acesso da Aplicação (último) */}
            <div className="space-y-4">
              <h3 className="text-h3 flex items-center gap-2 text-primary border-b pb-2">
                <Globe className="w-4 h-4" /> Acesso da Aplicação
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-label">Slug da Empresa</label>
                  <Input
                    value={organizationData.slug || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    placeholder="artplim"
                  />
                  <p className="text-caption text-muted-foreground leading-snug">
                    Identificador único usado no login (campo "Empresa"). Letras minúsculas, números e hífen.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-label">Subdomínio (URL)</label>
                  <div className="flex items-stretch h-10 rounded-md border border-input bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0">
                    <input
                      type="text"
                      value={organizationData.subdomain || ''}
                      onChange={(e) => setOrganizationData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') || null }))}
                      placeholder="erp"
                      className="flex-1 min-w-0 px-3 text-body bg-transparent outline-none"
                    />
                    <span className="flex items-center px-3 bg-slate-100 border-l text-caption text-slate-600 font-mono select-none whitespace-nowrap">
                      .artplim.com.br
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground leading-snug">
                    Prefixo de URL para acesso direto (pula o campo "Empresa" no login). Opcional.
                  </p>
                </div>
                {organizationData.subdomain && (
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-label">URL completa de acesso</label>
                    <div className="h-10 px-3 flex items-center bg-slate-50 border rounded-md text-body font-mono text-slate-700 truncate">
                      https://{organizationData.subdomain}.artplim.com.br
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer do formulário: ação primária ancorada à direita com separador */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t">
              <p className="text-caption text-muted-foreground">
                As alterações são aplicadas em toda a aplicação após salvar.
              </p>
              <Button
                type="submit"
                disabled={loading || fetchingCnpj || fetchingCep}
                className="w-full sm:w-auto px-8"
              >
                {loading ? 'Sincronizando...' : 'Salvar Dados Cadastrais'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {showLogoModal && (
        <ModalPortal onBackdropClick={() => setShowLogoModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Identidade Visual</h3>
                  <p className="text-xs text-muted-foreground">Logo e ícone usados nos comprovantes impressos</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" type="button" onClick={() => setShowLogoModal(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <LogoUploader
                  title="Logo Completa"
                  subtitle="Usada na impressão em folha A4"
                  hint="Recomendado: PNG ou SVG com fundo transparente, proporção horizontal. Máx. 512 KB."
                  aspect="wide"
                  value={organizationData.logoFull}
                  onChange={(v) => setOrganizationData(prev => ({ ...prev, logoFull: v }))}
                />
                <LogoUploader
                  title="Ícone / Símbolo"
                  subtitle="Usado no cupom térmico (80mm)"
                  hint="Recomendado: PNG ou SVG quadrado com fundo transparente. Máx. 512 KB."
                  aspect="square"
                  value={organizationData.logoIcon}
                  onChange={(v) => setOrganizationData(prev => ({ ...prev, logoIcon: v }))}
                />
              </div>

              {/* Slider de tamanho da logo no A4 */}
              <div className="mt-5 p-4 rounded-xl border bg-slate-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Tamanho da Logo no Pedido (A4)</h4>
                    <p className="text-caption text-muted-foreground leading-snug">A logo nunca passa da altura do bloco de dados ao lado.</p>
                  </div>
                  <span className="text-sm font-bold text-primary tabular-nums px-2 py-1 rounded bg-white border min-w-[58px] text-center">
                    {organizationData.logoScale ?? 100}%
                  </span>
                </div>

                {/* Preview da relação logo × texto (espelha o cálculo do printOrder: base 70px × scale%) */}
                <div className="mb-3 p-3 bg-white border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center shrink-0" style={{ width: '180px' }}>
                      {organizationData.logoFull ? (
                        <img
                          src={organizationData.logoFull}
                          alt="Preview"
                          className="object-contain"
                          style={{
                            maxHeight: `${Math.round(70 * ((organizationData.logoScale ?? 100) / 100))}px`,
                            maxWidth: '100%'
                          }}
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center text-xs text-slate-700 leading-relaxed flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{organizationData.name || 'Nome da Empresa'}</div>
                      {organizationData.cnpj && <div className="text-caption text-slate-500 truncate">CNPJ: {organizationData.cnpj}</div>}
                      <div className="text-caption text-slate-500 truncate">Endereço completo • Cidade/UF</div>
                      <div className="text-caption text-slate-500 truncate">Contato • E-mail</div>
                    </div>
                  </div>
                </div>

                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={organizationData.logoScale ?? 100}
                  onChange={(e) => setOrganizationData(prev => ({ ...prev, logoScale: parseInt(e.target.value, 10) }))}
                  className="w-full accent-primary"
                  disabled={!organizationData.logoFull}
                />
                <div className="flex justify-between text-caption text-muted-foreground mt-1 px-0.5">
                  <span>50%</span>
                  <span>75%</span>
                  <span>100% (mesma altura do texto)</span>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-caption text-amber-900 leading-relaxed">
                Ao clicar em <strong>Concluir</strong>, as alterações de logo e ícone são salvas imediatamente.
              </div>
            </div>

            <div className="px-6 py-3 border-t bg-slate-50 flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowLogoModal(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={loading}
                onClick={async (e) => {
                  await handleSaveOrganization(e as unknown as React.FormEvent);
                  setShowLogoModal(false);
                }}
              >
                {loading ? 'Salvando...' : 'Concluir'}
              </Button>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
