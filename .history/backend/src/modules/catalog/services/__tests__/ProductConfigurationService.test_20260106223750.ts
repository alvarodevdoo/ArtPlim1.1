import { ProductConfigurationService } from '../ProductConfigurationService';
import { mockPrisma } from '../../../../__tests__/setup';
import { ConfigurationType } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../../@core/errors/AppError';

describe('ProductConfigurationService', () => {
  let service: ProductConfigurationService;

  beforeEach(() => {
    service = new ProductConfigurationService(mockPrisma);
  });

  describe('Configuration Management', () => {
    test('should create a SELECT configuration successfully', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Tipo de Capa',
        type: ConfigurationType.SELECT,
        required: true,
        affectsComponents: true,
        affectsPricing: true
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productConfiguration.findFirst.mockResolvedValue(null);
      
      const expectedConfig = {
        id: 'config-id',
        ...configData,
        productId,
        options: []
      };
      
      mockPrisma.productConfiguration.create.mockResolvedValue(expectedConfig);

      const result = await service.createConfiguration(productId, configData);

      expect(mockPrisma.productConfiguration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId,
          name: configData.name,
          type: configData.type,
          required: true,
          affectsComponents: true,
          affectsPricing: true,
          displayOrder: 1
        }),
        include: expect.any(Object)
      });

      expect(result).toEqual(expectedConfig);
    });

    test('should create a NUMBER configuration with validation', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Número de Páginas',
        type: ConfigurationType.NUMBER,
        required: true,
        minValue: 4,
        maxValue: 100,
        step: 4,
        defaultValue: '8'
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productConfiguration.findFirst.mockResolvedValue(null);
      
      const expectedConfig = {
        id: 'config-id',
        ...configData,
        productId,
        options: []
      };
      
      mockPrisma.productConfiguration.create.mockResolvedValue(expectedConfig);

      const result = await service.createConfiguration(productId, configData);

      expect(result).toEqual(expectedConfig);
    });

    test('should create a BOOLEAN configuration', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Montagem de Arte',
        type: ConfigurationType.BOOLEAN,
        required: false,
        defaultValue: 'false',
        affectsPricing: true
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productConfiguration.findFirst.mockResolvedValue(null);
      
      const expectedConfig = {
        id: 'config-id',
        ...configData,
        productId,
        options: []
      };
      
      mockPrisma.productConfiguration.create.mockResolvedValue(expectedConfig);

      const result = await service.createConfiguration(productId, configData);

      expect(result).toEqual(expectedConfig);
    });

    test('should throw ValidationError for invalid NUMBER configuration', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Invalid Config',
        type: ConfigurationType.NUMBER,
        minValue: 100,
        maxValue: 50 // Invalid: min > max
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });

      await expect(service.createConfiguration(productId, configData))
        .rejects.toThrow('Valor mínimo deve ser menor que o valor máximo');
    });

    test('should throw ValidationError for invalid BOOLEAN default value', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Invalid Boolean',
        type: ConfigurationType.BOOLEAN,
        defaultValue: 'invalid' // Should be 'true' or 'false'
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });

      await expect(service.createConfiguration(productId, configData))
        .rejects.toThrow('Valor padrão para configuração BOOLEAN deve ser "true" ou "false"');
    });

    test('should throw ValidationError for duplicate configuration name', async () => {
      const productId = 'product-id';
      const configData = {
        name: 'Existing Config',
        type: ConfigurationType.SELECT
      };

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productConfiguration.findFirst.mockResolvedValue({
        id: 'existing-config',
        name: 'Existing Config'
      });

      await expect(service.createConfiguration(productId, configData))
        .rejects.toThrow('Já existe uma configuração com este nome para o produto');
    });

    test('should list configurations ordered by displayOrder', async () => {
      const productId = 'product-id';
      const mockConfigs = [
        { id: '1', name: 'Config 1', displayOrder: 1, options: [] },
        { id: '2', name: 'Config 2', displayOrder: 2, options: [] }
      ];

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productConfiguration.findMany.mockResolvedValue(mockConfigs);

      const result = await service.listConfigurations(productId);

      expect(mockPrisma.productConfiguration.findMany).toHaveBeenCalledWith({
        where: { productId },
        include: {
          options: {
            orderBy: { displayOrder: 'asc' }
          }
        },
        orderBy: { displayOrder: 'asc' }
      });

      expect(result).toEqual(mockConfigs);
    });

    test('should update configuration successfully', async () => {
      const configId = 'config-id';
      const updateData = {
        name: 'Updated Name',
        required: false
      };

      const existingConfig = {
        id: configId,
        name: 'Original Name',
        type: ConfigurationType.SELECT
      };

      const updatedConfig = {
        ...existingConfig,
        ...updateData,
        options: []
      };

      mockPrisma.productConfiguration.findUnique.mockResolvedValue(existingConfig);
      mockPrisma.productConfiguration.update.mockResolvedValue(updatedConfig);

      const result = await service.updateConfiguration(configId, updateData);

      expect(mockPrisma.productConfiguration.update).toHaveBeenCalledWith({
        where: { id: configId },
        data: {
          ...updateData,
          updatedAt: expect.any(Date)
        },
        include: expect.any(Object)
      });

      expect(result).toEqual(updatedConfig);
    });

    test('should delete configuration successfully', async () => {
      const configId = 'config-id';

      mockPrisma.productConfiguration.findUnique.mockResolvedValue({
        id: configId,
        name: 'Config to Delete'
      });

      const result = await service.deleteConfiguration(configId);

      expect(mockPrisma.productConfiguration.delete).toHaveBeenCalledWith({
        where: { id: configId }
      });

      expect(result).toEqual({ message: 'Configuração removida com sucesso' });
    });
  });

  describe('Option Management', () => {
    test('should add option to SELECT configuration', async () => {
      const configId = 'config-id';
      const optionData = {
        label: 'Capa Dura',
        value: 'hard_cover',
        priceModifier: 15.00,
        additionalComponents: [{ materialId: 'material-1' }]
      };

      mockPrisma.productConfiguration.findUnique.mockResolvedValue({
        id: configId,
        type: ConfigurationType.SELECT
      });
      mockPrisma.configurationOption.findFirst.mockResolvedValue(null);

      const expectedOption = {
        id: 'option-id',
        configurationId: configId,
        ...optionData
      };

      mockPrisma.configurationOption.create.mockResolvedValue(expectedOption);

      const result = await service.addOption(configId, optionData);

      expect(mockPrisma.configurationOption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          configurationId: configId,
          label: optionData.label,
          value: optionData.value,
          priceModifier: optionData.priceModifier,
          additionalComponents: JSON.stringify(optionData.additionalComponents),
          displayOrder: 1
        })
      });

      expect(result).toEqual(expectedOption);
    });

    test('should throw ValidationError when adding option to non-SELECT configuration', async () => {
      const configId = 'config-id';
      const optionData = {
        label: 'Invalid Option',
        value: 'invalid'
      };

      mockPrisma.productConfiguration.findUnique.mockResolvedValue({
        id: configId,
        type: ConfigurationType.NUMBER // Not SELECT
      });

      await expect(service.addOption(configId, optionData))
        .rejects.toThrow('Opções só podem ser adicionadas a configurações do tipo SELECT');
    });

    test('should throw ValidationError for duplicate option value', async () => {
      const configId = 'config-id';
      const optionData = {
        label: 'Duplicate Option',
        value: 'existing_value'
      };

      mockPrisma.productConfiguration.findUnique.mockResolvedValue({
        id: configId,
        type: ConfigurationType.SELECT
      });
      mockPrisma.configurationOption.findFirst.mockResolvedValue({
        id: 'existing-option',
        value: 'existing_value'
      });

      await expect(service.addOption(configId, optionData))
        .rejects.toThrow('Já existe uma opção com este valor para a configuração');
    });

    test('should update option successfully', async () => {
      const optionId = 'option-id';
      const updateData = {
        label: 'Updated Label',
        priceModifier: 20.00
      };

      mockPrisma.configurationOption.findUnique.mockResolvedValue({
        id: optionId,
        label: 'Original Label'
      });

      const updatedOption = {
        id: optionId,
        ...updateData
      };

      mockPrisma.configurationOption.update.mockResolvedValue(updatedOption);

      const result = await service.updateOption(optionId, updateData);

      expect(result).toEqual(updatedOption);
    });

    test('should delete option successfully', async () => {
      const optionId = 'option-id';

      mockPrisma.configurationOption.findUnique.mockResolvedValue({
        id: optionId,
        label: 'Option to Delete'
      });

      const result = await service.deleteOption(optionId);

      expect(mockPrisma.configurationOption.delete).toHaveBeenCalledWith({
        where: { id: optionId }
      });

      expect(result).toEqual({ message: 'Opção removida com sucesso' });
    });
  });

  describe('Configuration Validation', () => {
    test('should validate selected configurations successfully', async () => {
      const productId = 'product-id';
      const configurations = [
        {
          id: 'config-1',
          name: 'Páginas',
          type: ConfigurationType.NUMBER,
          required: true,
          minValue: 4,
          maxValue: 100,
          step: 4,
          options: []
        },
        {
          id: 'config-2',
          name: 'Tipo de Capa',
          type: ConfigurationType.SELECT,
          required: true,
          options: [
            { value: 'soft', label: 'Flexível' },
            { value: 'hard', label: 'Dura' }
          ]
        },
        {
          id: 'config-3',
          name: 'Arte',
          type: ConfigurationType.BOOLEAN,
          required: false,
          options: []
        }
      ];

      mockPrisma.productConfiguration.findMany.mockResolvedValue(configurations);

      const selectedConfigs = {
        'config-1': '8',    // Valid number
        'config-2': 'soft', // Valid option
        'config-3': 'true'  // Valid boolean
      };

      const result = await service.validateSelectedConfigurations(productId, selectedConfigs);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should return errors for invalid configurations', async () => {
      const productId = 'product-id';
      const configurations = [
        {
          id: 'config-1',
          name: 'Páginas',
          type: ConfigurationType.NUMBER,
          required: true,
          minValue: 4,
          maxValue: 100,
          step: 4,
          options: []
        },
        {
          id: 'config-2',
          name: 'Tipo de Capa',
          type: ConfigurationType.SELECT,
          required: true,
          options: [
            { value: 'soft', label: 'Flexível' }
          ]
        }
      ];

      mockPrisma.productConfiguration.findMany.mockResolvedValue(configurations);

      const selectedConfigs = {
        'config-1': '3',      // Below minimum
        'config-2': 'invalid' // Invalid option
      };

      const result = await service.validateSelectedConfigurations(productId, selectedConfigs);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuração "Páginas" deve ser maior ou igual a 4');
      expect(result.errors).toContain('Valor "invalid" não é válido para configuração "Tipo de Capa"');
    });

    test('should return error for missing required configuration', async () => {
      const productId = 'product-id';
      const configurations = [
        {
          id: 'config-1',
          name: 'Required Config',
          type: ConfigurationType.SELECT,
          required: true,
          options: []
        }
      ];

      mockPrisma.productConfiguration.findMany.mockResolvedValue(configurations);

      const selectedConfigs = {}; // Missing required config

      const result = await service.validateSelectedConfigurations(productId, selectedConfigs);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Configuração "Required Config" é obrigatória');
    });
  });

  describe('Error Handling', () => {
    test('should throw NotFoundError when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.createConfiguration('non-existent-id', {
        name: 'Test Config',
        type: ConfigurationType.SELECT
      })).rejects.toThrow(NotFoundError);
    });

    test('should throw NotFoundError when configuration does not exist', async () => {
      mockPrisma.productConfiguration.findUnique.mockResolvedValue(null);

      await expect(service.updateConfiguration('non-existent-id', {
        name: 'Updated Name'
      })).rejects.toThrow(NotFoundError);
    });

    test('should throw NotFoundError when option does not exist', async () => {
      mockPrisma.configurationOption.findUnique.mockResolvedValue(null);

      await expect(service.updateOption('non-existent-id', {
        label: 'Updated Label'
      })).rejects.toThrow(NotFoundError);
    });
  });
});