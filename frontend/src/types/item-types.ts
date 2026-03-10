// ==========================================
// TIPOS E ENUMS PARA ENGENHARIA DE PRODUTO
// ==========================================

export enum ItemType {
    PRODUCT = 'PRODUCT',      // Produto Padrão/Revenda
    SERVICE = 'SERVICE',      // Arte/Mão de Obra/Design
    PRINT_SHEET = 'PRINT_SHEET', // Impressão em Papel (A4, A3, etc)
    PRINT_ROLL = 'PRINT_ROLL',   // Impressão em Rolo (Banner, Adesivo)
    LASER_CUT = 'LASER_CUT',      // Corte a Laser/Gravação
    UNIT = 'UNIT',            // Unidade (Uni)
    SQUARE_METER = 'SQUARE_METER', // Metro Quadrado (m²)
    TIME_AREA = 'TIME_AREA'   // Tempo + Área
}

export interface ItemTypeConfig {
    value: ItemType;
    label: string;
    description: string;
    icon: string;
    color: string;
    requiresDimensions: boolean;
    showMaterialSelector: boolean;
    showFinishingSelector: boolean;
}

export const ITEM_TYPE_CONFIGS: Record<ItemType, ItemTypeConfig> = {
    [ItemType.UNIT]: {
        value: ItemType.UNIT,
        label: 'Unidade',
        description: 'Venda por unidade simples',
        icon: '🔢',
        color: 'gray',
        requiresDimensions: false,
        showMaterialSelector: false,
        showFinishingSelector: false
    },
    [ItemType.SQUARE_METER]: {
        value: ItemType.SQUARE_METER,
        label: 'Metro Quadrado',
        description: 'Venda por área (m²)',
        icon: '📐',
        color: 'indigo',
        requiresDimensions: true,
        showMaterialSelector: false,
        showFinishingSelector: false
    },
    [ItemType.TIME_AREA]: {
        value: ItemType.TIME_AREA,
        label: 'Tempo + Área',
        description: 'Corte CNC / Laser com material',
        icon: '⏱️',
        color: 'orange',
        requiresDimensions: true, // Para calcular material
        showMaterialSelector: false,
        showFinishingSelector: false
    },
    [ItemType.SERVICE]: {
        value: ItemType.SERVICE,
        label: 'Serviço/Arte',
        description: 'Design, criação de arte, mão de obra',
        icon: '🎨',
        color: 'blue',
        requiresDimensions: false,
        showMaterialSelector: false,
        showFinishingSelector: false
    },
    [ItemType.PRINT_SHEET]: {
        value: ItemType.PRINT_SHEET,
        label: 'Impressão Folha',
        description: 'Cartões, flyers, folhetos em papel',
        icon: '📄',
        color: 'green',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: true
    },
    [ItemType.PRINT_ROLL]: {
        value: ItemType.PRINT_ROLL,
        label: 'Impressão Rolo',
        description: 'Banners, adesivos, lonas',
        icon: '🖨️',
        color: 'purple',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: true
    },
    [ItemType.LASER_CUT]: {
        value: ItemType.LASER_CUT,
        label: 'Corte Laser',
        description: 'Corte e gravação a laser',
        icon: '⚡',
        color: 'red',
        requiresDimensions: true,
        showMaterialSelector: true,
        showFinishingSelector: false
    },
    [ItemType.PRODUCT]: {
        value: ItemType.PRODUCT,
        label: 'Produto Pronto',
        description: 'Produtos acabados para revenda',
        icon: '📦',
        color: 'gray',
        requiresDimensions: false,
        showMaterialSelector: false,
        showFinishingSelector: false
    }
};

// Materiais mockados por tipo (substituir por API depois)
export const MATERIALS_BY_TYPE: Record<ItemType, Array<{ value: string, label: string, properties?: any }>> = {
    [ItemType.SERVICE]: [],
    [ItemType.PRINT_SHEET]: [
        { value: 'SULFITE_75', label: 'Sulfite 75g', properties: { weight: 75, type: 'paper' } },
        { value: 'SULFITE_90', label: 'Sulfite 90g', properties: { weight: 90, type: 'paper' } },
        { value: 'COUCHE_115', label: 'Couché 115g', properties: { weight: 115, type: 'coated' } },
        { value: 'COUCHE_150', label: 'Couché 150g', properties: { weight: 150, type: 'coated' } },
        { value: 'COUCHE_170', label: 'Couché 170g', properties: { weight: 170, type: 'coated' } },
        { value: 'CARTAO_250', label: 'Cartão 250g', properties: { weight: 250, type: 'cardboard' } },
        { value: 'CARTAO_300', label: 'Cartão 300g', properties: { weight: 300, type: 'cardboard' } }
    ],
    [ItemType.PRINT_ROLL]: [
        { value: 'LONA_440', label: 'Lona 440g', properties: { weight: 440, type: 'canvas' } },
        { value: 'LONA_520', label: 'Lona 520g', properties: { weight: 520, type: 'canvas' } },
        { value: 'VINIL_80', label: 'Vinil Adesivo 80g', properties: { weight: 80, type: 'vinyl' } },
        { value: 'VINIL_100', label: 'Vinil Adesivo 100g', properties: { weight: 100, type: 'vinyl' } },
        { value: 'MESH_270', label: 'Mesh 270g', properties: { weight: 270, type: 'mesh' } }
    ],
    [ItemType.LASER_CUT]: [
        { value: 'MDF_3MM', label: 'MDF 3mm', properties: { thickness: 3, type: 'wood' } },
        { value: 'MDF_6MM', label: 'MDF 6mm', properties: { thickness: 6, type: 'wood' } },
        { value: 'MDF_9MM', label: 'MDF 9mm', properties: { thickness: 9, type: 'wood' } },
        { value: 'ACRILICO_3MM', label: 'Acrílico 3mm', properties: { thickness: 3, type: 'acrylic' } },
        { value: 'ACRILICO_5MM', label: 'Acrílico 5mm', properties: { thickness: 5, type: 'acrylic' } },
        { value: 'COMPENSADO_3MM', label: 'Compensado 3mm', properties: { thickness: 3, type: 'plywood' } }
    ],
    [ItemType.PRODUCT]: [],
    [ItemType.UNIT]: [],
    [ItemType.SQUARE_METER]: [],
    [ItemType.TIME_AREA]: []
};

