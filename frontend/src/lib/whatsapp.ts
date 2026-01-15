interface WhatsAppMessageOptions {
  phone: string;
  message: string;
}

interface OrderWhatsAppOptions {
  customerName: string;
  customerPhone: string;
  orderNumber: string;
  total: number;
  status: string;
  validUntil?: string;
}

export class WhatsAppService {
  private static formatPhone(phone: string): string {
    // Remove todos os caracteres não numéricos
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Se não começar com 55 (código do Brasil), adiciona
    if (!cleanPhone.startsWith('55')) {
      return `55${cleanPhone}`;
    }
    
    return cleanPhone;
  }

  private static formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  private static formatDate(date: string): string {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  static sendMessage({ phone, message }: WhatsAppMessageOptions): void {
    const formattedPhone = this.formatPhone(phone);
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  }

  static sendOrderUpdate(options: OrderWhatsAppOptions): void {
    const statusMessages = {
      'DRAFT': 'Seu orçamento foi criado',
      'APPROVED': 'Seu pedido foi aprovado',
      'IN_PRODUCTION': 'Seu pedido entrou em produção',
      'FINISHED': 'Seu pedido foi finalizado',
      'DELIVERED': 'Seu pedido foi entregue',
      'CANCELLED': 'Seu pedido foi cancelado'
    };

    const statusMessage = statusMessages[options.status as keyof typeof statusMessages] || 'Status atualizado';
    
    let message = `Olá ${options.customerName}! 👋\n\n`;
    message += `${statusMessage}!\n\n`;
    message += `📋 *Pedido:* ${options.orderNumber}\n`;
    message += `💰 *Valor:* ${this.formatCurrency(options.total)}\n`;
    
    if (options.status === 'DRAFT' && options.validUntil) {
      message += `⏰ *Válido até:* ${this.formatDate(options.validUntil)}\n`;
      message += `\n💡 *Aprove seu orçamento o quanto antes para garantir o prazo de entrega!*`;
    } else if (options.status === 'APPROVED') {
      message += `\n✅ *Seu pedido foi confirmado e entrará em produção em breve.*`;
    } else if (options.status === 'IN_PRODUCTION') {
      message += `\n🏭 *Seu pedido está sendo produzido com todo cuidado.*`;
    } else if (options.status === 'FINISHED') {
      message += `\n🎉 *Seu pedido está pronto! Entraremos em contato para agendar a entrega.*`;
    } else if (options.status === 'DELIVERED') {
      message += `\n🚚 *Obrigado pela confiança! Esperamos você em breve.*`;
    }
    
    message += `\n\nQualquer dúvida, estamos aqui para ajudar! 😊`;

    this.sendMessage({
      phone: options.customerPhone,
      message
    });
  }

  static sendQuoteReminder(options: OrderWhatsAppOptions): void {
    let message = `Olá ${options.customerName}! 👋\n\n`;
    message += `Lembrando que seu orçamento está próximo do vencimento:\n\n`;
    message += `📋 *Pedido:* ${options.orderNumber}\n`;
    message += `💰 *Valor:* ${this.formatCurrency(options.total)}\n`;
    
    if (options.validUntil) {
      message += `⏰ *Válido até:* ${this.formatDate(options.validUntil)}\n`;
    }
    
    message += `\n⚠️ *Aprove seu orçamento hoje para não perder essa oportunidade!*`;
    message += `\n\nQualquer dúvida, estamos aqui para ajudar! 😊`;

    this.sendMessage({
      phone: options.customerPhone,
      message
    });
  }

  static sendCustomMessage(phone: string, customerName: string, customMessage: string): void {
    let message = `Olá ${customerName}! 👋\n\n`;
    message += customMessage;
    message += `\n\nQualquer dúvida, estamos aqui para ajudar! 😊`;

    this.sendMessage({
      phone,
      message
    });
  }

  static sendPaymentReminder(options: OrderWhatsAppOptions & { daysOverdue: number }): void {
    let message = `Olá ${options.customerName}! 👋\n\n`;
    message += `Identificamos que o pagamento do seu pedido está em atraso:\n\n`;
    message += `📋 *Pedido:* ${options.orderNumber}\n`;
    message += `💰 *Valor:* ${this.formatCurrency(options.total)}\n`;
    message += `📅 *Dias em atraso:* ${options.daysOverdue}\n`;
    message += `\n💳 *Por favor, regularize o pagamento para evitar juros e multas.*`;
    message += `\n\nEstamos à disposição para negociar! 😊`;

    this.sendMessage({
      phone: options.customerPhone,
      message
    });
  }
}

// Função auxiliar para usar nos componentes
export const sendWhatsAppMessage = (phone: string, message: string) => {
  WhatsAppService.sendMessage({ phone, message });
};

export const sendOrderWhatsApp = (options: OrderWhatsAppOptions) => {
  WhatsAppService.sendOrderUpdate(options);
};