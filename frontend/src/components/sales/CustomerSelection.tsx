import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { User, Search, CheckCircle, UserX, Receipt } from 'lucide-react';
import { Cliente } from '@/types/sales';

interface CustomerSelectionProps {
    selectedCustomer: Cliente | null;
    onSelect: (customer: Cliente) => void;
    onClear: () => void;
    customers: Cliente[];
    loading: boolean;
}

export const CustomerSelection: React.FC<CustomerSelectionProps> = ({
    selectedCustomer,
    onSelect,
    onClear,
    customers,
    loading
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Update search term when a customer is selected (to show name in input if logic requires, 
    // currently we switch UI modes so search term is for searching)

    const filteredCustomers = customers.filter(customer =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.document && customer.document.includes(searchTerm))
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showDropdown && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowDropdown(false);
        };

        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showDropdown]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Cliente</span>
                </CardTitle>
                <CardDescription>
                    {selectedCustomer ? 'Cliente selecionado para este pedido' : 'Selecione o cliente para este pedido'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Campo de busca - só mostra se não tiver cliente selecionado */}
                    {!selectedCustomer && (
                        <div className="relative" ref={dropdownRef}>
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder={loading ? "Carregando clientes..." : "Buscar cliente por nome ou documento..."}
                                value={searchTerm}
                                disabled={loading}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (!showDropdown) setShowDropdown(true);
                                }}
                                onFocus={() => setShowDropdown(true)}
                                className="pl-10"
                            />

                            {showDropdown && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                    {filteredCustomers.length > 0 ? (
                                        filteredCustomers.map(customer => (
                                            <div
                                                key={customer.id}
                                                className="p-3 hover:bg-gray-100 cursor-pointer border-b border-gray-200 last:border-b-0"
                                                onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(customer);
                                                    setSearchTerm(customer.name);
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <div className="font-medium">{customer.name}</div>
                                                {customer.document && (
                                                    <div className="text-sm text-gray-500">{customer.document}</div>
                                                )}
                                                {customer.phone && (
                                                    <div className="text-sm text-gray-500">{customer.phone}</div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-3 text-gray-500 text-center">
                                            {loading ? (
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                                    <span>Carregando clientes...</span>
                                                </div>
                                            ) : customers.length === 0 ? (
                                                'Nenhum cliente cadastrado'
                                            ) : (
                                                'Nenhum cliente encontrado'
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tarja verde com cliente selecionado */}
                    {selectedCustomer && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="font-medium text-green-800">{selectedCustomer.name}</p>
                                        <p className="text-sm text-green-600">
                                            {selectedCustomer.email ? `${selectedCustomer.email} • ` : ''}{selectedCustomer.phone}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            onClear();
                                            setSearchTerm('');
                                        }}
                                        className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800"
                                        title="Trocar Cliente"
                                    >
                                        <UserX className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="bg-white hover:bg-green-100 border-green-300 text-green-700 hover:text-green-800"
                                        title="Dados para Faturamento"
                                    >
                                        <Receipt className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
