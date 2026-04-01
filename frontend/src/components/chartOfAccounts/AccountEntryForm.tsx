import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { AccountCombobox } from './AccountCombobox';
import styles from './AccountEntryForm.module.scss';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Info, Tag, Settings2, FolderTree, Type, Hash, FileText, ChevronDown } from 'lucide-react';

interface AccountEntryFormProps {
  onSuccess?: () => void;
  isCreationMode?: boolean;
  accountToEdit?: any;
}

export const AccountEntryForm: React.FC<AccountEntryFormProps> = ({ onSuccess, isCreationMode = false, accountToEdit }) => {
  const { control, handleSubmit, setValue, reset, watch, register } = useForm({
    defaultValues: {
      accountId: accountToEdit?.id || '',
      isNew: isCreationMode || !!accountToEdit,
      newName: accountToEdit?.name || '',
      nature: accountToEdit?.nature || 'EXPENSE',
      type: accountToEdit?.type || 'ANALYTIC', 
      code: accountToEdit?.code || '',
      parentId: accountToEdit?.parentId || '',
      description: accountToEdit?.description || '',
      systemRole: accountToEdit?.systemRole || 'GENERAL'
    }
  });

  // Re-sync isNew if prop changes
  useEffect(() => {
    if (isCreationMode) {
      setValue('isNew', true);
    }
  }, [isCreationMode, setValue]);

  const [loading, setLoading] = useState(false);
  const [parentOptions, setParentOptions] = useState<any[]>([]);

  const parentId = watch('parentId');

  const watchNature = watch('nature');

  // Suggest next code based on parent Selection
  useEffect(() => {
    if (isCreationMode) {
      if (parentId) {
      const parent = parentOptions.find(p => p.id === parentId);
      if (parent) {
        let nextSuffix = 1;
        let padding = 1;
        const parentCodePrefix = parent.code + '.';
        const children = parentOptions.filter(p => 
          p.code?.startsWith(parentCodePrefix) && 
          p.code?.split('.').length === parent.code.split('.').length + 1
        );
        
        // PADRÃO SEGURO 5 NÍVEIS: 9.9.9.99.9999
        let defaultPadding = 1;
        if (parent.level === 0) defaultPadding = 1; // 1 -> 1.1
        else if (parent.level === 1) defaultPadding = 1; // 1.1 -> 1.1.1
        else if (parent.level === 2) defaultPadding = 2; // 1.1.1 -> 1.1.1.01
        else if (parent.level >= 3) defaultPadding = 4; // 1.1.1.01 -> 1.1.1.01.0001

        if (children.length > 0) {
          const siblingInfo = children.map(c => {
            const parts = c.code?.split('.');
            const lastPart = parts ? parts[parts.length - 1] : '';
            return {
              value: parseInt(lastPart),
              raw: lastPart,
              length: lastPart.length
            };
          });
          
          const validSiblings = siblingInfo.filter(s => !isNaN(s.value));
          
          if (validSiblings.length > 0) {
            nextSuffix = Math.max(...validSiblings.map(s => s.value)) + 1;
            // RESPEITAR O PADRÃO EXISTENTE: usa a mesma quantidade de casas dos irmãos
            // Mas nunca menos que o padrão da máscara definida
            padding = Math.max(defaultPadding, ...validSiblings.map(s => s.length));
          } else {
            padding = defaultPadding;
          }
        } else {
          padding = defaultPadding;
        }
        
        const suffixStr = nextSuffix.toString().padStart(padding, '0');
        const suggestedCode = `${parent.code}.${suffixStr}`;
        
        // Verificação Crítica: se o código atual do formulário não começa com o prefixo do pai, 
        // ou se o pai mudou de código, forçamos a atualização para evitar órfãos.
        const currentCode = watch('code');
        if (!currentCode || !currentCode.startsWith(parent.code + '.')) {
          setValue('code', suggestedCode);
        }
        
        // Auto-set type: Nível 1 a 3 são grupos [S], nível 4 em diante Analítico [A]
        if (parent.level < 2) {
          setValue('type', 'SYNTHETIC');
        } else {
          setValue('type', 'ANALYTIC');
        }
        
        // Also sync nature if parent is selected
        if (parent.nature) {
          setValue('nature', parent.nature);
        }
      }
      } else {
        // Lógica para NOVA CONTA PRINCIPAL (ROOT) - SUGERIR PADRÃO SPED 1-9
        const natureMapping: Record<string, string> = {
          'ASSET': '1',
          'LIABILITY': '2',
          'EQUITY': '3',
          'REVENUE': '4',
          'REVENUE_DEDUCTION': '5',
          'COST': '6',
          'EXPENSE': '7',
          'RESULT_CALCULATION': '8',
          'CONTROL': '9'
        };

        const suggestedBase = natureMapping[watchNature] || '10';
        const roots = parentOptions.filter(p => !p.parentId || p.level === 0);
        
        const isTaken = roots.some(r => r.code === suggestedBase);
        
        if (isTaken || suggestedBase === '10') {
           // Se o padrão SPED já existir ou for desconhecido, busca o proximo livre acima de 10
           const rootValues = roots
            .map((r: any) => {
              const baseValue = parseInt(r.code?.split('.')[0] || '0');
              return isNaN(baseValue) ? 0 : baseValue;
            })
            .filter((v: number) => v > 0);
            
           let nextRootValue = 10;
           if (rootValues.length > 0) {
              const currentMax = Math.max(...rootValues);
              nextRootValue = currentMax < 9 ? 10 : currentMax + 1;
           }
           const currentCode = watch('code');
           if (!currentCode || currentCode.includes('.')) {
              setValue('code', nextRootValue.toString());
           }
        } else {
           const currentCode = watch('code');
           if (!currentCode || currentCode.includes('.')) {
              setValue('code', suggestedBase);
           }
        }
        
        setValue('type', 'SYNTHETIC');
      }
    }
  }, [parentId, watchNature, isCreationMode, parentOptions, setValue]);

  const fetchParents = async () => {
    try {
      const response = await api.get('/api/finance/v2/chart-of-accounts');
      const flatList: any[] = [];
      const flatten = (arr: any[], level = 0) => {
        arr.forEach(item => {
          flatList.push({ ...item, level });
          if (item.children && item.children.length > 0) {
            flatten(item.children, level + 1);
          }
        });
      };
      flatten(response.data.data || []);
      setParentOptions(flatList);
    } catch (e) {
      console.error("Falha ao buscar pais", e);
    }
  };

  useEffect(() => {
    fetchParents();
  }, [isCreationMode, accountToEdit]);

  const isNew = watch('isNew');
  const watchType = watch('type');

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      if (data.isNew || accountToEdit) {
        if (accountToEdit && accountToEdit.id) {
          // UPDATE
          await api.put(`/api/finance/v2/chart-of-accounts/${accountToEdit.id}`, {
            name: data.newName,
            nature: data.nature,
            type: data.type,
            code: data.code || undefined,
            parentId: data.parentId || undefined,
            description: data.description,
            systemRole: data.systemRole
          });
          toast.success('Categoria atualizada com sucesso!');
        } else {
          // CREATE
          const res = await api.post('/api/finance/v2/chart-of-accounts', {
            name: data.newName,
            nature: data.nature,
            type: data.type, 
            code: data.code || undefined,
            parentId: data.parentId || undefined,
            description: data.description,
            systemRole: data.systemRole
          });
          toast.success('Categoria criada com sucesso!');
          setValue('accountId', res.data.data.id);
        }
        setValue('isNew', false);
      } else {
        toast.success(`Conta associada ao lançamento!`);
      }
      
      reset();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      const dbgMsg = e.response?.data?.message || 'Erro do servidor';
      toast.error(`Erro ao processar conta: ${dbgMsg}`);
      console.error("ERRO 500 NO FORM:", e.response?.data || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>
        {accountToEdit ? `Editar Conta` : (isCreationMode ? 'Nova Conta / Categoria' : 'Vincular Categoria')}
      </h2>
      
      <form onSubmit={handleSubmit(onSubmit)}>
        {(!isCreationMode && !accountToEdit) ? (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <Tag className="w-4 h-4 text-primary" /> O que é este lançamento?
            </label>
            <Controller
              control={control}
              name="accountId"
              rules={{ required: !isNew }}
              render={({ field }) => (
                <AccountCombobox 
                  value={field.value} 
                  onChange={(val, isNewMode, typedName) => {
                    field.onChange(val);
                    setValue('isNew', isNewMode);
                    if (typedName) setValue('newName', typedName);
                  }} 
                />
              )}
            />
          </div>
        ) : (
          <div className={styles.fieldGroup}>
            <label className={styles.label}>
              <FileText className="w-4 h-4 text-primary" /> Nome da categoria / conta
            </label>
            <input 
              {...register('newName', { required: true })} 
              className={styles.textInput} 
              placeholder="Ex: Embalagens, Energia, Internet" 
              autoFocus
            />
          </div>
        )}

        {isNew && (
          <div className={styles.creationSection}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <Type className="w-4 h-4" /> Tipo de conta (Referência Fiscal)
              </label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <div className={styles.radioGroup}>
                    <label className={styles.radioLabel}>
                      <input 
                        type="radio" 
                        {...field} 
                        value="SYNTHETIC" 
                        checked={field.value === 'SYNTHETIC'} 
                        className={styles.radioInput}
                      />
                      <span>Grupo (S)</span>
                    </label>
                    <label className={styles.radioLabel}>
                      <input 
                        type="radio" 
                        {...field} 
                        value="ANALYTIC" 
                        checked={field.value === 'ANALYTIC'} 
                        className={styles.radioInput}
                      />
                      <span>Analítica (A)</span>
                    </label>
                  </div>
                )}
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <FolderTree className="w-4 h-4" /> Natureza da conta
              </label>
              <Controller
                control={control}
                name="nature"
                render={({ field }) => (
                  <select {...field} className={styles.select}>
                    <option value="ASSET">1 Ativo (Bens e direitos)</option>
                    <option value="LIABILITY">2 Passivo (Dívidas)</option>
                    <option value="EQUITY">3 Patrimônio Líquido (Capital)</option>
                    <option value="REVENUE">4 Receita (Venda/Serviço)</option>
                    <option value="REVENUE_DEDUCTION">5 Dedução (Impostos/Devoluções)</option>
                    <option value="COST">6 Custo (Produção/Materiais)</option>
                    <option value="EXPENSE">7 Despesa (Fixa/Operacional)</option>
                    <option value="RESULT_CALCULATION">8 Apuração de Resultado (DRE)</option>
                    <option value="CONTROL">9 Contas de Controle</option>
                  </select>
                )}
              />
            </div>

            {watchType === 'ANALYTIC' && (
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  <Settings2 className="w-4 h-4" /> Para que serve esta conta?
                </label>
                <Controller
                  control={control}
                  name="systemRole"
                  render={({ field }) => (
                    <select {...field} className={styles.select}>
                      <option value="GENERAL">⚙️ Outros (Lançamentos comuns)</option>
                      <option value="BANK_ACCOUNT">🏦 Conta Bancária / Caixa</option>
                      <option value="INVENTORY">📦 Estoque / Matéria-prima</option>
                      <option value="REVENUE_SALE">💰 Receita de Venda / Serviço</option>
                      <option value="COST_EXPENSE">📉 Custo / Despesa / Gasto</option>
                      <option value="RECEIVABLE">🤝 A Receber (Clientes)</option>
                      <option value="PAYABLE">💳 A Pagar (Fornecedores/Dívidas)</option>
                      <option value="TAX">🏛️ Impostos (Simples/ICMS/ISS)</option>
                      <option value="FIXED_ASSET">🏗️ Patrimônio (Máquinas/Móveis)</option>
                      <option value="EQUITY">⚖️ Capital Social (Sócios)</option>
                    </select>
                  )}
                />
              </div>
            )}

            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <Hash className="w-4 h-4" /> Código contábil
              </label>
              <Controller
                control={control}
                name="code"
                rules={{ required: 'Código é obrigatório' }}
                render={({ field, fieldState }) => (
                  <>
                    <input 
                      {...field} 
                      className={`${styles.textInput} ${fieldState.error ? styles.inputError : ''}`} 
                      placeholder="Ex: 1.1.04.01" 
                    />
                    {fieldState.error && <span className={styles.errorMessage}>{fieldState.error.message}</span>}
                  </>
                )}
              />
            </div>
            
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                <Info className="w-4 h-4" /> Observações (Opcional)
              </label>
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <input {...field} className={styles.textInput} placeholder="Ex: Gastos com energia, papelaria..." />
                )}
              />
            </div>
          </div>
        )}

        <div className={styles.buttonGroup}>
          <button type="submit" disabled={loading} className={styles.buttonSubmit}>
            {loading ? 'Salvando...' : (accountToEdit ? 'Salvar Alterações' : (isCreationMode ? 'Criar Categoria' : (isNew ? 'Criar e Selecionar' : 'Confirmar')))}
          </button>
        </div>
      </form>
    </div>
  );
};
