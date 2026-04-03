import React from 'react';
import { PlusCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Combobox } from '@/components/ui/Combobox';
import { NFeData } from '../types';

interface NFeItemMapperProps {
  nfeData: NFeData;
  isLoading: boolean;
  availableMaterials: { id: string; name: string; category: string }[];
  onImport: () => void;
  onToggleNew: (index: number) => void;
  onBindExisting: (index: number, materialId: string) => void;
  onToggleSkip: (index: number) => void;
  onSetDistributionMode: (mode: 'STRICT' | 'REDISTRIBUTE') => void;
}

export const NFeItemMapper: React.FC<NFeItemMapperProps> = ({
  nfeData,
  isLoading,
  availableMaterials,
  onImport,
  onToggleNew,
  onBindExisting,
  onToggleSkip,
  onSetDistributionMode
}) => {
  const skippedCount = nfeData.items.filter(i => i.skip).length;
  const distributionMode = nfeData.costDistributionMode || 'STRICT';

  return (
    <Card className="shadow-lg border-0 overflow-hidden flex flex-col">
      <CardHeader className="bg-slate-900 text-white shrink-0">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-xl">Mapeamento de Insumos</CardTitle>
            <CardDescription className="text-slate-400">Vincule os produtos da nota aos seus insumos internos.</CardDescription>
          </div>
          <Button onClick={onImport} disabled={isLoading} className="bg-emerald-500 hover:bg-emerald-600 font-bold px-8 shadow-lg shadow-emerald-900/50 text-white">
            <CheckCircle2 className="mr-2 w-4 h-4" /> Finalizar e Salvar
          </Button>
        </div>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-t text-xs uppercase font-black text-slate-500 tracking-wider">
            <tr>
              <th className="px-5 py-4 w-12 text-center">Nº</th>
              <th className="px-5 py-4">Produto do Fornecedor</th>
              <th className="px-5 py-4 text-center">Qtd / Unit</th>
              <th className="px-5 py-4 w-[400px]">Ação: Vínculo no ERP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nfeData.items.map((item, idx) => (
              <tr key={idx} className={`${item.mappedMaterialId ? 'bg-emerald-50/30' : item.createNew ? 'bg-blue-50/30' : ''} ${item.skip ? 'opacity-50 grayscale bg-slate-100/50' : ''}`}>
                <td className="px-5 py-4 text-center">
                  <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">{item.itemNumber}</span>
                </td>
                <td className="px-5 py-4">
                  <p className="font-bold text-sm text-slate-800">{item.descricao}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 tracking-tight">Cód: {item.codigo} | NCM: {item.ncm}</p>
                </td>
                <td className="px-5 py-4 text-center">
                  <p className="text-sm font-bold text-slate-700">{item.quantidade} <span className="text-xs font-normal text-slate-400">{item.unidade}</span></p>
                  
                  {item.custoEfetivoUnitario && item.custoEfetivoUnitario > item.valorUnitario ? (
                    <div className="flex flex-col items-center mt-1">
                      <p className="text-[10px] line-through text-slate-400">R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (Tabela)</p>
                      <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" title="Custo Efetivo c/ Frete e Impostos">R$ {item.custoEfetivoUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className="text-[10px] font-normal opacity-75">/un</span></p>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-emerald-600 mt-1">R$ {item.valorUnitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / un</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  {item.skip ? (
                    <div className="flex items-center gap-3 bg-slate-200 text-slate-600 px-3 py-2 rounded-lg border border-slate-300">
                      <span className="text-sm font-bold flex-1">Item Ignorado (Não entrará no estoque)</span>
                      <button onClick={() => onToggleSkip(idx)} className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase underline">Restaurar</button>
                    </div>
                  ) : item.createNew ? (
                    <div className="flex items-center gap-3 bg-blue-100/50 text-blue-800 px-3 py-2 rounded-lg border border-blue-200">
                      <PlusCircle className="min-w-4 w-4 text-blue-500"/>
                      <span className="text-sm font-bold text-blue-700 flex-1 truncate">Será criado como Novo Insumo</span>
                      <button onClick={() => onToggleNew(idx)} className="text-xs font-bold text-blue-600 hover:text-blue-900 uppercase">Desfazer</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                       <div className="flex-1">
                         <Combobox
                           value={item.mappedMaterialId || ''}
                           onChange={(val) => onBindExisting(idx, val)}
                           options={availableMaterials.map(m => ({ id: m.id, label: m.name, sublabel: m.category }))}
                           placeholder="Buscar ou criar vínculo..."
                           className="w-full h-10 border-slate-200 shadow-sm"
                         />
                       </div>
                       <span className="text-slate-300 font-black">OU</span>
                       <Button variant="outline" size="sm" onClick={() => onToggleNew(idx)} className="h-10 border-dashed text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold px-4">
                          <PlusCircle className="w-4 h-4 mr-1.5" /> Novo
                       </Button>
                    </div>
                  )}

                  {!item.skip && (
                    <div className="mt-2 flex justify-end">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => onToggleSkip(idx)}
                        className="text-[10px] font-bold uppercase tracking-tighter h-6 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        Ignorar p/ Estoque
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {skippedCount > 0 && (
        <div className="p-6 bg-slate-50 border-t border-slate-200 animate-in slide-in-from-bottom-2 duration-300">
           <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="flex-1">
                 <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-amber-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]">{skippedCount}</span>
                    Itens sendo ignorados nesta importação
                 </h4>
                 <p className="text-xs text-slate-500 mt-1">
                    Esses itens não serão cadastrados nem entrarão no estoque. Escolha como tratar o frete e impostos deles:
                 </p>
              </div>

              <div className="flex gap-2">
                 <Button 
                    variant={distributionMode === 'STRICT' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetDistributionMode('STRICT')}
                    className="text-xs"
                 >
                    Desprezar Custos
                 </Button>
                 <Button 
                    variant={distributionMode === 'REDISTRIBUTE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onSetDistributionMode('REDISTRIBUTE')}
                    className="text-xs"
                 >
                    Ratear entre os demais
                 </Button>
              </div>
           </div>
        </div>
      )}
    </Card>
  );
};
