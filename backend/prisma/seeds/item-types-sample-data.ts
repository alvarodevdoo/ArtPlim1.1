/**
 * Sample Data for ItemTypes Feature
 * 
 * This file contains sample data for StandardSize, ProductionMaterial, and Finish
 * tables to help users get started with the new ItemTypes functionality.
 * 
 * Requirements: 3.1, 4.1, 5.1
 */

import { PrismaClient, ItemType } from '@prisma/client';

const prisma = new PrismaClient();

// Sample Standard Sizes for different ItemTypes
export const sampleStandardSizes = [
    // PRINT_SHEET sizes
    {
        name: 'A4',
        width: 210.0,
        height: 297.0,
        type: ItemType.PRINT_SHEET,
        isDefault: true,
        description: 'Papel A4 padrão - mais comum para impressões'
    },
    {
        name: 'A3',
        width: 297.0,
        height: 420.0,
        type: ItemType.PRINT_SHEET,
        isDefault: false,
        description: 'Papel A3 para impressões maiores'
    },
    {
        name: 'A5',
        width: 148.0,
        height: 210.0,
        type: ItemType.PRINT_SHEET,
        isDefault: false,
        description: 'Papel A5 para folhetos e flyers pequenos'
    },
    {
        name: 'Cartão de Visita',
        width: 90.0,
        height: 50.0,
        type: ItemType.PRINT_SHEET,
        isDefault: false,
        description: 'Tamanho padrão para cartões de visita'
    },
    {
        name: 'Flyer A6',
        width: 105.0,
        height: 148.0,
        type: ItemType.PRINT_SHEET,
        isDefault: false,
        description: 'Flyer tamanho A6 para panfletos'
    },
    {
        name: 'Folder A4',
        width: 210.0,
        height: 297.0,
        type: ItemType.PRINT_SHEET,
        isDefault: false,
        description: 'Folder institucional tamanho A4'
    },

    // PRINT_ROLL sizes
    {
        name: 'Banner 1x1m',
        width: 1000.0,
        height: 1000.0,
        type: ItemType.PRINT_ROLL,
        isDefault: true,
        description: 'Banner quadrado padrão 1x1 metro'
    },
    {
        name: 'Banner 2x1m',
        width: 2000.0,
        height: 1000.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Banner retangular horizontal 2x1 metros'
    },
    {
        name: 'Banner 1x2m',
        width: 1000.0,
        height: 2000.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Banner retangular vertical 1x2 metros'
    },
    {
        name: 'Banner 3x2m',
        width: 3000.0,
        height: 2000.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Banner grande 3x2 metros'
    },
    {
        name: 'Adesivo A4',
        width: 210.0,
        height: 297.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Adesivo tamanho A4'
    },
    {
        name: 'Adesivo A3',
        width: 297.0,
        height: 420.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Adesivo tamanho A3'
    },
    {
        name: 'Faixa 5x1m',
        width: 5000.0,
        height: 1000.0,
        type: ItemType.PRINT_ROLL,
        isDefault: false,
        description: 'Faixa promocional 5x1 metros'
    },

    // LASER_CUT sizes
    {
        name: 'Chapa 30x30cm',
        width: 300.0,
        height: 300.0,
        type: ItemType.LASER_CUT,
        isDefault: true,
        description: 'Chapa padrão quadrada para corte laser'
    },
    {
        name: 'Chapa 60x40cm',
        width: 600.0,
        height: 400.0,
        type: ItemType.LASER_CUT,
        isDefault: false,
        description: 'Chapa média retangular para corte laser'
    },
    {
        name: 'Chapa 100x60cm',
        width: 1000.0,
        height: 600.0,
        type: ItemType.LASER_CUT,
        isDefault: false,
        description: 'Chapa grande para projetos maiores'
    },
    {
        name: 'Chapa 120x80cm',
        width: 1200.0,
        height: 800.0,
        type: ItemType.LASER_CUT,
        isDefault: false,
        description: 'Chapa extra grande para corte laser'
    },
    {
        name: 'Placa 20x30cm',
        width: 200.0,
        height: 300.0,
        type: ItemType.LASER_CUT,
        isDefault: false,
        description: 'Placa pequena para placas de identificação'
    }
];

