import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Barcode } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface NFeKeyInputProps {
  onSearch: (chave: string) => void;
  isLoading: boolean;
  /** Quando true, limpa o campo e refocaliza (use após um erro na busca) */
  clearOnError?: boolean;
  /** Callback chamado depois de limpar, para resetar o flag no pai */
  onErrorCleared?: () => void;
}

export const NFeKeyInput: React.FC<NFeKeyInputProps> = ({ onSearch, isLoading, clearOnError, onErrorCleared }) => {
  const [chave, setChave] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus ao carregar a página
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Limpar e refocalizar quando o pai sinalizar um erro
  useEffect(() => {
    if (clearOnError) {
      setChave('');
      setTimeout(() => {
        inputRef.current?.focus();
        onErrorCleared?.();
      }, 100);
    }
  }, [clearOnError, onErrorCleared]);

  const handleChaveChange = (val: string) => {
    // Apenas números e limite de 44
    const cleanVal = val.replace(/\D/g, '').substring(0, 44);
    setChave(cleanVal);

    // Se atingiu 44 dígitos, dispara a busca automaticamente (comum em leitores de código de barras)
    if (cleanVal.length === 44) {
      onSearch(cleanVal);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (chave.length === 44) {
      onSearch(chave);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      <form onSubmit={handleManualSearch} className="relative group">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">
          Chave de Acesso ou Código de Barras
        </label>
        <div className="relative">
          <Input
            ref={inputRef}
            autoFocus
            placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000"
            className="h-14 pl-12 pr-32 text-lg font-mono tracking-widest border-2 focus:border-primary shadow-xl rounded-2xl transition-all"
            value={chave}
            onChange={(e) => handleChaveChange(e.target.value)}
            disabled={isLoading}
          />
          <Barcode className="w-6 h-6 absolute left-4 top-4 text-slate-300 group-focus-within:text-primary transition-colors" />
          
          <div className="absolute right-2 top-2">
            <Button 
              type="submit" 
              disabled={isLoading || chave.length !== 44}
              className="h-10 px-4 rounded-xl shadow-md flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {isLoading ? 'Buscando...' : 'Consultar'}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between px-2 mt-2">
          <p className="text-[10px] text-slate-400 font-medium italic">
            {chave.length}/44 dígitos
          </p>
          {chave.length === 44 && !isLoading && (
            <span className="text-[10px] text-green-500 font-bold flex items-center gap-1 animate-pulse">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" /> Pronto para consultar
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
