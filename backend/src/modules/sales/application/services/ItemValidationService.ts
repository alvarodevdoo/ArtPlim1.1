/**
 * ItemValidationService - Serviço de validação específica por tipo de produto
 * 
 * Este serviço implementa validações específicas baseadas no ItemType,
 * garantindo que cada tipo de produto tenha seus campos obrigatórios
 * e estrutura de atributos JSON validada corretamente.
 */

import { ItemType } from '@prisma/client';

// Interfaces para validação
export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

export interface ItemValidationData {
    itemType: ItemType;
    width?: number;
    height?: number;
    quantity: number;
    attributes?: any;
    productId: string;
}

// Schemas de validação por tipo
interface ServiceAttributes {
    description: string;
    briefing?: string;
    estimatedHours?: number;
    skillLevel?: 'basic' | 'intermediate' | 'advanced';
}

interface PrintSheetAttributes {
    paperSize: string;
    paperType: string;
    printColors: string;
    finishing?: string;
    sides?: 'front' | 'both';
}

interface PrintRollAttributes {
    material: string;
    finishes?: string[];
    installationType?: 'indoor' | 'outdoor';
    windResistance?: boolean;
}

interface LaserCutAttributes {
    material: string;
    machineTimeMinutes?: number;
    vectorFile?: string;
    cutType?: 'cut' | 'engrave' | 'both';
    thickness?: number;
}

export class ItemValidationService {