// Sample Production Materials for different ItemTypes
export const sampleProductionMaterials = [
    // PRINT_SHEET materials
    {
        name: 'Papel Sulfite 75g',
        type: ItemType.PRINT_SHEET,
        costPrice: 0.05,
        salesPrice: 0.15,
        unit: 'm²',
        properties: {
            weight: 75,
            color: 'white',
            finish: 'matte',
            opacity: 'high',
            printQuality: 'standard'
        },
        inStock: true,
        supplier: 'Suzano Papel'
    },
    {
        name: 'Papel Couché 150g',
        type: ItemType.PRINT_SHEET,
        costPrice: 0.12,
        salesPrice: 0.35,
        unit: 'm²',
        properties: {
            weight: 150,
            color: 'white',
            finish: 'glossy',
            opacity: 'high',
            printQuality: 'premium'
        },
        inStock: true,
        supplier: 'International Paper'
    },
    {
        name: 'Papel Couché 300g',
        type: ItemType.PRINT_SHEET,
        costPrice: 0.25,
        salesPrice: 0.65,
        unit: 'm²',
        properties: {
            weight: 300,
            color: 'white',
            finish: 'glossy',
            opacity: 'high',
            printQuality: 'premium',
            thickness: 'thick'
        },
        inStock: true,
        supplier: 'International Paper'
    },
    {
        name: 'Papel Offset 120g',
        type: ItemType.PRINT_SHEET,
        costPrice: 0.08,
        salesPrice: 0.22,
        unit: 'm²',
        properties: {
            weight: 120,
            color: 'white',
            finish: 'matte',
            opacity: 'high',
            printQuality: 'good'
        },
        inStock: true,
        supplier: 'Suzano Papel'
    },
    {
        name: 'Cartão Supremo 250g',
        type: ItemType.PRINT_SHEET,
        costPrice: 0.35,
        salesPrice: 0.85,
        unit: 'm²',
        properties: {
            weight: 250,
            color: 'white',
            finish: 'matte',
            opacity: 'high',
            printQuality: 'premium',
            rigidity: 'high'
        },
        inStock: true,
        supplier: 'Klabin'
    },

    // PRINT_ROLL materials
    {
        name: 'Lona 440g Branca',
        type: ItemType.PRINT_ROLL,
        costPrice: 8.50,
        salesPrice: 25.00,
        unit: 'm²',
        properties: {
            weight: 440,
            color: 'white',
            waterproof: true,
            outdoor: true,
            durability: '2-3 years',
            flexibility: 'high'
        },
        inStock: true,
        supplier: 'Sansuy'
    },
    {
        name: 'Vinil Adesivo Branco',
        type: ItemType.PRINT_ROLL,
        costPrice: 12.00,
        salesPrice: 35.00,
        unit: 'm²',
        properties: {
            adhesive: true,
            removable: false,
            outdoor: true,
            color: 'white',
            durability: '5-7 years',
            finish: 'glossy'
        },
        inStock: true,
        supplier: '3M'
    },
    {
        name: 'Tecido Duralon',
        type: ItemType.PRINT_ROLL,
        costPrice: 15.00,
        salesPrice: 45.00,
        unit: 'm²',
        properties: {
            fabric: true,
            washable: false,
            indoor: true,
            color: 'white',
            texture: 'smooth',
            durability: '1-2 years'
        },
        inStock: true,
        supplier: 'Sansuy'
    },
    {
        name: 'Lona 510g Blackout',
        type: ItemType.PRINT_ROLL,
        costPrice: 12.00,
        salesPrice: 35.00,
        unit: 'm²',
        properties: {
            weight: 510,
            color: 'white',
            waterproof: true,
            outdoor: true,
            blackout: true,
            durability: '3-5 years'
        },
        inStock: true,
        supplier: 'Sansuy'
    },
    {
        name: 'Vinil Adesivo Transparente',
        type: ItemType.PRINT_ROLL,
        costPrice: 18.00,
        salesPrice: 50.00,
        unit: 'm²',
        properties: {
            adhesive: true,
            removable: true,
            outdoor: true,
            color: 'transparent',
            durability: '3-5 years',
            finish: 'glossy'
        },
        inStock: true,
        supplier: '3M'
    },

    // LASER_CUT materials
    {
        name: 'MDF 3mm Cru',
        type: ItemType.LASER_CUT,
        costPrice: 25.00,
        salesPrice: 65.00,
        unit: 'm²',
        properties: {
            thickness: 3,
            material: 'MDF',
            finish: 'raw',
            color: 'natural',
            density: 'medium',
            workability: 'excellent'
        },
        inStock: true,
        supplier: 'Duratex'
    },
    {
        name: 'MDF 6mm Cru',
        type: ItemType.LASER_CUT,
        costPrice: 45.00,
        salesPrice: 120.00,
        unit: 'm²',
        properties: {
            thickness: 6,
            material: 'MDF',
            finish: 'raw',
            color: 'natural',
            density: 'medium',
            workability: 'excellent'
        },
        inStock: true,
        supplier: 'Duratex'
    },
    {
        name: 'Acrílico 3mm Cristal',
        type: ItemType.LASER_CUT,
        costPrice: 85.00,
        salesPrice: 220.00,
        unit: 'm²',
        properties: {
            thickness: 3,
            material: 'acrylic',
            color: 'transparent',
            finish: 'polished',
            transparency: 'high',
            workability: 'good'
        },
        inStock: true,
        supplier: 'Acrigel'
    },
    {
        name: 'Acrílico 5mm Cristal',
        type: ItemType.LASER_CUT,
        costPrice: 140.00,
        salesPrice: 350.00,
        unit: 'm²',
        properties: {
            thickness: 5,
            material: 'acrylic',
            color: 'transparent',
            finish: 'polished',
            transparency: 'high',
            workability: 'good'
        },
        inStock: true,
        supplier: 'Acrigel'
    },
    {
        name: 'Compensado 6mm',
        type: ItemType.LASER_CUT,
        costPrice: 35.00,
        salesPrice: 90.00,
        unit: 'm²',
        properties: {
            thickness: 6,
            material: 'plywood',
            finish: 'raw',
            color: 'natural',
            layers: 5,
            workability: 'excellent'
        },
        inStock: true,
        supplier: 'Eucatex'
    },
    {
        name: 'Acrílico 3mm Branco',
        type: ItemType.LASER_CUT,
        costPrice: 75.00,
        salesPrice: 195.00,
        unit: 'm²',
        properties: {
            thickness: 3,
            material: 'acrylic',
            color: 'white',
            finish: 'matte',
            opacity: 'opaque',
            workability: 'good'
        },
        inStock: true,
        supplier: 'Acrigel'
    }
];

