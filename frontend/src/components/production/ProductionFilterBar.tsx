import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

interface ProductionFilterBarProps {
  assignedUserId: string;
  onFilterChange: (userId: string) => void;
}

export const ProductionFilterBar: React.FC<ProductionFilterBarProps> = ({
  assignedUserId,
  onFilterChange
}) => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await api.get('/api/profiles?isEmployee=true');
        if (response.data.success) {
          setEmployees(response.data.data);
        }
      } catch (error) {
        console.error('Erro ao buscar funcionários:', error);
      }
    };
    fetchEmployees();
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={assignedUserId === user?.id ? "default" : "outline"}
        onClick={() => onFilterChange(assignedUserId === user?.id ? '' : user?.id || '')}
        className="gap-2"
      >
        <UserCheck className="w-4 h-4" />
        Meus Serviços
      </Button>

      <Select value={assignedUserId} onValueChange={onFilterChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Filtrar por Colaborador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos</SelectItem>
          {employees.map(emp => (
            <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProductionFilterBar;
