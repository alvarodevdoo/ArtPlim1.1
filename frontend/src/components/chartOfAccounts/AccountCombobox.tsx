import React, { useState, useEffect, useRef } from 'react';
import styles from './AccountCombobox.module.scss';
import { api } from '@/lib/api';

export interface AccountOption {
  id: string;
  name: string;
  description?: string;
  nature: string;
  type: string;
}

interface AccountComboboxProps {
  value: string;
  onChange: (value: string, isNew: boolean, newName?: string) => void;
  error?: string;
  placeholder?: string;
}

export const AccountCombobox: React.FC<AccountComboboxProps> = ({ value, onChange, placeholder = 'Busque ou crie uma categoria (ex: Internet)' }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      setLoading(true);
      try {
        const response = await api.get('/api/finance/v2/chart-of-accounts');
        const flatList: AccountOption[] = [];
        const flatten = (arr: any[]) => {
          arr.forEach(item => {
            flatList.push(item);
            if (item.children && item.children.length > 0) {
              flatten(item.children);
            }
          });
        };
        flatten(response.data.data || []);
        // Only allow selecting ANALYTIC accounts ideally, but for now we suggest all. 
        // We will restrict in form side if we need to.
        setOptions(flatList);
      } catch (e) {
        console.error("Falha ao buscar contas", e);
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  useEffect(() => {
    if (value && options.length > 0 && !isOpen) {
      const selected = options.find(o => o.id === value);
      if (selected) setQuery(selected.name);
    }
  }, [value, options, isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    o.name.toLowerCase().includes(query.toLowerCase()) || 
    (o.description && o.description.toLowerCase().includes(query.toLowerCase()))
  );

  const handleSelect = (option: AccountOption) => {
    setQuery(option.name);
    setIsOpen(false);
    onChange(option.id, false);
  };

  const handleCreate = () => {
    setIsOpen(false);
    onChange('', true, query);
  };

  return (
    <div className={styles.container} ref={wrapperRef}>
      <div className={styles.inputWrapper}>
        <input 
          type="text" 
          className={styles.input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (e.target.value === '') {
               onChange('', false);
            }
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
        />
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          {loading && <div className={styles.loader}>Buscando sugestões...</div>}
          
          {!loading && filteredOptions.map(option => (
            <div key={option.id} className={styles.option} onClick={() => handleSelect(option)}>
              <div className={styles.optionName}>{option.name}</div>
              {option.description && <div className={styles.optionDesc}>{option.description}</div>}
            </div>
          ))}

          {!loading && query && !filteredOptions.some(o => o.name.toLowerCase() === query.toLowerCase()) && (
            <div className={styles.creatableOption} onClick={handleCreate}>
              <span>+ Criar nova categoria "{query}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