// Acabamentos por tipo
export const FINISHINGS_BY_TYPE: Record<ItemType, Array<{ value: string, label: string }>> = {
    [ItemType.SERVICE]: [],
    [ItemType.PRINT_SHEET]: [
        { value: 'NONE', label: 'Sem acabamento' },
        { value: 'LAMINACAO_FOSCA', label: 'Laminação Fosca' },
        { value: 'LAMINACAO_BRILHO', label: 'Laminação Brilho' },
        { value: 'VERNIZ_UV', label: 'Verniz UV' },
        { value: 'VERNIZ_LOCALIZADO', label: 'Verniz Localizado' },
        { value: 'CORTE_VINCO', label: 'Corte e Vinco' }
    ],
    [ItemType.PRINT_ROLL]: [
        { value: 'NONE', label: 'Sem acabamento' },
        { value: 'BAINHA', label: 'Bainha' },
        { value: 'ILHOS', label: 'Ilhós' },
        { value: 'BAINHA_ILHOS', label: 'Bainha + Ilhós' },
        { value: 'BASTAO', label: 'Bastão' }
    ],
    [ItemType.LASER_CUT]: [],
    [ItemType.PRODUCT]: [],
    [ItemType.UNIT]: [],
    [ItemType.SQUARE_METER]: [],
    [ItemType.TIME_AREA]: []
};

// Tamanhos padrão por tipo
export const STANDARD_SIZES_BY_TYPE: Record<ItemType, Array<{ value: string, label: string, width: number, height: number }>> = {
    [ItemType.SERVICE]: [],
    [ItemType.PRINT_SHEET]: [
        { value: 'A3', label: 'A3 (297 × 420mm)', width: 297, height: 420 },
        { value: 'A4', label: 'A4 (210 × 297mm)', width: 210, height: 297 },
        { value: 'A5', label: 'A5 (148 × 210mm)', width: 148, height: 210 },
        { value: 'CARTA', label: 'Carta (216 × 279mm)', width: 216, height: 279 },
        { value: 'OFICIO', label: 'Ofício (216 × 355mm)', width: 216, height: 355 },
        { value: 'CARTAO_VISITA', label: 'Cartão de Visita (90 × 50mm)', width: 90, height: 50 }
    ],
    [ItemType.PRINT_ROLL]: [
        { value: 'BANNER_1X1', label: 'Banner 1x1m', width: 1000, height: 1000 },
        { value: 'BANNER_2X1', label: 'Banner 2x1m', width: 2000, height: 1000 },
        { value: 'BANNER_3X1', label: 'Banner 3x1m', width: 3000, height: 1000 },
        { value: 'ADESIVO_A4', label: 'Adesivo A4', width: 210, height: 297 },
        { value: 'ADESIVO_A3', label: 'Adesivo A3', width: 297, height: 420 }
    ],
    [ItemType.LASER_CUT]: [
        { value: 'QUADRADO_10CM', label: 'Quadrado 10x10cm', width: 100, height: 100 },
        { value: 'RETANGULO_20X10', label: 'Retângulo 20x10cm', width: 200, height: 100 },
        { value: 'PLACA_30X20', label: 'Placa 30x20cm', width: 300, height: 200 }
    ],
    [ItemType.PRODUCT]: [],
    [ItemType.UNIT]: [],
    [ItemType.SQUARE_METER]: [],
    [ItemType.TIME_AREA]: []
};

export interface ItemFormData {
    itemType: ItemType;
    productId?: string;
    quantity: number;
    width?: number;
    height?: number;
    totalArea?: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    attributes: Record<string, any>;
}

export interface ItemPedido extends ItemFormData {
    id: string;
    product?: any;
}