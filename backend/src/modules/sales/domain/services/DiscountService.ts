import { AppError } from '../../../../shared/infrastructure/errors/AppError';

export interface DiscountItemInput {
  id: string;
  unitPrice: number;
  quantity: number;
  discountItem: number;
  discountStatus?: string;
}

export interface DiscountServiceInput {
  items: DiscountItemInput[];
  globalDiscount: number;
  maxDiscountThreshold: number; // e.g., 0.15 for 15%
  globalDiscountStatus?: string;
}

export interface DiscountItemOutput extends DiscountItemInput {
  discountGlobal: number;
  totalDiscount: number;
  netPrice: number; // grossValue - totalDiscount
}

export class DiscountService {
  execute(input: DiscountServiceInput): DiscountItemOutput[] {
    const { items, globalDiscount, maxDiscountThreshold } = input;

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.unitPrice * item.quantity;
    }

    if (globalDiscount > subtotal) {
      throw new AppError('O desconto global não pode ser maior que o subtotal do pedido.', 400);
    }

    let remainingGlobalDiscount = globalDiscount;
    let maxItemIndex = 0;
    let maxItemGrossValue = -1;

    const outputs: DiscountItemOutput[] = items.map((item, index) => {
      const grossValue = item.unitPrice * item.quantity;

      if (grossValue > maxItemGrossValue) {
        maxItemGrossValue = grossValue;
        maxItemIndex = index;
      }

      // Pro-rata (rounding to 2 decimals early to avoid floating point issues later)
      const proportion = subtotal > 0 ? grossValue / subtotal : 0;
      const discountGlobal = Math.round(globalDiscount * proportion * 100) / 100;
      remainingGlobalDiscount -= discountGlobal;

      return {
        ...item,
        discountGlobal,
        totalDiscount: 0,
        netPrice: 0
      };
    });

    // Handle rounding issues on the item with the largest gross value
    // Ensure we don't have JavaScript precision issues (e.g., 0.00000001)
    remainingGlobalDiscount = Math.round(remainingGlobalDiscount * 100) / 100;
    if (Math.abs(remainingGlobalDiscount) > 0 && items.length > 0) {
       outputs[maxItemIndex].discountGlobal += remainingGlobalDiscount;
       outputs[maxItemIndex].discountGlobal = Math.round(outputs[maxItemIndex].discountGlobal * 100) / 100;
    }

    // Validation (Trava de segurança) & Net Price calculation
    for (const output of outputs) {
      const grossValue = output.unitPrice * output.quantity;
      const totalDiscount = output.discountItem + output.discountGlobal;
      
      if (grossValue > 0) {
        if (totalDiscount > grossValue) {
          throw new AppError(`O desconto total de ${totalDiscount} no item excede o valor bruto de ${grossValue}.`, 400);
        }
        
        const isAuthorized = output.discountStatus === 'PENDING' || output.discountStatus === 'APPROVED' || 
                             input.globalDiscountStatus === 'PENDING' || input.globalDiscountStatus === 'APPROVED';

        if (!isAuthorized) {
          const discountPercentage = totalDiscount / grossValue;
          if (discountPercentage > maxDiscountThreshold) {
            throw new AppError(`O desconto total de ${(discountPercentage * 100).toFixed(2)}% em um dos itens excede o teto permitido de ${(maxDiscountThreshold * 100).toFixed(2)}%.`, 400);
          }
        }
      }

      output.totalDiscount = totalDiscount;
      output.netPrice = grossValue - totalDiscount;
    }

    return outputs;
  }
}
