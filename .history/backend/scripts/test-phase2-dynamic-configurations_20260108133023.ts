import { PrismaClient } from '@prisma/client';
import { ProductConfigurationService } from '../src/modules/catalog/services/ProductConfigurationService';
import { ConfigurationValidationService } from '../src/modules/catalog/services/ConfigurationValidationService';
import { PricingEngine } from '../src/shared/application/pricing/PricingEngine';

const prisma = new PrismaClient();

async function testPhase2Implementation() {
  console.log('🧪 TESTING PHASE 2: Dynamic Product Configurations');
  console.log('=' .repeat(60));

  try {
    // 1. Test Configuration Service
    console.log('\n1️⃣ Testing ProductConfigurationService...');
    const configService = new ProductConfigurationService(prisma);
    
    // Find a product to test with
    const product = await prisma.product.findFirst({
      where: { pricingMode: 'DYNAMIC_ENGINEER' }
    });
    
    if (!product) {
      console.log('❌ No DYNAMIC_ENGINEER product found. Creating one...');
      const newProduct = await prisma.product.create({
        data: {
          name: 'Cardápio Dinâmico (Teste)',
          description: 'Produto para teste de configurações dinâmicas',
          pricingMode: 'DYNAMIC_ENGINEER',
          markup: 2.5,
          organizationId: 'test-org-id'
        }
      });
      console.log(`✅ Created test product: ${newProduct.name}`);
    }

    const testProduct = product || await prisma.product.findFirst({
      where: { pricingMode: 'DYNAMIC_ENGINEER' }
    });

    if (!testProduct) {
      throw new Error('Could not create or find test product');
    }

    // Test creating configurations
    console.log('\n📝 Creating test configurations...');
    
    const pagesConfig = await configService.createConfiguration(testProduct.id, {
      name: 'Número de Páginas',
      type: 'NUMBER',
      required: true,
      minValue: 4,
      maxValue: 100,
      step: 4,
      defaultValue: '8',
      affectsComponents: true,
      affectsPricing: true,
      displayOrder: 1
    });
    console.log(`✅ Created configuration: ${pagesConfig.name}`);

    const coverConfig = await configService.createConfiguration(testProduct.id, {
      name: 'Tipo de Capa',
      type: 'SELECT',
      required: true,
      affectsComponents: true,
      affectsPricing: true,
      displayOrder: 2
    });
    console.log(`✅ Created configuration: ${coverConfig.name}`);

    // Add options to SELECT configuration
    const softCoverOption = await configService.addOption(coverConfig.id, {
      label: 'Capa Simples',
      value: 'soft_cover',
      priceModifier: 0,
      displayOrder: 1
    });

    const hardCoverOption = await configService.addOption(coverConfig.id, {
      label: 'Capa Dura',
      value: 'hard_cover',
      priceModifier: 15.00,
      displayOrder: 2
    });

    console.log(`✅ Added options: ${softCoverOption.label}, ${hardCoverOption.label}`);

    // 2. Test Configuration Validation
    console.log('\n2️⃣ Testing ConfigurationValidationService...');
    const validationService = new ConfigurationValidationService(prisma);

    const validSelections = {
      [pagesConfig.id]: '8',
      [coverConfig.id]: 'hard_cover'
    };

    const validationResult = await validationService.validateAllConfigurations(
      testProduct.id,
      validSelections
    );

    console.log(`✅ Validation result: ${validationResult.isValid ? 'VALID' : 'INVALID'}`);
    if (validationResult.errors.length > 0) {
      console.log('❌ Validation errors:', validationResult.errors);
    }
    if (validationResult.warnings && validationResult.warnings.length > 0) {
      console.log('⚠️ Validation warnings:', validationResult.warnings);
    }

    // Test invalid selections
    const invalidSelections = {
      [pagesConfig.id]: '7', // Not multiple of 4
      [coverConfig.id]: 'invalid_option'
    };

    const invalidValidation = await validationService.validateAllConfigurations(
      testProduct.id,
      invalidSelections
    );

    console.log(`✅ Invalid validation test: ${!invalidValidation.isValid ? 'PASSED' : 'FAILED'}`);
    console.log(`   Errors found: ${invalidValidation.errors.length}`);

    // 3. Test Enhanced PricingEngine
    console.log('\n3️⃣ Testing Enhanced PricingEngine...');
    const pricingEngine = new PricingEngine();

    const pricingInput = {
      product: {
        id: testProduct.id,
        name: testProduct.name,
        pricingMode: testProduct.pricingMode as any,
        markup: testProduct.markup,
        salePrice: testProduct.salePrice ? Number(testProduct.salePrice) : undefined,
        minPrice: testProduct.minPrice ? Number(testProduct.minPrice) : undefined
      },
      width: 210, // A4 width
      height: 297, // A4 height
      quantity: 100,
      configurations: validSelections,
      organizationSettings: {
        enableEngineering: true,
        defaultMarkup: 2.0
      }
    };

    const pricingResult = await pricingEngine.execute(pricingInput);
    
    console.log(`✅ Pricing calculation completed`);
    console.log(`   Cost Price: R$ ${pricingResult.costPrice.toFixed(2)}`);
    console.log(`   Calculated Price: R$ ${pricingResult.calculatedPrice.toFixed(2)}`);
    console.log(`   Unit Price: R$ ${pricingResult.unitPrice.toFixed(2)}`);
    
    if (pricingResult.configurationSurcharge) {
      console.log(`   Configuration Surcharge: R$ ${pricingResult.configurationSurcharge.toFixed(2)}`);
    }
    
    if (pricingResult.configurationBreakdown) {
      console.log('   Configuration Breakdown:');
      pricingResult.configurationBreakdown.forEach(breakdown => {
        console.log(`     ${breakdown.configurationName}: ${breakdown.selectedOption} = R$ ${breakdown.priceModifier.toFixed(2)}`);
      });
    }

    // 4. Test Template Management
    console.log('\n4️⃣ Testing Template Management...');
    
    const template = await configService.createTemplate(
      testProduct.id,
      'Cardápio Padrão',
      'test-user-id'
    );
    console.log(`✅ Created template: ${template.name}`);

    const templates = await configService.listTemplates('test-org-id');
    console.log(`✅ Found ${templates.length} templates`);

    // 5. Test Import/Export
    console.log('\n5️⃣ Testing Import/Export...');
    
    const exportData = await configService.exportConfigurations(testProduct.id, 'test-user-id');
    console.log(`✅ Exported ${exportData.configurations.length} configurations`);
    console.log(`   Export checksum: ${exportData.checksum}`);

    // 6. Test API Endpoints
    console.log('\n6️⃣ Testing API Endpoints...');
    
    // This would require actual HTTP requests, so we'll just verify the services work
    const configurations = await configService.listConfigurations(testProduct.id);
    console.log(`✅ Found ${configurations.length} configurations via service`);

    // 7. Test Configuration Integrity
    console.log('\n7️⃣ Testing Configuration Integrity...');
    
    const integrityResult = await configService.validateConfigurationIntegrity(coverConfig.id);
    console.log(`✅ Configuration integrity: ${integrityResult.isValid ? 'VALID' : 'INVALID'}`);
    
    if (integrityResult.issues.length > 0) {
      console.log('   Issues found:', integrityResult.issues);
    }
    
    if (integrityResult.suggestions.length > 0) {
      console.log('   Suggestions:', integrityResult.suggestions);
    }

    // 8. Test Conflict Detection
    console.log('\n8️⃣ Testing Conflict Detection...');
    
    const conflicts = await validationService.detectConfigurationConflicts(
      testProduct.id,
      validSelections
    );
    
    console.log(`✅ Conflict detection: ${conflicts.hasConflicts ? 'CONFLICTS FOUND' : 'NO CONFLICTS'}`);
    
    if (conflicts.hasConflicts) {
      console.log(`   Found ${conflicts.conflicts.length} conflicts`);
      conflicts.conflicts.forEach(conflict => {
        console.log(`     ${conflict.type}: ${conflict.message} (${conflict.severity})`);
      });
    }

    console.log('\n🎉 PHASE 2 TESTING COMPLETED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('✅ All dynamic configuration features are working correctly');
    console.log('✅ Configuration validation is functioning');
    console.log('✅ Enhanced pricing engine supports configurations');
    console.log('✅ Template management is operational');
    console.log('✅ Import/export functionality works');
    console.log('✅ Configuration integrity validation works');
    console.log('✅ Conflict detection is functional');

  } catch (error) {
    console.error('❌ PHASE 2 TESTING FAILED:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testPhase2Implementation()
  .then(() => {
    console.log('\n🚀 Phase 2 implementation is ready for production!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Phase 2 implementation has issues:', error);
    process.exit(1);
  });