// Sample Finish configurations with allowedTypes
export const sampleFinishUpdates = [
    // Finishes for PRINT_SHEET and PRINT_ROLL
    {
        name: 'Laminação Fosca',
        allowedTypes: [ItemType.PRINT_SHEET, ItemType.PRINT_ROLL],
        description: 'Laminação fosca para proteção e acabamento premium'
    },
    {
        name: 'Laminação Brilhante',
        allowedTypes: [ItemType.PRINT_SHEET, ItemType.PRINT_ROLL],
        description: 'Laminação brilhante para realce de cores'
    },
    {
        name: 'Verniz UV',
        allowedTypes: [ItemType.PRINT_SHEET],
        description: 'Verniz UV para acabamento especial em impressos'
    },
    {
        name: 'Plastificação',
        allowedTypes: [ItemType.PRINT_SHEET],
        description: 'Plastificação para maior durabilidade'
    },

    // Finishes for LASER_CUT
    {
        name: 'Gravação a Laser',
        allowedTypes: [ItemType.LASER_CUT],
        description: 'Gravação superficial a laser para detalhes'
    },
    {
        name: 'Polimento de Bordas',
        allowedTypes: [ItemType.LASER_CUT],
        description: 'Polimento das bordas cortadas para acabamento premium'
    },
    {
        name: 'Pintura',
        allowedTypes: [ItemType.LASER_CUT],
        description: 'Pintura personalizada após o corte'
    },

    // Universal finishes (no allowedTypes restriction)
    {
        name: 'Sem Acabamento',
        allowedTypes: [], // Empty array means all types
        description: 'Produto sem acabamento adicional'
    }
];

