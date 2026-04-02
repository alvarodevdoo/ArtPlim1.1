import React from 'react';
import { Building, Award, MapPin, Phone, Mail, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { toast } from 'sonner';

interface OrganizationData {
  name: string;
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
}

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
  const [fetchingCnpj, setFetchingCnpj] = React.useState(false);
  const [fetchingCep, setFetchingCep] = React.useState(false);

  // Referência para o campo número para focar após buscar CEP
  const addressNumberRef = React.useRef<HTMLInputElement>(null);

  // Máscara para CNPJ: 00.000.000/0000-00
  const maskCnpj = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18);
  };

  // Máscara para CEP: 00000-000
  const maskCep = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d)/, '$1-$2')
      .substring(0, 9);
  };

  // Capitalização de nomes
  const toTitleCaseBR = (str: string) => {
    if (!str) return str;
    const lowerExceptions = ['de', 'da', 'do', 'dos', 'das', 'e'];
    return str.toLowerCase().split(' ').map((word, index) => {
      if (index !== 0 && lowerExceptions.includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  };

  const fetchCepData = async (cepRaw: string) => {
    const cep = cepRaw.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setFetchingCep(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
      if (!response.ok) throw new Error('CEP não encontrado');
      
      const data = await response.json();
      
      setOrganizationData(prev => ({
        ...prev,
        zipCode: maskCep(cep),
        address: toTitleCaseBR(data.street) || prev.address,
        neighborhood: toTitleCaseBR(data.neighborhood) || prev.neighborhood,
        city: toTitleCaseBR(data.city) || prev.city,
        state: data.state || prev.state
      }));

      toast.success('Endereço localizado!');
      // Focar no campo número para agilizar a digitação
      setTimeout(() => addressNumberRef.current?.focus(), 100);
    } catch (error) {
      console.error('Erro CEP:', error);
      toast.error('Não foi possível localizar este CEP');
    } finally {
      setFetchingCep(false);
    }
  };

  const fetchCnpjData = async (cnpjRaw: string) => {
    const cnpj = cnpjRaw.replace(/\D/g, '');
    if (cnpj.length !== 14) return;

    setFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('CNPJ não encontrado ou erro na busca');
      
      const data = await response.json();
      
      // Mapear dados da BrasilAPI para o nosso estado
      setOrganizationData(prev => ({
        ...prev,
        cnpj: maskCnpj(cnpj),
        name: toTitleCaseBR(data.nome_fantasia || data.razao_social) || prev.name,
        razaoSocial: toTitleCaseBR(data.razao_social) || prev.razaoSocial,
        email: data.email ? data.email.toLowerCase() : prev.email,
        phone: data.ddd_telefone_1 || prev.phone,
        zipCode: data.cep || prev.zipCode,
        address: toTitleCaseBR(data.logradouro) || prev.address,
        addressNumber: data.numero || prev.addressNumber,
        complement: toTitleCaseBR(data.complemento) || prev.complement,
        neighborhood: toTitleCaseBR(data.bairro) || prev.neighborhood,
        city: toTitleCaseBR(data.municipio) || prev.city,
        state: data.uf || prev.state
      }));

      toast.success('Dados recuperados com sucesso!');
    } catch (error) {
      console.error('Erro CNPJ:', error);
      toast.error('Não foi possível recuperar dados deste CNPJ');
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCnpj(e.target.value);
    setOrganizationData(prev => ({ ...prev, cnpj: masked }));

    // Se atingiu o tamanho do CNPJ completo, dispara a busca
    if (masked.replace(/\D/g, '').length === 14) {
      fetchCnpjData(masked);
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setOrganizationData(prev => ({ ...prev, zipCode: masked }));

    if (masked.replace(/\D/g, '').length === 8) {
      fetchCepData(masked);
    }
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
                  <label className="text-xs font-medium">Nome Fantasia</label>
                  <Input
                    value={organizationData.name || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: ArtPlim Gráfica"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium">Razão Social</label>
                  <Input
                    value={organizationData.razaoSocial || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, razaoSocial: e.target.value }))}
                    placeholder="Ex: ArtPlim Serviços de Impressão LTDA"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium flex items-center justify-between">
                    <span>CNPJ</span>
                    {fetchingCnpj && <span className="text-[10px] text-primary flex items-center gap-1"><Loader2 className="w-2 h-2 animate-spin" /> Buscando...</span>}
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
                  <label className="text-xs font-medium flex items-center gap-1">
                    <Award className="w-3 h-3" /> Plano
                  </label>
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted/30">
                    <span className="text-sm font-bold uppercase">{organizationData.plan || 'BASIC'}</span>
                    <Button variant="ghost" size="sm" type="button" className="ml-auto text-[10px] h-6">Upgrade</Button>
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
                  <label className="text-xs font-medium flex items-center gap-1">
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
                  <label className="text-xs font-medium flex items-center gap-1">
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
                  <label className="text-xs font-medium flex items-center justify-between">
                    <span>CEP</span>
                    {fetchingCep && <span className="text-[10px] text-primary flex items-center gap-1 animate-pulse">Buscando...</span>}
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
                  <label className="text-xs font-medium">Logradouro (Rua/Av)</label>
                  <Input
                    value={organizationData.address || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Rua Exemplo"
                  />
                </div>
                <div className="col-span-1 space-y-2">
                  <label className="text-xs font-medium">Número</label>
                  <Input
                    ref={addressNumberRef}
                    value={organizationData.addressNumber || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, addressNumber: e.target.value }))}
                    placeholder="123"
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-medium">Complemento</label>
                  <Input
                    value={organizationData.complement || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, complement: e.target.value }))}
                    placeholder="Sala, Bloco, etc"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-xs font-medium">Bairro</label>
                  <Input
                    value={organizationData.neighborhood || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, neighborhood: e.target.value }))}
                    placeholder="Centro"
                  />
                </div>
                <div className="col-span-1 md:col-span-1 space-y-2">
                   <label className="text-xs font-medium">UF</label>
                   <Input
                    maxLength={2}
                    className="uppercase"
                    value={organizationData.state || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                    placeholder="SP"
                  />
                </div>
                <div className="col-span-1 md:col-span-1 space-y-2">
                   <label className="text-xs font-medium">Cidade</label>
                   <Input
                    value={organizationData.city || ''}
                    onChange={(e) => setOrganizationData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Sua Cidade"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={loading || fetchingCnpj || fetchingCep} className="w-full md:w-auto px-10 shadow-lg">
              {loading ? 'Sincronizando...' : 'Salvar Dados Cadastrais'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
