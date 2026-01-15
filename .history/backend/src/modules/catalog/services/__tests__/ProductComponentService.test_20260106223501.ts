import { ProductComponentService } from '../ProductComponentService';
import { mockPrisma } from '../../../../__tests__/setup';
import { MaterialFormat } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../../@core/errors/AppError';
import * as fc from 'fast-check';

describe('ProductComponentService', () => {
  let service: ProductComponentService;

  beforeEach(() => {
    service = new ProductComponentService(mockPrisma);
  });

  describe('Property Tests', () => {
    /**
     * Property 1: Component Addition Consistency
     * For any valid product and material combination, adding a component should create a ProductComponent record and update the product's component list
     * Validates: Requirements 1.2, 1.5
     */
    test('Feature: product-material-integration, Property 1: Component Addition Consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          productId: fc.uuid(),
          materialId: fc.uuid(),
          consumptionMethod: fc.constantFrom('BOUNDING_BOX', 'LINEAR_NEST', 'FIXED_AMOUNT'),
          materialFormat: fc.constantFrom(MaterialFormat.SHEET, MaterialFormat.ROLL, MaterialFormat.UNIT),
          wastePercentage: fc.float({ min: 0, max: 1 }),
          priority: fc.integer({ min: 1, max: 10 })
        }),
        async (data) => {
          // Setup mocks
          mockPrisma.product.findUnique.mockResolvedValue({
            id: data.productId,
            name: 'Test Product'
          });

          mockPrisma.material.findUnique.mockResolvedValue({
            id: data.materialId,
            name: 'Test Material',
            format: data.materialFormat
          });

          mockPrisma.productComponent.findFirst.mockResolvedValue(null); // No existing component

          const expectedComponent = {
            id: fc.sample(fc.uuid(), 1)[0],
            productId: data.productId,
            materialId: data.materialId,
            consumptionMethod: data.consumptionMethod,
            wastePercentage: data.wastePercentage,
            priority: data.priority,
            material: {
              id: data.materialId,
              name: 'Test Material',
              format: data.materialFormat
            }
          };

          mockPrisma.productComponent.create.mockResolvedValue(expectedComponent);

          // Verificar compatibilidade
          const isCompatible = (
            (data.consumptionMethod === 'BOUNDING_BOX' && data.materialFormat === MaterialFormat.SHEET) ||
            (data.consumptionMethod === 'LINEAR_NEST' && data.materialFormat === MaterialFormat.ROLL) ||
            (data.consumptionMethod === 'FIXED_AMOUNT')
          );

          if (isCompatible) {
            // Execute
            const result = await service.addComponent(data.productId, {
              materialId: data.materialId,
              consumptionMethod: data.consumptionMethod as any,
              wastePercentage: data.wastePercentage,
              priority: data.priority
            });

            // Verify
            expect(mockPrisma.productComponent.create).toHaveBeenCalledWith({
              data: expect.objectContaining({
                productId: data.productId,
                materialId: data.materialId,
                consumptionMethod: data.consumptionMethod,
                wastePercentage: data.wastePercentage,
                priority: data.priority
              }),
              include: expect.any(Object)
            });

            expect(result).toEqual(expectedComponent);
          } else {
            // Should throw validation error for incompatible combinations
            await expect(service.addComponent(data.productId, {
              materialId: data.materialId,
              consumptionMethod: data.consumptionMethod as any,
              wastePercentage: data.wastePercentage,
              priority: data.priority
            })).rejects.toThrow(ValidationError);
          }
        }
      ), { numRuns: 100 });
    });

    /**
     * Property 3: Component Removal Consistency
     * For any existing ProductComponent, removing it should delete the record and update the product's component list
     * Validates: Requirements 1.3
     */
    test('Feature: product-material-integration, Property 3: Component Removal Consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          productId: fc.uuid(),
          componentId: fc.uuid(),
          materialId: fc.uuid()
        }),
        async (data) => {
          // Setup mocks
          const existingComponent = {
            id: data.componentId,
            productId: data.productId,
            materialId: data.materialId,
            consumptionMethod: 'BOUNDING_BOX'
          };

          mockPrisma.productComponent.findFirst.mockResolvedValue(existingComponent);
          mockPrisma.productComponent.delete.mockResolvedValue(existingComponent);

          // Execute
          const result = await service.removeComponent(data.productId, data.componentId);

          // Verify
          expect(mockPrisma.productComponent.findFirst).toHaveBeenCalledWith({
            where: {
              id: data.componentId,
              productId: data.productId
            }
          });

          expect(mockPrisma.productComponent.delete).toHaveBeenCalledWith({
            where: { id: data.componentId }
          });

          expect(result).toEqual({ message: 'Componente removido com sucesso' });
        }
      ), { numRuns: 100 });
    });

    /**
     * Property 2: Material Validation Rules
     * For any consumption method and material format combination, the system should only allow compatible pairings
     * Validates: Requirements 2.4, 10.4
     */
    test('Feature: product-material-integration, Property 2: Material Validation Rules', async () => {
      await fc.assert(fc.asyncProperty(
        fc.record({
          materialId: fc.uuid(),
          materialFormat: fc.constantFrom(MaterialFormat.SHEET, MaterialFormat.ROLL, MaterialFormat.UNIT),
          consumptionMethod: fc.constantFrom('BOUNDING_BOX', 'LINEAR_NEST', 'FIXED_AMOUNT')
        }),
        async (data) => {
          // Setup mock
          mockPrisma.material.findUnique.mockResolvedValue({
            id: data.materialId,
            format: data.materialFormat
          });

          // Test compatibility validation
          const isCompatible = await (service as any).validateComponentCompatibility(
            data.materialId,
            data.consumptionMethod
          );

          // Define expected compatibility
          const expectedCompatible = (
            (data.consumptionMethod === 'BOUNDING_BOX' && data.materialFormat === MaterialFormat.SHEET) ||
            (data.consumptionMethod === 'LINEAR_NEST' && data.materialFormat === MaterialFormat.ROLL) ||
            (data.consumptionMethod === 'FIXED_AMOUNT') // FIXED_AMOUNT works with any format
          );

          expect(isCompatible).toBe(expectedCompatible);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests', () => {
    test('should throw NotFoundError when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.addComponent('non-existent-id', {
        materialId: 'material-id',
        consumptionMethod: 'BOUNDING_BOX'
      })).rejects.toThrow(NotFoundError);
    });

    test('should throw NotFoundError when material does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'product-id' });
      mockPrisma.material.findUnique.mockResolvedValue(null);

      await expect(service.addComponent('product-id', {
        materialId: 'non-existent-material',
        consumptionMethod: 'BOUNDING_BOX'
      })).rejects.toThrow(NotFoundError);
    });

    test('should throw ValidationError when component already exists', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'product-id' });
      mockPrisma.material.findUnique.mockResolvedValue({
        id: 'material-id',
        format: MaterialFormat.SHEET
      });
      mockPrisma.productComponent.findFirst.mockResolvedValue({
        id: 'existing-component'
      });

      await expect(service.addComponent('product-id', {
        materialId: 'material-id',
        consumptionMethod: 'BOUNDING_BOX'
      })).rejects.toThrow(ValidationError);
    });

    test('should list components ordered by priority and creation date', async () => {
      const productId = 'product-id';
      const mockComponents = [
        { id: '1', priority: 1, createdAt: new Date('2024-01-01') },
        { id: '2', priority: 2, createdAt: new Date('2024-01-02') }
      ];

      mockPrisma.product.findUnique.mockResolvedValue({ id: productId });
      mockPrisma.productComponent.findMany.mockResolvedValue(mockComponents);

      const result = await service.listComponents(productId);

      expect(mockPrisma.productComponent.findMany).toHaveBeenCalledWith({
        where: { productId },
        include: expect.any(Object),
        orderBy: [
          { priority: 'asc' },
          { createdAt: 'asc' }
        ]
      });

      expect(result).toEqual(mockComponents);
    });

    test('should validate DYNAMIC_ENGINEER products require components', async () => {
      const productWithoutComponents = {
        id: 'product-id',
        pricingMode: 'DYNAMIC_ENGINEER',
        components: []
      };

      const productWithComponents = {
        id: 'product-id',
        pricingMode: 'DYNAMIC_ENGINEER',
        components: [{ id: 'component-1' }]
      };

      // Test product without components
      mockPrisma.product.findUnique.mockResolvedValue(productWithoutComponents);
      let result = await service.validateProductConfiguration('product-id');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Produtos com modo "Engenharia Dinâmica" devem ter pelo menos um material configurado');

      // Test product with components
      mockPrisma.product.findUnique.mockResolvedValue(productWithComponents);
      result = await service.validateProductConfiguration('product-id');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});