// Function to seed sample data
export async function seedItemTypesSampleData() {
    console.log('🌱 Seeding ItemTypes sample data...');

    try {
        // Get all organizations to seed data for each
        const organizations = await prisma.organization.findMany({
            select: { id: true, name: true }
        });

        if (organizations.length === 0) {
            console.log('⚠️  No organizations found. Please create at least one organization first.');
            return;
        }

        console.log(`📊 Found ${organizations.length} organization(s). Seeding data for each...`);

        for (const org of organizations) {
            console.log(`\n🏢 Seeding data for organization: ${org.name}`);

            // Seed Standard Sizes
            console.log('📏 Creating standard sizes...');
            for (const sizeData of sampleStandardSizes) {
                await prisma.standardSize.upsert({
                    where: {
                        organizationId_name_type: {
                            organizationId: org.id,
                            name: sizeData.name,
                            type: sizeData.type
                        }
                    },
                    update: {
                        width: sizeData.width,
                        height: sizeData.height,
                        isDefault: sizeData.isDefault,
                        description: sizeData.description
                    },
                    create: {
                        organizationId: org.id,
                        name: sizeData.name,
                        width: sizeData.width,
                        height: sizeData.height,
                        type: sizeData.type,
                        isDefault: sizeData.isDefault,
                        description: sizeData.description
                    }
                });
            }

            // Seed Production Materials
            console.log('🧱 Creating production materials...');
            for (const materialData of sampleProductionMaterials) {
                await prisma.productionMaterial.upsert({
                    where: {
                        organizationId_name_type: {
                            organizationId: org.id,
                            name: materialData.name,
                            type: materialData.type
                        }
                    },
                    update: {
                        costPrice: materialData.costPrice,
                        salesPrice: materialData.salesPrice,
                        unit: materialData.unit,
                        properties: materialData.properties,
                        inStock: materialData.inStock,
                        supplier: materialData.supplier
                    },
                    create: {
                        organizationId: org.id,
                        name: materialData.name,
                        type: materialData.type,
                        costPrice: materialData.costPrice,
                        salesPrice: materialData.salesPrice,
                        unit: materialData.unit,
                        properties: materialData.properties,
                        inStock: materialData.inStock,
                        supplier: materialData.supplier
                    }
                });
            }

            // Update existing finishes with allowedTypes
            console.log('✨ Updating finish configurations...');
            for (const finishUpdate of sampleFinishUpdates) {
                // Try to find existing finish by name
                const existingFinish = await prisma.finish.findFirst({
                    where: {
                        organizationId: org.id,
                        name: finishUpdate.name
                    }
                });

                if (existingFinish) {
                    // Update existing finish
                    await prisma.finish.update({
                        where: { id: existingFinish.id },
                        data: {
                            allowedTypes: finishUpdate.allowedTypes,
                            description: finishUpdate.description
                        }
                    });
                } else {
                    // Create new finish
                    await prisma.finish.create({
                        data: {
                            organizationId: org.id,
                            name: finishUpdate.name,
                            allowedTypes: finishUpdate.allowedTypes,
                            description: finishUpdate.description,
                            priceType: 'FIXED',
                            priceValue: 0
                        }
                    });
                }
            }

            console.log(`✅ Completed seeding for organization: ${org.name}`);
        }

        console.log('\n🎉 ItemTypes sample data seeding completed successfully!');
        console.log('\n📋 Summary:');
        console.log(`   • ${sampleStandardSizes.length} standard sizes per organization`);
        console.log(`   • ${sampleProductionMaterials.length} production materials per organization`);
        console.log(`   • ${sampleFinishUpdates.length} finish configurations per organization`);
        console.log('\n💡 Users can now:');
        console.log('   • Select from predefined standard sizes when creating items');
        console.log('   • Choose appropriate materials for each item type');
        console.log('   • Apply compatible finishes based on item type');

    } catch (error) {
        console.error('❌ Error seeding ItemTypes sample data:', error);
        throw error;
    }
}

// Function to clean up sample data (for testing)
export async function cleanupItemTypesSampleData() {
    console.log('🧹 Cleaning up ItemTypes sample data...');

    try {
        // Delete in reverse order of dependencies
        await prisma.standardSize.deleteMany({});
        await prisma.productionMaterial.deleteMany({});

        // Reset finish allowedTypes to null (don't delete finishes)
        await prisma.finish.updateMany({
            data: {
                allowedTypes: null
            }
        });

        console.log('✅ ItemTypes sample data cleanup completed');
    } catch (error) {
        console.error('❌ Error cleaning up ItemTypes sample data:', error);
        throw error;
    }
}

// Export for use in other seed scripts
export default {
    seedItemTypesSampleData,
    cleanupItemTypesSampleData,
    sampleStandardSizes,
    sampleProductionMaterials,
    sampleFinishUpdates
};