import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

// Fatores de conversão de unidade de comprimento para milímetros (canônico)
const LENGTH_FACTORS_TO_MM: Record<string, number> = { mm: 1, cm: 10, m: 1000, in: 25.4 };

// Resolve a unidade de comprimento original que o usuário digitou para um item,
// lendo de attributes.dynamicVariables. Fallback para 'mm'.
export function getItemLengthUnit(item: { attributes?: any }): string {
  const dv = item?.attributes?.dynamicVariables || {};
  for (const key of Object.keys(dv)) {
    const unit = String(dv[key]?.unit || '').toLowerCase().trim();
    if (unit in LENGTH_FACTORS_TO_MM) return unit;
  }
  return 'mm';
}

// Converte um valor armazenado em mm para a unidade informada, formatando sem
// zeros à direita desnecessários (ex: 500mm em cm => "50").
export function formatLengthFromMm(valueMm: number, unit: string): string {
  const factor = LENGTH_FACTORS_TO_MM[unit] ?? 1;
  const converted = valueMm / factor;
  return Number(converted.toFixed(2)).toString().replace('.', ',');
}