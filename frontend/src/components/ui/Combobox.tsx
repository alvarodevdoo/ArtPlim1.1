import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  id: string;
  label: string;
  sublabel?: string; // Ex: Código da conta
}

interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
  triggerClassName?: string;
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Filtrar...",
  emptyMessage = "Nenhum resultado encontrado.",
  allowClear = false,
  clearLabel = "Remover Seleção",
  className,
  triggerClassName
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedOption = useMemo(() => 
    options.find(opt => opt.id === value), 
  [options, value]);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return options;

    const normalizedSearch = term.replace(/\D/g, '');

    return options.filter(opt => {
      const nameMatch = opt.label.toLowerCase().includes(term);
      const codeMatch = opt.sublabel?.toLowerCase().includes(term);
      
      // Busca numérica (para códigos de contas como 1.1.1.01)
      const normalizedCode = opt.sublabel?.replace(/\D/g, '') || '';
      const numericMatch = normalizedSearch && normalizedCode.includes(normalizedSearch);

      return nameMatch || codeMatch || numericMatch;
    });
  }, [options, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative w-full", className)}>
          <Button 
            variant="outline" 
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full h-11 justify-between bg-background font-normal text-sm border-border/60 hover:bg-muted/30 transition-all",
              !value && "text-muted-foreground",
              triggerClassName
            )}
          >
            <span className="truncate">
              {selectedOption 
                ? (selectedOption.sublabel ? `${selectedOption.sublabel} - ${selectedOption.label}` : selectedOption.label)
                : placeholder
              }
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </div>
      </PopoverTrigger>
      
      <PopoverContent className="p-0 w-[420px] max-w-[95vw] shadow-2xl border-border/50" align="start">
        <div className="flex items-center border-b px-3 bg-muted/20">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input 
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 border-0 focus-visible:ring-0 bg-transparent px-0"
          />
          {search && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 hover:bg-transparent" 
              onClick={() => setSearch('')}
            >
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </Button>
          )}
        </div>
        
        <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
          {allowClear && value && (
            <div 
              className="px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer rounded-md transition-colors"
              onClick={() => {
                onChange('');
                setOpen(false);
                setSearch('');
              }}
            >
              {clearLabel}
            </div>
          )}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.id}
                className={cn(
                  "flex items-center px-3 py-2.5 text-xs cursor-pointer rounded-md transition-colors font-medium",
                  value === opt.id ? "bg-primary/10 text-primary" : "hover:bg-primary/5 text-foreground/80 hover:text-foreground"
                )}
                onClick={() => {
                  onChange(opt.id);
                  setOpen(false);
                  setSearch('');
                }}
              >
                {opt.sublabel && <span className="mr-2 text-primary font-bold">{opt.sublabel}</span>}
                <span className="truncate">{opt.label}</span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground italic">
              {emptyMessage}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
