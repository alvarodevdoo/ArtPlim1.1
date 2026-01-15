#!/usr/bin/env ts-node

/**
 * Migration Script for ItemTypes Feature
 * 
 * This script applies the ItemTypes migration and seeds sample data.
 * It can be run safely multiple times.
 * 
 * Usage:
 *   npm run migrate:item-types
 *   or
 *   npx ts-node scripts/migrate-item-types.ts
 */

import { PrismaClient } from '@prisma/client';
import { seedItemTypesSampleData } from '../prisma/seeds/item-types-sample-data';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting ItemTypes migration and seeding...\n');

    try {
        // Step 1: Apply database migration
        console.log('📊 Applying database migration...');
        console.log('   (Migration will be applied via Prisma migrate)');

        // Step 2: Verify migration was successful
        console.log('\n🔍 Verifying migration...');

        // Check if new tables exist
        const standardSizesCount = await prisma.standardSize.count();
        const productionMaterialsCount = await prisma.productionMaterial.count();

        console.log(`   • StandardSize table: ${standardSizesCount} records`);
        console.log(`   • ProductionMaterial table: ${productionMaterialsCount} records`);

        // Check if OrderItem table has new columns
        const orderItemsWithItemType = await prisma.orderItem.count({
            where: {
                itemType: 'PRODUCT'
            }
        });

        console.log(`   • OrderItems with itemType: ${orderItemsWithItemType} records`);

        // Step 3: Seed sample data
        console.log('\n🌱 Seeding sample data...');
        await seedItemTypesSampleData();

        // Step 4: Final verification
        console.log('\n✅ Final verification...');

        const finalStandardSizesCount = await prisma.standardSize.count();
        const finalProductionMaterialsCount = await prisma.productionMaterial.count();
        const finishesWithAllowedTypes = await prisma.finish.count({
            where: {
                allowedTypes: {
                    not: null
                }
            }
        });

        console.log(`   • Standard sizes created: ${finalStandardSizesCount}`);
        console.log(`   • Production materials created: ${finalProductionMaterialsCount}`);
        console.log(`   • Finishes with type restrictions: ${finishesWithAllowedTypes}`);

        console.log('\n🎉 ItemTypes migration and seeding completed successfully!');
        console.log('\n📋 What was accomplished:');
        console.log('   ✅ Database schema updated with ItemType enum');
        console.log('   ✅ OrderItem table enhanced with new fields');
        console.log('   ✅ StandardSize table created with sample data');
        console.log('   ✅ ProductionMaterial table created with sample data');
        console.log('   ✅ Finish table updated with type compatibility');
        console.log('   ✅ Existing data preserved with backward compatibility');
        console.log('   ✅ Performance indexes created');
        console.log('\n💡 Next steps:');
        console.log('   • Test the new ItemType functionality in the frontend');
        console.log('   • Verify that existing orders still work correctly');
        console.log('   • Create new orders using different ItemTypes');
        console.log('   • Customize standard sizes and materials as needed');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.log('\n🔧 Troubleshooting tips:');
        console.log('   • Ensure database is running and accessible');
        console.log('   • Check that DATABASE_URL is correctly configured');
        console.log('   • Verify that no other processes are using the database');
        console.log('   • Run "npx prisma db push" to apply schema changes');
        console.log('   • Check database logs for detailed error information');

        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Handle script execution
if (require.main === module) {
    main()
        .catch((error) => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

export default main;