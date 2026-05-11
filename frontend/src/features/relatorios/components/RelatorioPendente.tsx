import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface Props {
  title: string;
}

export function RelatorioPendente({ title }: Props) {
  return (
    <Card>
      <CardContent className="py-20 flex flex-col items-center justify-center text-center gap-3">
        <Construction className="w-12 h-12 text-amber-400 opacity-70" />
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Este relatório está em desenvolvimento e será disponibilizado em breve.
        </p>
      </CardContent>
    </Card>
  );
}
