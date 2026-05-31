/**
 * Seed de demonstração: Placa Pix
 *
 * Cria um produto que exemplifica os dois padrões discutidos:
 *  1. Variação SELECT com priceModifier 0 nas opções → informação estruturada
 *     de produção (Com base / Sem base), sem afetar preço (o corte já calcula).
 *  2. Acabamento SELECT (kind=FINISHING) com allowCustomQty → extra opcional
 *     com quantidade variável (Montagem cobrada por hora estimada).
 *
 * Uso:
 *   pnpm exec tsx scripts/seed-placa-pix.ts
 */
import {
  ConfigurationType,
  ConfigurationKind,
  PricingMode,
  ItemType,
} from '@prisma/client';
import { prisma } from '../src/shared/infrastructure/database/prisma';

async function main() {
  console.log('🌱 Seed Placa Pix — exemplo dos padrões Variação + Acabamento');

  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error('❌ Nenhuma organização encontrada. Crie uma primeiro.');
    process.exit(1);
  }
  console.log(`📋 Organização: ${org.name}`);

  // ──────────────────────────────────────────────────────────────────────
  // Data migration: preservar comportamento histórico de "Preço Base"
  // (fixedValue/priceOverride). Antes da refatoração de 3 estados, opções
  // com fixedValue > 0 e priceModifierType='FIXED' (default) eram tratadas
  // como rate override (PER_AREA). Após a refatoração, FIXED virou "soma
  // fixa no total". Para evitar quebrar dados antigos, marcamos PER_AREA.
  // Idempotente — só afeta opções legadas com fixedValue/priceOverride.
  // ──────────────────────────────────────────────────────────────────────
  const migrated = await prisma.$executeRawUnsafe(`
    UPDATE configuration_options
    SET "priceModifierType" = 'PER_AREA'
    WHERE (("fixedValue" IS NOT NULL AND "fixedValue" > 0)
        OR ("priceOverride" IS NOT NULL AND "priceOverride" > 0))
      AND ("priceModifierType" = 'FIXED' OR "priceModifierType" IS NULL)
  `).catch(() => 0);
  if (Number(migrated) > 0) {
    console.log(`🔧 Migrated ${migrated} legacy option(s) with fixedValue → PER_AREA (preserva comportamento histórico de rate override)`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Produto — Placa Pix (cria ou atualiza)
  // ──────────────────────────────────────────────────────────────────────
  const produtoNome = 'Placa Pix';
  const descricao =
    'Placa em acrílico branco para QR Code Pix. ' +
    'Pode ser de parede (sem base) ou de balcão (com base). ' +
    'Montagem opcional, cobrada por hora.';

  const existing = await prisma.product.findFirst({
    where: { organizationId: org.id, name: produtoNome },
  });

  const placa = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: { description: descricao, salePrice: 150.0, active: true },
      })
    : await prisma.product.create({
        data: {
          name: produtoNome,
          description: descricao,
          productType: ItemType.PRODUCT,
          pricingMode: PricingMode.SIMPLE_AREA,
          salePrice: 150.0,
          markup: 2.0,
          active: true,
          organization: { connect: { id: org.id } },
        },
      });
  console.log(`✅ Produto: ${placa.name} (id=${placa.id})`);

  // Limpa configurações anteriores para garantir idempotência do exemplo
  await prisma.productConfiguration.deleteMany({
    where: { productId: placa.id },
  });

  // ──────────────────────────────────────────────────────────────────────
  // 1. VARIAÇÃO "Base" — Com base / Sem base, ambos priceModifier 0
  //    Demonstra: informação estruturada de produção SEM afetar preço.
  // ──────────────────────────────────────────────────────────────────────
  const cfgBase = await prisma.productConfiguration.create({
    data: {
      product: { connect: { id: placa.id } },
      name: 'Base',
      description:
        'Indica se a placa terá base de apoio (balcão) ou não (parede). ' +
        'Não afeta o preço — o corte já contempla a área total da base.',
      type: ConfigurationType.SELECT,
      kind: ConfigurationKind.VARIATION,
      required: true,
      displayOrder: 1,
      affectsPricing: false,
      options: {
        create: [
          {
            label: 'Sem base',
            value: 'sem_base',
            priceModifier: 0,
            displayOrder: 1,
          },
          {
            label: 'Com base',
            value: 'com_base',
            priceModifier: 0,
            displayOrder: 2,
          },
        ],
      },
    },
    include: { options: true },
  });
  console.log(
    `✅ Variação: ${cfgBase.name} → ${cfgBase.options
      .map((o) => o.label)
      .join(', ')} (preço 0 em ambas)`
  );

  // ──────────────────────────────────────────────────────────────────────
  // 2. ACABAMENTO "Acabamentos" — Montagem com allowCustomQty
  //    Demonstra: extra opcional combinável + quantidade variável.
  // ──────────────────────────────────────────────────────────────────────
  const cfgAcab = await prisma.productConfiguration.create({
    data: {
      product: { connect: { id: placa.id } },
      name: 'Acabamentos',
      description:
        'Extras opcionais que somam ao preço. Pode selecionar várias.',
      type: ConfigurationType.SELECT,
      kind: ConfigurationKind.FINISHING,
      required: false,
      displayOrder: 2,
      affectsPricing: true,
      options: {
        create: [
          {
            label: 'Montagem',
            value: 'montagem',
            // R$ por unidade (hora estimada) — multiplicado pela qty no orçamento
            priceModifier: 60.0,
            priceModifierType: 'FIXED',
            allowCustomQty: true,
            defaultQuantity: 1,
            minQuantity: 0.5,
            maxQuantity: 10,
            displayOrder: 1,
          },
          {
            // Preço fixo: marca/desmarca, sem stepper
            label: 'Laminação',
            value: 'laminacao',
            priceModifier: 25.0,
            priceModifierType: 'FIXED',
            allowCustomQty: false,
            displayOrder: 2,
          },
          {
            // Qty editável: número de furos
            label: 'Furo',
            value: 'furo',
            priceModifier: 3.0,
            priceModifierType: 'FIXED',
            allowCustomQty: true,
            defaultQuantity: 2,
            minQuantity: 1,
            maxQuantity: 20,
            displayOrder: 3,
          },
          {
            // Preço fixo
            label: 'Corte arredondado',
            value: 'corte_arredondado',
            priceModifier: 15.0,
            priceModifierType: 'FIXED',
            allowCustomQty: false,
            displayOrder: 4,
          },
        ],
      },
    },
    include: { options: true },
  });
  console.log(
    `✅ Acabamento: ${cfgAcab.name}`
  );
  cfgAcab.options.forEach((o) => {
    const qtyHint = o.allowCustomQty
      ? `qty editável (default ${o.defaultQuantity})`
      : 'preço fixo';
    console.log(`     • ${o.label} — R$ ${o.priceModifier}/un · ${qtyHint}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // SEGUNDO PRODUTO: Adesivo Plotado — demonstra PER_AREA vs FIXED
  //   • salePrice R$ 25/m² (rate base)
  //   • Acabamento "Corte e contorno" PER_AREA +R$ 5/m² → vira R$ 30/m²
  //   • Acabamento "Ilhós" FIXED R$ 0,50/un (qty editável) → soma fixa
  // ──────────────────────────────────────────────────────────────────────
  const adesivoNome = 'Adesivo Plotado';
  const adesivoDesc =
    'Adesivo plotado vendido por m². Corte e contorno soma ao R$/m² ' +
    '(multiplicado pela área). Ilhós soma fixo (R$ × quantidade).';

  const existingAdesivo = await prisma.product.findFirst({
    where: { organizationId: org.id, name: adesivoNome },
  });

  const adesivo = existingAdesivo
    ? await prisma.product.update({
        where: { id: existingAdesivo.id },
        data: { description: adesivoDesc, salePrice: 25.0, active: true },
      })
    : await prisma.product.create({
        data: {
          name: adesivoNome,
          description: adesivoDesc,
          productType: ItemType.PRODUCT,
          pricingMode: PricingMode.SIMPLE_AREA,
          salePrice: 25.0,
          markup: 2.0,
          active: true,
          organization: { connect: { id: org.id } },
        },
      });

  await prisma.productConfiguration.deleteMany({
    where: { productId: adesivo.id },
  });

  const adesivoAcab = await prisma.productConfiguration.create({
    data: {
      product: { connect: { id: adesivo.id } },
      name: 'Acabamentos',
      description: 'Mistura de modificadores PER_AREA e FIXED.',
      type: ConfigurationType.SELECT,
      kind: ConfigurationKind.FINISHING,
      required: false,
      displayOrder: 1,
      affectsPricing: true,
      options: {
        create: [
          {
            label: 'Corte e contorno',
            value: 'corte_contorno',
            priceModifier: 5.0,
            priceModifierType: 'PER_AREA', // ← soma ao R$/m²
            allowCustomQty: false,
            displayOrder: 1,
          },
          {
            label: 'Ilhós',
            value: 'ilhos',
            priceModifier: 0.5,
            priceModifierType: 'FIXED', // ← soma fixa no total
            allowCustomQty: true,
            defaultQuantity: 10,
            minQuantity: 1,
            maxQuantity: 100,
            displayOrder: 2,
          },
        ],
      },
    },
    include: { options: true },
  });
  console.log(`\n✅ Produto: ${adesivo.name} (id=${adesivo.id})`);
  console.log(`   R$ ${adesivo.salePrice}/m² base`);
  adesivoAcab.options.forEach((o) => {
    const scope =
      (o as any).priceModifierType === 'PER_AREA'
        ? 'PER_AREA (soma ao R$/m²)'
        : 'FIXED (soma fixa no total)';
    const qty = o.allowCustomQty
      ? ` × qty editável (default ${o.defaultQuantity})`
      : '';
    console.log(`     • ${o.label} — R$ ${o.priceModifier}${qty} · ${scope}`);
  });

  console.log('\n✨ Pronto. Abra o produto "Placa Pix" na aba Variações.');
  console.log('   No orçamento/venda você verá:');
  console.log('     • Dropdown "Base" obrigatório (Sem base / Com base, R$ 0)');
  console.log('     • Acabamentos (multi-select, marque os que quiser):');
  console.log('         - Montagem (R$ 60 × horas)   ← stepper de qty');
  console.log('         - Laminação (R$ 25)          ← chip simples');
  console.log('         - Furo (R$ 3 × unidades)     ← stepper de qty');
  console.log('         - Corte arredondado (R$ 15)  ← chip simples');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
