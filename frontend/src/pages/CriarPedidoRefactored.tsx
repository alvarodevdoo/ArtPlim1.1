import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import {
    Search,
    Save,
    ArrowLeft,
    User,
    DollarSign,
    Calendar,
    FileText,
    AlertTriangle,
    CheckCircle,
    Trash2,
    Edit,
    Plus,
    UserX,
    Receipt,
    Package,
    Palette,
    Scissors,
    Zap
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import AddItemFormRefactored from '@/components/pedidos/AddItemFormRefactored';
import { ItemType, ITEM_TYPE_CONFIGS, ItemPedido } from '@/types/item-types';

interface Cliente {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    document?: string;
}

interface Produto {
    id: string;
    name: string;
    description?: string;
    pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
    salePrice?: number;
    minPrice?: number;
}

const CriarPedidoRefactored: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditing = !!editId;
    const [loading, setLoading] = useState(false);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [produtos, setProdutos] = useState<Produto[]>([]);

    // Refs para controlar dropdowns
    const clienteDropdownRef = useRef<HTMLDivElement>(null);

    // Dados do pedido
    const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

    return (
        <div>
            <h1>Criar Pedido Refatorado</h1>
            <p>Esta página está em desenvolvimento.</p>
        </div>
    );
};

export default CriarPedidoRefactored;