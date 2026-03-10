import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import ModuleB from './ModuleB';
import ModuleC from './ModuleC';
import ProductRegistryUnified from './ProductRegistryUnified';

const PricingEngine: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'Product' | 'C' | 'Unified'>('Unified'); // Começa na nova aba para teste

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Motor de Precificação Dinâmico</h1>
                <p className="text-muted-foreground">
                    Protótipo funcional para precificação industrial baseada em fórmulas e custos unitários.
                </p>
            </div>

            <div className="flex space-x-2 border-b pb-4 overflow-x-auto">
                {[
                    { id: 'Unified', label: 'Catálogo de Produtos', color: 'bg-primary text-primary-foreground' },
                    { id: 'C', label: 'Simulador de Vendas', color: 'bg-green-600 text-white' },
                    { id: 'B', label: 'Configurações de Engenharia', color: 'bg-slate-600 text-white' },
                ].map((tab) => (
                    <Button
                        key={tab.id}
                        variant={activeTab === tab.id ? 'default' : 'outline'}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center space-x-2 ${activeTab === tab.id ? tab.color : 'text-muted-foreground'}`}
                    >
                        <span>{tab.label}</span>
                    </Button>
                ))}
            </div>

            <div className="mt-6">
                {activeTab === 'Unified' && <ProductRegistryUnified />}
                {activeTab === 'C' && <ModuleC />}
                {activeTab === 'B' && <ModuleB />}
            </div>
        </div>
    );
};

export default PricingEngine;