    /**
     * Valida um item baseado no seu tipo
     */
    validateByType(data: ItemValidationData): ValidationResult {
        const errors: ValidationError[] = [];

        // Validações básicas comuns
        this.validateBasicFields(data, errors);

        // Validações específicas por tipo
        switch (data.itemType) {
            case ItemType.SERVICE:
                this.validateServiceType(data, errors);
                break;
            case ItemType.PRINT_SHEET:
                this.validatePrintSheetType(data, errors);
                break;
            case ItemType.PRINT_ROLL:
                this.validatePrintRollType(data, errors);
                break;
            case ItemType.LASER_CUT:
                this.validateLaserCutType(data, errors);
                break;
            case ItemType.PRODUCT:
                this.validateProductType(data, errors);
                break;
            case ItemType.UNIT:
                this.validateUnitType(data, errors);
                break;
            case ItemType.SQUARE_METER:
                this.validateSquareMeterType(data, errors);
                break;
            case ItemType.TIME_AREA:
                this.validateTimeAreaType(data, errors);
                break;
            default:
                errors.push({
                    field: 'itemType',
                    message: 'Invalid item type provided',
                    code: 'INVALID_ITEM_TYPE'
                });
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Validações básicas aplicáveis a todos os tipos
     */
    private validateBasicFields(data: ItemValidationData, errors: ValidationError[]): void {
        // Validar productId
        if (!data.productId || data.productId.trim().length === 0) {
            errors.push({
                field: 'productId',
                message: 'Product ID is required',
                code: 'REQUIRED_FIELD'
            });
        }

        // Validar quantity
        if (!data.quantity || data.quantity <= 0) {
            errors.push({
                field: 'quantity',
                message: 'Quantity must be greater than zero',
                code: 'INVALID_QUANTITY'
            });
        }

        // Validar ItemType
        if (!Object.values(ItemType).includes(data.itemType)) {
            errors.push({
                field: 'itemType',
                message: 'Invalid ItemType value',
                code: 'INVALID_ENUM_VALUE'
            });
        }
    }

    /**
     * Validações específicas para SERVICE
     * Requirements: 7.1 - SERVICE não requer width e height
     */
    private validateServiceType(data: ItemValidationData, errors: ValidationError[]): void {
        // SERVICE não deve ter dimensões obrigatórias
        // Mas se tiver attributes, deve validar a estrutura
        if (data.attributes !== undefined && data.attributes !== null) {
            this.validateServiceAttributes(data.attributes, errors);
        }
    }

    /**
     * Validações específicas para PRINT_SHEET
     * Requirements: 7.2 - Tipos dimensionais requerem width e height > 0
     */
    private validatePrintSheetType(data: ItemValidationData, errors: ValidationError[]): void {
        this.validateDimensionalFields(data, errors);

        if (data.attributes !== undefined && data.attributes !== null) {
            this.validatePrintSheetAttributes(data.attributes, errors);
        }
    }

    /**
     * Validações específicas para PRINT_ROLL
     * Requirements: 7.2 - Tipos dimensionais requerem width e height > 0
     */
    private validatePrintRollType(data: ItemValidationData, errors: ValidationError[]): void {
        this.validateDimensionalFields(data, errors);

        if (data.attributes !== undefined && data.attributes !== null) {
            this.validatePrintRollAttributes(data.attributes, errors);
        }
    }

    /**
     * Validações específicas para LASER_CUT
     * Requirements: 7.2 - Tipos dimensionais requerem width e height > 0
     */
    private validateLaserCutType(data: ItemValidationData, errors: ValidationError[]): void {
        this.validateDimensionalFields(data, errors);

        if (data.attributes !== undefined && data.attributes !== null) {
            this.validateLaserCutAttributes(data.attributes, errors);
        }
    }

    /**
     * Validações específicas para PRODUCT (tipo padrão)
     */
    private validateProductType(data: ItemValidationData, errors: ValidationError[]): void {
        // PRODUCT pode ter dimensões opcionais
        if (data.width !== undefined || data.height !== undefined) {
            this.validateDimensionalFields(data, errors);
        }
    }

    /**
     * Validações específicas para UNIT (similar a PRODUCT)
     */
    private validateUnitType(data: ItemValidationData, errors: ValidationError[]): void {
        // UNIT tipicamente não requer dimensões
        if (data.width !== undefined || data.height !== undefined) {
            this.validateDimensionalFields(data, errors);
        }
    }

    /**
     * Validações específicas para SQUARE_METER (requer dimensões)
     */
    private validateSquareMeterType(data: ItemValidationData, errors: ValidationError[]): void {
        this.validateDimensionalFields(data, errors);
    }

    /**
     * Validações específicas para TIME_AREA (requer dimensões e atributos de tempo)
     */
    private validateTimeAreaType(data: ItemValidationData, errors: ValidationError[]): void {
        // Requer width e height para calcular área do material
        this.validateDimensionalFields(data, errors);

        if (data.attributes !== undefined && data.attributes !== null) {
            this.validateTimeAreaAttributes(data.attributes, errors);
        }
    }

    /**
     * Valida atributos específicos do tipo TIME_AREA
     */
    private validateTimeAreaAttributes(attributes: any, errors: ValidationError[]): void {
        if (typeof attributes !== 'object' || attributes === null) {
            errors.push({
                field: 'attributes',
                message: 'TIME_AREA attributes must be a valid object',
                code: 'INVALID_ATTRIBUTES_STRUCTURE'
            });
            return;
        }

        // machineTimeMinutes opcional, mas se vier deve ser numero positivo
        if (attributes.machineTimeMinutes !== undefined && (typeof attributes.machineTimeMinutes !== 'number' || attributes.machineTimeMinutes <= 0)) {
            errors.push({
                field: 'attributes.machineTimeMinutes',
                message: 'Machine time must be a positive number',
                code: 'INVALID_NUMBER_VALUE'
            });
        }
    }

    /**
     * Valida campos dimensionais (width e height)
     * Requirements: 7.2 - Valores devem ser maiores que zero
     */
    private validateDimensionalFields(data: ItemValidationData, errors: ValidationError[]): void {
        if (!data.width || data.width <= 0) {
            errors.push({
                field: 'width',
                message: 'Width is required and must be greater than zero for dimensional products',
                code: 'REQUIRED_DIMENSION'
            });
        }

        if (!data.height || data.height <= 0) {
            errors.push({
                field: 'height',
                message: 'Height is required and must be greater than zero for dimensional products',
                code: 'REQUIRED_DIMENSION'
            });
        }
    }

    /**
     * Valida atributos específicos do tipo SERVICE
     */
    private validateServiceAttributes(attributes: any, errors: ValidationError[]): void {
        if (typeof attributes !== 'object' || attributes === null) {
            errors.push({
                field: 'attributes',
                message: 'SERVICE attributes must be a valid object',
                code: 'INVALID_ATTRIBUTES_STRUCTURE'
            });
            return;
        }

        // description é obrigatório para SERVICE
        if (!attributes.description || typeof attributes.description !== 'string' || attributes.description.trim().length === 0) {
            errors.push({
                field: 'attributes.description',
                message: 'Description is required for SERVICE items',
                code: 'REQUIRED_SERVICE_FIELD'
            });
        }

        // Validar skillLevel se fornecido
        if (attributes.skillLevel && !['basic', 'intermediate', 'advanced'].includes(attributes.skillLevel)) {
            errors.push({
                field: 'attributes.skillLevel',
                message: 'Skill level must be basic, intermediate, or advanced',
                code: 'INVALID_ENUM_VALUE'
            });
        }

        // Validar estimatedHours se fornecido
        if (attributes.estimatedHours !== undefined && (typeof attributes.estimatedHours !== 'number' || attributes.estimatedHours <= 0)) {
            errors.push({
                field: 'attributes.estimatedHours',
                message: 'Estimated hours must be a positive number',
                code: 'INVALID_NUMBER_VALUE'
            });
        }
    }

    /**
     * Valida atributos específicos do tipo PRINT_SHEET
     */
    private validatePrintSheetAttributes(attributes: any, errors: ValidationError[]): void {
        if (typeof attributes !== 'object' || attributes === null) {
            errors.push({
                field: 'attributes',
                message: 'PRINT_SHEET attributes must be a valid object',
                code: 'INVALID_ATTRIBUTES_STRUCTURE'
            });
            return;
        }

        // Campos obrigatórios para PRINT_SHEET
        const requiredFields = ['paperSize', 'paperType', 'printColors'];
        for (const field of requiredFields) {
            if (!attributes[field] || typeof attributes[field] !== 'string' || attributes[field].trim().length === 0) {
                errors.push({
                    field: `attributes.${field}`,
                    message: `${field} is required for PRINT_SHEET items`,
                    code: 'REQUIRED_PRINT_SHEET_FIELD'
                });
            }
        }

        // Validar sides se fornecido
        if (attributes.sides && !['front', 'both'].includes(attributes.sides)) {
            errors.push({
                field: 'attributes.sides',
                message: 'Sides must be front or both',
                code: 'INVALID_ENUM_VALUE'
            });
        }
    }

    /**
     * Valida atributos específicos do tipo PRINT_ROLL
     */
    private validatePrintRollAttributes(attributes: any, errors: ValidationError[]): void {
        if (typeof attributes !== 'object' || attributes === null) {
            errors.push({
                field: 'attributes',
                message: 'PRINT_ROLL attributes must be a valid object',
                code: 'INVALID_ATTRIBUTES_STRUCTURE'
            });
            return;
        }

        // material é obrigatório para PRINT_ROLL
        if (!attributes.material || typeof attributes.material !== 'string' || attributes.material.trim().length === 0) {
            errors.push({
                field: 'attributes.material',
                message: 'Material is required for PRINT_ROLL items',
                code: 'REQUIRED_PRINT_ROLL_FIELD'
            });
        }

        // Validar finishes se fornecido (deve ser array)
        if (attributes.finishes !== undefined && !Array.isArray(attributes.finishes)) {
            errors.push({
                field: 'attributes.finishes',
                message: 'Finishes must be an array of strings',
                code: 'INVALID_ARRAY_VALUE'
            });
        }

        // Validar installationType se fornecido
        if (attributes.installationType && !['indoor', 'outdoor'].includes(attributes.installationType)) {
            errors.push({
                field: 'attributes.installationType',
                message: 'Installation type must be indoor or outdoor',
                code: 'INVALID_ENUM_VALUE'
            });
        }

        // Validar windResistance se fornecido
        if (attributes.windResistance !== undefined && typeof attributes.windResistance !== 'boolean') {
            errors.push({
                field: 'attributes.windResistance',
                message: 'Wind resistance must be a boolean value',
                code: 'INVALID_BOOLEAN_VALUE'
            });
        }
    }

    /**
     * Valida atributos específicos do tipo LASER_CUT
     */
    private validateLaserCutAttributes(attributes: any, errors: ValidationError[]): void {
        if (typeof attributes !== 'object' || attributes === null) {
            errors.push({
                field: 'attributes',
                message: 'LASER_CUT attributes must be a valid object',
                code: 'INVALID_ATTRIBUTES_STRUCTURE'
            });
            return;
        }

        // material é obrigatório para LASER_CUT
        if (!attributes.material || typeof attributes.material !== 'string' || attributes.material.trim().length === 0) {
            errors.push({
                field: 'attributes.material',
                message: 'Material is required for LASER_CUT items',
                code: 'REQUIRED_LASER_CUT_FIELD'
            });
        }

        // Validar machineTimeMinutes se fornecido
        if (attributes.machineTimeMinutes !== undefined && (typeof attributes.machineTimeMinutes !== 'number' || attributes.machineTimeMinutes <= 0)) {
            errors.push({
                field: 'attributes.machineTimeMinutes',
                message: 'Machine time must be a positive number',
                code: 'INVALID_NUMBER_VALUE'
            });
        }

        // Validar cutType se fornecido
        if (attributes.cutType && !['cut', 'engrave', 'both'].includes(attributes.cutType)) {
            errors.push({
                field: 'attributes.cutType',
                message: 'Cut type must be cut, engrave, or both',
                code: 'INVALID_ENUM_VALUE'
            });
        }

        // Validar thickness se fornecido
        if (attributes.thickness !== undefined && (typeof attributes.thickness !== 'number' || attributes.thickness <= 0)) {
            errors.push({
                field: 'attributes.thickness',
                message: 'Thickness must be a positive number',
                code: 'INVALID_NUMBER_VALUE'
            });
        }
    }

    /**
     * Obtém o schema de validação para um tipo específico
     * Útil para documentação e validação no frontend
     */
    getSchemaForType(itemType: ItemType): any {
        switch (itemType) {
            case ItemType.SERVICE:
                return {
                    required: ['description'],
                    optional: ['briefing', 'estimatedHours', 'skillLevel'],
                    dimensionsRequired: false
                };
            case ItemType.PRINT_SHEET:
                return {
                    required: ['paperSize', 'paperType', 'printColors'],
                    optional: ['finishing', 'sides'],
                    dimensionsRequired: true
                };
            case ItemType.PRINT_ROLL:
                return {
                    required: ['material'],
                    optional: ['finishes', 'installationType', 'windResistance'],
                    dimensionsRequired: true
                };
            case ItemType.LASER_CUT:
                return {
                    required: ['material'],
                    optional: ['machineTimeMinutes', 'vectorFile', 'cutType', 'thickness'],
                    dimensionsRequired: true
                };
            case ItemType.PRODUCT:
                return {
                    required: [],
                    optional: [],
                    dimensionsRequired: false
                };
            case ItemType.UNIT:
                return {
                    required: [],
                    optional: [],
                    dimensionsRequired: false
                };
            case ItemType.SQUARE_METER:
                return {
                    required: [],
                    optional: [],
                    dimensionsRequired: true
                };
            case ItemType.TIME_AREA:
                return {
                    required: [],
                    optional: ['machineTimeMinutes'],
                    dimensionsRequired: true
                };
            default:
                return null;
        }
    }

    /**
     * Calcula área automaticamente se width e height estão presentes
     * Requirements: 9.1 - Calcular área em m² a partir de largura e altura em mm
     */
    calculateArea(width: number, height: number): number {
        if (width <= 0 || height <= 0) {
            throw new Error('Width and height must be greater than zero');
        }

        // Converter de mm² para m²
        return (width * height) / 1_000_000;
    }

    /**
     * Calcula área total multiplicando por quantidade
     * Requirements: 9.2 - Calcular área total multiplicando por quantidade
     */
    calculateTotalArea(area: number, quantity: number): number {
        if (area <= 0 || quantity <= 0) {
            throw new Error('Area and quantity must be greater than zero');
        }

        return area * quantity;
    }
}