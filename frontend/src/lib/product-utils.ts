import { formatCurrency } from './utils';

interface Produto {
  pricingMode: 'SIMPLE_AREA' | 'SIMPLE_UNIT' | 'DYNAMIC_ENGINEER';
  salePrice?: number;
}

export const formatarTipoPrecificacao = (produto: Produto): string => {
  switch (produto.pricingMode) {
    case 'SIMPLE_AREA':
      return 'Preço por m²';
    case 'SIMPLE_UNIT':
      return 'Preço por unidade';
    case 'DYNAMIC_ENGINEER':
      return 'Preço Dinâmico';
    default:
      return 'Preço Dinâmico';
  }
};

export const formatarExibicaoPreco = (produto: Produto): string => {
  const tipoTexto = formatarTipoPrecificacao(produto);
  
  if (!produto.salePrice) {
    return tipoTexto;
  }
  
  let unidade = '';
  switch (produto.pricingMode) {
    case 'SIMPLE_AREA':
      unidade = '/m²';
      break;
    case 'SIMPLE_UNIT':
      unidade = '/un';
      break;
    default:
      unidade = '';
  }
  
  return `${tipoTexto} • ${formatCurrency(produto.salePrice)}${unidade}`;
};