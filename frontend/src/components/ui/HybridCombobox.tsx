import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/Input';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HybridComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  emptyMessage?: string;
}

export const HybridCombobox: React.FC<HybridComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = "Selecione ou digite...",
  className,
  emptyMessage = "Digite para pesquisar ou criar..."
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative group", className)}>
          <Input 
            value={value} 
            onChange={e => {
              onChange(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onClick={(e) => {
              e.stopPropagation();
              if (!open) setOpen(true);
            }}
            onMouseDown={(e) => {
              if (open) e.stopPropagation();
            }}
            className="h-11 pr-10 border-border/60"
            placeholder={placeholder}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 group-hover:opacity-60 pointer-events-none transition-opacity">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-1 w-[240px] max-h-64 overflow-hidden flex flex-col shadow-2xl border-border/50" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto custom-scrollbar">
          {options.length > 0 ? (
            <>
              {options
                .filter(opt => opt.toLowerCase().includes(value.toLowerCase()))
                .map(opt => (
                  <div 
                    key={opt}
                    className="flex items-center px-3 py-2 text-xs hover:bg-primary/10 cursor-pointer rounded-md transition-colors font-medium"
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    {opt}
                  </div>
                ))}
              {options.filter(opt => opt.toLowerCase().includes(value.toLowerCase())).length === 0 && (
                 <div className="p-3 text-[10px] text-muted-foreground italic text-center">
                    "{value}" (Pressione Enter para criar)
                 </div>
              )}
            </>
          ) : (
            <div className="p-3 text-[10px] text-muted-foreground italic text-center">
              {emptyMessage}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
