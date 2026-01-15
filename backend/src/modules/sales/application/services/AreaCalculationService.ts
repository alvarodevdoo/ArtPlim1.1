/**
 * AreaCalculationService - Serviço para cálculos automáticos de área
 * 
 * Este serviço implementa os cálculos de área baseados nas dimensões dos itens,
 * convertendo de milímetros para metros quadrados e calculando áreas totais.
 * 
 * Requirements: 2.3, 9.1, 9.2, 9.3
 */

export interface AreaCalculationResult {
    area: number;        // Área unitária em m²
    totalArea: number;   // Área total (área × quantidade) em m²
    width: number;       // Largura em mm
    height: number;      // Altura em mm
    quantity: number;    // Quantidade
}

export interface DimensionInput {
    width: number;       // Largura em mm
    height: number;      // Altura em mm
    quantity: number;    // Quantidade de itens
}

export class AreaCalculationService {

    /**
     * Calcula área em m² a partir de largura e altura em mm
     * Requirements: 9.1 - Calcular área em m² a partir de largura e altura em mm
     * 
     * @param width Largura em milímetros
     * @param height Altura em milímetros
     * @returns Área em metros quadrados
     */
    calculateArea(width: number, height: number): number {
        this.validateDimensions(width, height);

        // Converter de mm² para m²
        // 1 m² = 1,000,000 mm²
        return (width * height) / 1_000_000;
    }

    /**
     * Calcula área total multiplicando por quantidade
     * Requirements: 9.2 - Calcular área total multiplicando por quantidade
     * 
     * @param area Área unitária em m²
     * @param quantity Quantidade de itens
     * @returns Área total em metros quadrados
     */
    calculateTotalArea(area: number, quantity: number): number {
        this.validateAreaAndQuantity(area, quantity);

        return area * quantity;
    }

    /**
     * Calcula área e área total a partir das dimensões e quantidade
     * Requirements: 9.3 - Atualizar área automaticamente quando dimensões mudam
     * 
     * @param input Dados de entrada com dimensões e quantidade
     * @returns Resultado completo do cálculo
     */
    calculateAreaFromDimensions(input: DimensionInput): AreaCalculationResult {
        this.validateDimensions(input.width, input.height);
        this.validateQuantity(input.quantity);

        const area = this.calculateArea(input.width, input.height);
        const totalArea = this.calculateTotalArea(area, input.quantity);

        return {
            area,
            totalArea,
            width: input.width,
            height: input.height,
            quantity: input.quantity
        };
    }

    /**
     * Atualiza cálculos quando dimensões ou quantidade mudam
     * Requirements: 9.3 - Atualizar área automaticamente quando dimensões mudam
     * 
     * @param currentResult Resultado atual dos cálculos
     * @param newWidth Nova largura (opcional)
     * @param newHeight Nova altura (opcional)
     * @param newQuantity Nova quantidade (opcional)
     * @returns Resultado atualizado
     */
    updateAreaCalculation(
        currentResult: AreaCalculationResult,
        newWidth?: number,
        newHeight?: number,
        newQuantity?: number
    ): AreaCalculationResult {
        const width = newWidth ?? currentResult.width;
        const height = newHeight ?? currentResult.height;
        const quantity = newQuantity ?? currentResult.quantity;

        return this.calculateAreaFromDimensions({ width, height, quantity });
    }

    /**
     * Converte área de mm² para m²
     * Função utilitária para conversões diretas
     * 
     * @param areaInMm2 Área em milímetros quadrados
     * @returns Área em metros quadrados
     */
    convertMm2ToM2(areaInMm2: number): number {
        if (areaInMm2 < 0) {
            throw new Error('Area in mm² must be non-negative');
        }

        return areaInMm2 / 1_000_000;
    }

    /**
     * Converte área de m² para mm²
     * Função utilitária para conversões inversas
     * 
     * @param areaInM2 Área em metros quadrados
     * @returns Área em milímetros quadrados
     */
    convertM2ToMm2(areaInM2: number): number {
        if (areaInM2 < 0) {
            throw new Error('Area in m² must be non-negative');
        }

        return areaInM2 * 1_000_000;
    }

    /**
     * Formata área para exibição amigável
     * Requirements: 9.4 - Exibir área em formato amigável
     * 
     * @param areaInM2 Área em metros quadrados
     * @param decimals Número de casas decimais (padrão: 4)
     * @returns String formatada com unidade
     */
    formatAreaForDisplay(areaInM2: number, decimals: number = 4): string {
        if (areaInM2 < 0) {
            throw new Error('Area must be non-negative for display');
        }

        // Para áreas muito pequenas, mostrar em cm²
        if (areaInM2 < 0.01) {
            const areaInCm2 = areaInM2 * 10_000;
            return `${areaInCm2.toFixed(2)} cm²`;
        }

        // Para áreas normais, mostrar em m²
        return `${areaInM2.toFixed(decimals)} m²`;
    }

    /**
     * Calcula preço baseado em área (para produtos vendidos por m²)
     * 
     * @param areaInM2 Área em metros quadrados
     * @param pricePerM2 Preço por metro quadrado
     * @returns Preço total
     */
    calculatePriceByArea(areaInM2: number, pricePerM2: number): number {
        if (areaInM2 < 0) {
            throw new Error('Area must be non-negative');
        }
        if (pricePerM2 < 0) {
            throw new Error('Price per m² must be non-negative');
        }

        return areaInM2 * pricePerM2;
    }

    /**
     * Valida dimensões de entrada
     * 
     * @param width Largura em mm
     * @param height Altura em mm
     */
    private validateDimensions(width: number, height: number): void {
        if (typeof width !== 'number' || !isFinite(width) || width <= 0) {
            throw new Error('Width must be a positive finite number');
        }
        if (typeof height !== 'number' || !isFinite(height) || height <= 0) {
            throw new Error('Height must be a positive finite number');
        }
    }

    /**
     * Valida área e quantidade
     * 
     * @param area Área em m²
     * @param quantity Quantidade
     */
    private validateAreaAndQuantity(area: number, quantity: number): void {
        if (typeof area !== 'number' || !isFinite(area) || area <= 0) {
            throw new Error('Area must be a positive finite number');
        }
        this.validateQuantity(quantity);
    }

    /**
     * Valida quantidade
     * 
     * @param quantity Quantidade
     */
    private validateQuantity(quantity: number): void {
        if (typeof quantity !== 'number' || !isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
            throw new Error('Quantity must be a positive integer');
        }
    }

    /**
     * Obtém informações sobre os cálculos realizados
     * Útil para debugging e logs
     * 
     * @param result Resultado do cálculo
     * @returns Informações detalhadas
     */
    getCalculationInfo(result: AreaCalculationResult): string {
        return [
            `Dimensions: ${result.width}mm × ${result.height}mm`,
            `Unit Area: ${this.formatAreaForDisplay(result.area)}`,
            `Quantity: ${result.quantity}`,
            `Total Area: ${this.formatAreaForDisplay(result.totalArea)}`
        ].join(' | ');
    }
}