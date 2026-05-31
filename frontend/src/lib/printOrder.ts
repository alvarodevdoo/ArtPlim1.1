import api from '@/lib/api';
import { formatCurrency, formatDateTime, formatDate, getItemLengthUnit, formatLengthFromMm } from '@/lib/utils';
import { Pedido, shouldShowDimensions } from '@/types/pedidos';

export type PrintFormat = 'A4' | 'THERMAL_80';
export type PrintMode = 'order' | 'budget';

interface OrganizationInfo {
  name?: string;
  razaoSocial?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  logoFull?: string | null;
  logoIcon?: string | null;
  logoScale?: number;
}

interface PrintSettings {
  printFooterNotes?: string | null;
  printBudgetNotes?: string | null;
  validadeOrcamento?: number;
}

const DEFAULT_FOOTER = `*Funcionamento: Segunda a Sexta das 8h às 18h.
*Informamos que podem ocorrer alterações de tons das cores na impressão.
*Após 10 dias o serviço não retirado poderá ser descartado, sem reembolso.
*Após 30 dias sem comunicação, será considerado abandono de pedido e a OS será finalizada sem reembolso.`;

const DEFAULT_BUDGET = `*Este orçamento é válido por {validade} dias a partir da data de emissão.
*Os valores e prazos estão sujeitos a alteração após o vencimento.
*A produção será iniciada somente após aprovação e, quando aplicável, pagamento da entrada.`;

let cachedOrg: OrganizationInfo | null = null;
let cachedOrgPromise: Promise<OrganizationInfo | null> | null = null;
let cachedSettings: PrintSettings | null = null;
let cachedSettingsPromise: Promise<PrintSettings | null> | null = null;

async function loadOrganization(): Promise<OrganizationInfo | null> {
  if (cachedOrg) return cachedOrg;
  if (cachedOrgPromise) return cachedOrgPromise;
  cachedOrgPromise = api.get('/api/organization')
    .then(res => { cachedOrg = res.data?.data || null; return cachedOrg; })
    .catch(() => null)
    .finally(() => { cachedOrgPromise = null; });
  return cachedOrgPromise;
}

async function loadSettings(): Promise<PrintSettings | null> {
  if (cachedSettings) return cachedSettings;
  if (cachedSettingsPromise) return cachedSettingsPromise;
  cachedSettingsPromise = api.get('/api/organization/settings')
    .then(res => { cachedSettings = res.data?.data || null; return cachedSettings; })
    .catch(() => null)
    .finally(() => { cachedSettingsPromise = null; });
  return cachedSettingsPromise;
}

export function invalidatePrintCache() {
  cachedOrg = null;
  cachedSettings = null;
}

function applyBudgetPlaceholders(text: string, pedido: Pedido, settings: PrintSettings | null): string {
  const validade = settings?.validadeOrcamento ?? 7;
  const dataValidade = pedido.validUntil ? formatDate(pedido.validUntil) : '—';
  return text
    .replace(/\{validade\}/gi, String(validade))
    .replace(/\{dataValidade\}/gi, dataValidade);
}

function notesToHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<div class="note-line">${escapeHtml(line)}</div>`)
    .join('');
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAddress(org: OrganizationInfo | null): string {
  if (!org) return '';
  const parts: string[] = [];
  const line1 = [org.address, org.addressNumber].filter(Boolean).join(', ');
  if (line1) parts.push(line1);
  if (org.complement) parts.push(org.complement);
  if (org.neighborhood) parts.push(org.neighborhood);
  const cityState = [org.city, org.state].filter(Boolean).join('/');
  if (cityState) parts.push(cityState);
  if (org.zipCode) parts.push(`CEP ${org.zipCode}`);
  return parts.join(' • ');
}

function formatAddressLines(org: OrganizationInfo | null): { street: string; zip: string } {
  if (!org) return { street: '', zip: '' };
  const parts: string[] = [];
  const line1 = [org.address, org.addressNumber].filter(Boolean).join(', ');
  if (line1) parts.push(line1);
  if (org.complement) parts.push(org.complement);
  if (org.neighborhood) parts.push(org.neighborhood);
  const cityState = [org.city, org.state].filter(Boolean).join('/');
  if (cityState) parts.push(cityState);
  return {
    street: parts.join(' • '),
    zip: org.zipCode ? `CEP ${org.zipCode}` : ''
  };
}

function computeTotalsPagamento(pedido: Pedido) {
  const paidTxs = (pedido.transactions || []).filter((t: any) =>
    (t?.type === 'INCOME' || t?.type === 'CREDIT') && t?.status === 'PAID'
  );
  const totalPaid = paidTxs.reduce((sum: number, t: any) => sum + Number(t?.amount || 0), 0);
  const total = Number(pedido.total || 0);
  const pending = Math.max(total - totalPaid, 0);

  const typeLabels: Record<string, string> = {
    PIX: 'PIX',
    CASH: 'Dinheiro',
    TRANSFER: 'Transferência',
    BOLETO: 'Boleto',
    CUSTOMER_BALANCE: 'Saldo do cliente',
    OTHER: 'Outro',
  };
  const labelFor = (pm: any): string | null => {
    if (!pm?.type) return null;
    if (pm.type === 'CARD') {
      return pm.cardSubtype === 'DEBIT' ? 'Cartão de Débito' : 'Cartão de Crédito';
    }
    return typeLabels[pm.type] || pm.type;
  };
  const methodNames = Array.from(new Set(
    paidTxs.map((t: any) => labelFor(t?.paymentMethod)).filter(Boolean)
  )) as string[];

  const lastPaidDate = paidTxs.reduce<Date | null>((latest, t: any) => {
    const d = t?.paidAt || t?.paymentDate;
    if (!d) return latest;
    const candidate = new Date(d);
    if (Number.isNaN(candidate.getTime())) return latest;
    return !latest || candidate > latest ? candidate : latest;
  }, null);

  return { total, totalPaid, pending, methodNames, lastPaidDate };
}

// Desconto por item derivado: (unitário × qtd) − total líquido.
// Funciona para qualquer item sem depender de coluna/campo salvo.
function itemDiscount(item: any): number {
  const gross = Number(item.unitPrice || 0) * Number(item.quantity || 0);
  const net = Number(item.totalPrice || 0);
  const d = gross - net;
  return d > 0.009 ? d : 0;
}

function itemsDiscountTotal(items: any[]): number {
  return (items || []).reduce((sum: number, i: any) => sum + itemDiscount(i), 0);
}

// Linha auxiliar com as dimensões na unidade definida no item (cm/mm/m).
// A quantidade NÃO entra aqui pois já existe a coluna "Qtd"/linha de preço.
function itemLabelLine(item: any): string {
  if (!shouldShowDimensions(item)) return '';
  const unit = getItemLengthUnit(item);
  return `${formatLengthFromMm(Number(item.width || 0), unit)} × ${formatLengthFromMm(Number(item.height || 0), unit)} ${unit}`;
}

function buildA4Html(pedido: Pedido, org: OrganizationInfo | null, settings: PrintSettings | null, mode: PrintMode = 'order'): string {
  const isBudget = mode === 'budget';
  const docLabel = isBudget ? 'Orçamento' : 'Pedido';
  const docNumber = escapeHtml((pedido as any).orderNumber || (pedido as any).budgetNumber || '');
  const { total, totalPaid, pending, methodNames, lastPaidDate } = computeTotalsPagamento(pedido);
  const items = pedido.items || [];
  const totalDiscount = itemsDiscountTotal(items);
  const grossSubtotal = total + totalDiscount;
  const hasAnyDiscount = totalDiscount > 0.009;
  const orgName = escapeHtml(org?.name || org?.razaoSocial || '');
  const orgDoc = org?.cnpj ? `CNPJ: ${escapeHtml(org.cnpj)}` : '';
  const { street, zip } = formatAddressLines(org);
  const orgStreet = escapeHtml(street);
  const contactParts: string[] = [];
  if (zip) contactParts.push(escapeHtml(zip));
  if (org?.email) contactParts.push(escapeHtml(org.email));
  if (org?.phone) contactParts.push(`<strong>${escapeHtml(org.phone)}</strong>`);
  const orgContact = contactParts.join(' • ');

  const isPaid = totalPaid >= total - 0.01 && total > 0;
  const isPartial = totalPaid > 0 && !isPaid;
  const finStatusLabel = total <= 0
    ? 'Sem cobrança'
    : isPaid ? 'PAGO'
    : isPartial ? 'PARCIALMENTE PAGO'
    : 'PENDENTE';
  const finStatusColor = isPaid ? '#047857' : isPartial ? '#b45309' : '#b91c1c';
  const finStatusBg = isPaid ? '#ecfdf5' : isPartial ? '#fffbeb' : '#fef2f2';

  const itemsRows = items.map((item: any, idx: number) => {
    const detailLines: string[] = [];
    if (item.paperType) detailLines.push(`Papel: ${escapeHtml(item.paperType)}`);
    if (item.printColors) detailLines.push(`Cores: ${escapeHtml(item.printColors)}`);
    if (item.notes) detailLines.push(`Obs: ${escapeHtml(item.notes)}`);
    const details = detailLines.length ? `<div class="item-details">${detailLines.join(' • ')}</div>` : '';
    const disc = itemDiscount(item);
    const gross = Number(item.unitPrice || 0) * Number(item.quantity || 0);
    const discCell = hasAnyDiscount
      ? `<td class="money discount">${disc > 0 ? `- ${formatCurrency(disc)}` : '—'}</td>`
      : '';
    return `
      <tr>
        <td class="num">${idx + 1}</td>
        <td>
          <div class="item-name">${escapeHtml(item.product?.name || item.description || 'Item')}</div>
          ${(() => { const lbl = itemLabelLine(item); return lbl ? `<div class="item-sub">${escapeHtml(lbl)}</div>` : ''; })()}
          ${details}
        </td>
        <td class="qty">${escapeHtml(item.quantity)}</td>
        <td class="money">${formatCurrency(Number(item.unitPrice || 0))}</td>
        ${discCell}
        <td class="money strong">${formatCurrency(hasAnyDiscount ? Number(item.totalPrice || 0) : gross)}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${docLabel} ${docNumber}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; padding: 18mm; }
  h1, h2, h3 { margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 16px; gap: 20px; }
  .header .left { display: flex; align-items: center; gap: 16px; flex: 1 1 auto; min-width: 0; }
  .header .logo-box { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .header .logo { width: auto; max-width: 200px; object-fit: contain; display: block; }
  .header .company { display: flex; flex-direction: column; justify-content: center; flex: 1 1 auto; min-width: 0; }
  .header .company .name { font-size: 17px; font-weight: 700; }
  .header .company .line { font-size: 11px; color: #444; margin-top: 2px; }
  .header .order { text-align: right; flex-shrink: 0; min-width: 150px; }
  .header .order .label { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .header .order .number { font-size: 22px; font-weight: 800; }
  .header .order .date { font-size: 11px; color: #555; margin-top: 2px; }
  .section { margin-bottom: 14px; }
  .section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 6px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; font-size: 12px; }
  .grid div span.k { color: #666; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #f3f4f6; text-align: left; padding: 6px 8px; border-bottom: 1px solid #ccc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #333; }
  tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  td.num { width: 24px; color: #777; }
  td.qty { width: 50px; text-align: center; }
  td.money { width: 110px; text-align: right; white-space: nowrap; }
  td.money.strong, .totals .row.grand .v { font-weight: 700; }
  .item-name { font-weight: 600; }
  .item-sub, .item-details { font-size: 10.5px; color: #666; margin-top: 2px; }
  td.money.discount { color: #b91c1c; font-weight: 600; width: 100px; }
  .totals { margin-top: 10px; display: flex; justify-content: flex-end; }
  .totals .box { width: 280px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals .row.grand { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 4px; font-size: 14px; }
  .totals .row.pending { color: #b91c1c; }
  .totals .row.paid { color: #047857; align-items: flex-start; }
  .totals .row.paid .pay-info { display: flex; flex-direction: column; gap: 1px; }
  .totals .row.paid .pay-line { font-weight: 600; }
  .totals .row.paid .pay-date { font-size: 10.5px; color: #4b5563; font-weight: 400; }
  .totals .fin-status { margin-top: 8px; padding: 6px 10px; border-radius: 4px; text-align: center; font-size: 11.5px; letter-spacing: 0.5px; text-transform: uppercase; }
  .totals .delivery-line { margin-top: 6px; padding: 6px 10px; border-radius: 4px; background: #f0f9ff; border: 1px solid #bae6fd; display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 11.5px; }
  .totals .delivery-line .dl-label { color: #0369a1; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10.5px; }
  .totals .delivery-line .dl-value { font-weight: 800; color: #0c4a6e; font-size: 13px; }
  .notes { margin-top: 14px; padding: 8px 10px; background: #fafafa; border: 1px solid #eee; border-radius: 4px; font-size: 11px; white-space: pre-wrap; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px dashed #ccc; font-size: 10px; color: #777; text-align: center; }
  .delivery-box { margin-top: 10px; padding: 5px 10px; border: 1px solid #bae6fd; background: #f0f9ff; border-radius: 4px; display: inline-flex; gap: 8px; align-items: baseline; }
  .delivery-box.empty { border-color: #e2e8f0; background: #f8fafc; }
  .delivery-box .delivery-label { font-size: 10px; font-weight: 600; color: #0369a1; text-transform: uppercase; letter-spacing: 0.5px; }
  .delivery-box.empty .delivery-label { color: #64748b; }
  .delivery-box .delivery-date { font-size: 12px; font-weight: 700; color: #0c4a6e; }
  .delivery-box.empty .delivery-date { color: #64748b; font-weight: 500; }
  .info-block { font-size: 11px; line-height: 1.55; color: #333; padding: 8px 10px; background: #fafafa; border: 1px solid #eee; border-radius: 4px; }
  .info-block.budget { background: #fff7ed; border-color: #fed7aa; }
  .info-block .note-line { padding: 1px 0; }
  @media print {
    body { padding: 12mm; }
    .no-print { display: none !important; }
  }
  @page { size: A4; margin: 0; }
</style>
</head>
<body>
  <div class="header">
    <div class="left">
      ${(() => {
        if (!org?.logoFull) return '';
        const scale = Math.max(50, Math.min(100, org.logoScale ?? 100));
        const maxH = Math.round(70 * (scale / 100));
        return `<div class="logo-box"><img class="logo" src="${escapeHtml(org.logoFull)}" alt="Logo" style="max-height:${maxH}px" /></div>`;
      })()}
      <div class="company">
        <div class="name">${orgName || '&nbsp;'}</div>
        ${orgDoc ? `<div class="line">${orgDoc}</div>` : ''}
        ${orgStreet ? `<div class="line">${orgStreet}</div>` : ''}
        ${orgContact ? `<div class="line">${orgContact}</div>` : ''}
      </div>
    </div>
    <div class="order">
      <div class="label">${docLabel}</div>
      <div class="number">${docNumber}</div>
      <div class="date">Emitido em ${formatDateTime(pedido.createdAt)}</div>
    </div>
  </div>

  <div class="section">
    <h2>Cliente</h2>
    <div class="grid">
      <div><span class="k">Nome:</span> ${escapeHtml(pedido.customer?.name || '')}</div>
      <div><span class="k">Telefone:</span> ${escapeHtml(pedido.customer?.phone || '—')}</div>
      ${pedido.customer?.email ? `<div><span class="k">E-mail:</span> ${escapeHtml(pedido.customer.email)}</div>` : ''}
    </div>
  </div>

  ${(() => {
    const tpl = isBudget
      ? applyBudgetPlaceholders((settings?.printBudgetNotes && settings.printBudgetNotes.trim()) || DEFAULT_BUDGET, pedido, settings)
      : ((settings?.printFooterNotes && settings.printFooterNotes.trim()) || DEFAULT_FOOTER);
    return `<div class="section"><h2>Avisos</h2><div class="info-block${isBudget ? ' budget' : ''}">${notesToHtml(tpl)}</div></div>`;
  })()}

  <div class="section">
    <h2>Itens</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Descrição</th>
          <th style="text-align:center">Qtd</th>
          <th style="text-align:right">Valor unit.</th>
          ${hasAnyDiscount ? '<th style="text-align:right">Desconto</th>' : ''}
          <th style="text-align:right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows || `<tr><td colspan="${hasAnyDiscount ? 6 : 5}" style="text-align:center;color:#888;padding:18px">Sem itens</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="box">
        ${totalDiscount > 0 ? `
          <div class="row"><span>Subtotal</span><span class="v">${formatCurrency(grossSubtotal)}</span></div>
          <div class="row pending"><span>Desconto</span><span class="v">- ${formatCurrency(totalDiscount)}</span></div>
        ` : ''}
        <div class="row grand"><span>Total</span><span class="v">${formatCurrency(total)}</span></div>
        ${isBudget ? `
        <div class="delivery-line">
          <span class="dl-label">Validade do Orçamento</span>
          <span class="dl-value">${pedido.validUntil ? formatDate(pedido.validUntil) : 'A combinar'}</span>
        </div>
        ` : `
        ${totalPaid > 0 ? `
          <div class="row paid">
            <span class="pay-info">
              <span class="pay-line">${methodNames.length ? escapeHtml(methodNames.join(', ')) : 'Pago'}</span>
              ${lastPaidDate ? `<span class="pay-date">em ${formatDate(lastPaidDate)}</span>` : ''}
            </span>
            <span class="v">- ${formatCurrency(totalPaid)}</span>
          </div>
        ` : ''}
        ${pending > 0 && totalPaid > 0 ? `<div class="row pending"><span>Saldo pendente</span><span class="v">${formatCurrency(pending)}</span></div>` : ''}
        ${isPartial ? '' : `<div class="fin-status" style="background:${finStatusBg};color:${finStatusColor};border:1px solid ${finStatusColor}33">
          Situação financeira: <strong>${finStatusLabel}</strong>
        </div>`}
        <div class="delivery-line">
          <span class="dl-label">Prazo de Entrega</span>
          <span class="dl-value">${pedido.deliveryDate ? formatDate(pedido.deliveryDate) : 'A combinar'}</span>
        </div>
        `}
      </div>
    </div>
  </div>

  ${pedido.notes ? `<div class="section"><h2>Observações</h2><div class="notes">${escapeHtml(pedido.notes)}</div></div>` : ''}

  <div class="footer">Documento gerado em ${formatDateTime(new Date())} — não possui valor fiscal.</div>
</body>
</html>`;
}

function buildThermalHtml(pedido: Pedido, org: OrganizationInfo | null, settings: PrintSettings | null, mode: PrintMode = 'order'): string {
  const isBudget = mode === 'budget';
  const docLabel = isBudget ? 'ORÇAMENTO' : 'PEDIDO';
  const docNumber = escapeHtml((pedido as any).orderNumber || (pedido as any).budgetNumber || '');
  const { total, totalPaid, pending, methodNames } = computeTotalsPagamento(pedido);
  const items = pedido.items || [];
  const totalDiscount = itemsDiscountTotal(items);
  const grossSubtotal = total + totalDiscount;
  const orgName = escapeHtml(org?.name || org?.razaoSocial || '');
  const orgDoc = org?.cnpj ? `CNPJ ${escapeHtml(org.cnpj)}` : '';
  const orgPhone = org?.phone ? `Tel: ${escapeHtml(org.phone)}` : '';
  const orgAddress = escapeHtml(formatAddress(org));

  const isPaid = totalPaid >= total - 0.01 && total > 0;
  const isPartial = totalPaid > 0 && !isPaid;
  const finStatusLabel = total <= 0
    ? 'SEM COBRANCA'
    : isPaid ? 'PAGO'
    : isPartial ? 'PARCIAL'
    : 'PENDENTE';

  const itemBlocks = items.map((item: any) => {
    const name = escapeHtml(item.product?.name || item.description || 'Item');
    const qty = Number(item.quantity || 0);
    const unit = Number(item.unitPrice || 0);
    // Só mostra a linha auxiliar quando ela carrega informação extra (dimensões),
    // evitando duplicar a quantidade que já aparece em "1 x R$ ...".
    const showSub = shouldShowDimensions(item);
    const sub = showSub ? escapeHtml(itemLabelLine(item)) : '';
    return `
      <div class="item">
        <div class="item-name">${name}</div>
        ${sub ? `<div class="item-sub">${sub}</div>` : ''}
        <div class="item-row"><span>${qty} x ${formatCurrency(unit)}</span><span>${formatCurrency(unit * qty)}</span></div>
      </div>
    `;
  }).join('');

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${docLabel} ${docNumber}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Consolas', 'Lucida Console', 'Courier New', monospace;
    color: #000;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
    width: 72mm;
    padding: 2mm;
    -webkit-font-smoothing: none;
    font-smooth: never;
    text-rendering: geometricPrecision;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 900; }
  .lg { font-size: 16px; font-weight: 900; }
  .sm { font-size: 12px; font-weight: 700; }
  .hr { border-top: 2px dashed #000; margin: 5px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .item { margin: 5px 0; }
  .item-name { font-weight: 900; }
  .item-sub { font-size: 12px; font-weight: 700; color: #000; }
  .item-row { display: flex; justify-content: space-between; font-variant-numeric: tabular-nums; font-weight: 700; }
  .totals .row { font-size: 13.5px; font-weight: 700; padding: 2px 0; }
  .totals .grand { font-size: 16px; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 3px; }
  .muted { color: #000; font-weight: 700; }
  .logo-thermal { display: block; max-width: 100%; max-height: 22mm; object-fit: contain; margin: 0 auto 4px; }
  .order-title { font-size: 20px; font-weight: 900; letter-spacing: 1px; text-align: center; padding: 4px 0 2px; }
  .order-date { font-size: 12px; font-weight: 700; text-align: center; }
  @page { size: 80mm auto; margin: 0; }
  @media print {
    body { width: 80mm; padding: 3mm; font-weight: 700; }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
  ${org?.logoIcon || org?.logoFull ? `<img class="logo-thermal" src="${escapeHtml(org.logoIcon || org.logoFull || '')}" alt="Logo" />` : ''}
  <div class="center bold lg">${orgName || '&nbsp;'}</div>
  ${orgDoc ? `<div class="center sm">${orgDoc}</div>` : ''}
  ${orgAddress ? `<div class="center sm">${orgAddress}</div>` : ''}
  ${orgPhone ? `<div class="center sm">${orgPhone}</div>` : ''}

  <div class="hr"></div>
  <div class="order-title">${docLabel} ${docNumber}</div>
  <div class="order-date">${formatDateTime(pedido.createdAt)}</div>

  <div class="hr"></div>
  <div class="bold">Cliente</div>
  <div>${escapeHtml(pedido.customer?.name || '-')}</div>
  <div class="sm">Tel: ${escapeHtml(pedido.customer?.phone || '-')}</div>

  ${(() => {
    const tpl = isBudget
      ? applyBudgetPlaceholders((settings?.printBudgetNotes && settings.printBudgetNotes.trim()) || DEFAULT_BUDGET, pedido, settings)
      : ((settings?.printFooterNotes && settings.printFooterNotes.trim()) || DEFAULT_FOOTER);
    const lines = tpl.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    return `<div class="hr"></div><div class="bold">Avisos</div>${lines.map(l => `<div class="sm">${escapeHtml(l)}</div>`).join('')}`;
  })()}

  <div class="hr"></div>
  <div class="bold">Itens</div>
  ${itemBlocks || '<div class="sm muted">Sem itens</div>'}

  <div class="hr"></div>
  <div class="totals">
    ${totalDiscount > 0 ? `
      <div class="row"><span>Subtotal</span><span>${formatCurrency(grossSubtotal)}</span></div>
      <div class="row"><span>Desconto</span><span>- ${formatCurrency(totalDiscount)}</span></div>
    ` : ''}
    <div class="row grand"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
    ${!isBudget && totalPaid > 0 ? `
      <div class="row"><span>${methodNames.length ? escapeHtml(methodNames.join(', ')) : 'Pago'}</span><span>- ${formatCurrency(totalPaid)}</span></div>
    ` : ''}
    ${!isBudget && pending > 0 && totalPaid > 0 ? `<div class="row"><span>Saldo pendente</span><span>${formatCurrency(pending)}</span></div>` : ''}
  </div>
  ${isBudget || isPartial ? '' : `<div class="hr"></div><div class="center bold">SITUACAO: ${finStatusLabel}</div>`}

  <div class="hr"></div>
  ${isBudget
    ? `<div class="row"><span class="bold">Validade</span><span class="bold">${pedido.validUntil ? formatDate(pedido.validUntil) : 'A combinar'}</span></div>`
    : `<div class="row"><span class="bold">Previsao de Entrega</span><span class="bold">${pedido.deliveryDate ? formatDate(pedido.deliveryDate) : 'A combinar'}</span></div>`}
  ${pedido.notes ? `<div class="hr"></div><div class="sm"><span class="bold">Obs:</span> ${escapeHtml(pedido.notes)}</div>` : ''}

  <div class="hr"></div>
  <div class="center sm">Obrigado pela preferência!</div>
  <div class="center sm muted">${formatDateTime(new Date())}</div>
</body>
</html>`;
}

const PRINT_WINDOW_NAME = 'artplim_print_window';
let printWindowRef: Window | null = null;

// 80mm ≈ 302px @ 96dpi. Soma um pouco para padding/scrollbar.
const WINDOW_DIMENSIONS: Record<PrintFormat, { w: number; h: number }> = {
  A4: { w: 900, h: 900 },
  THERMAL_80: { w: 360, h: 800 },
};

export function buildOrderPlainText(
  pedido: Pedido,
  org: OrganizationInfo | null,
  settings: PrintSettings | null,
  mode: PrintMode = 'order'
): string {
  const isBudget = mode === 'budget';
  const docLabel = isBudget ? 'Orçamento' : 'Pedido';
  const docNumber = (pedido as any).orderNumber || (pedido as any).budgetNumber || '';
  const { total, totalPaid, pending, methodNames, lastPaidDate } = computeTotalsPagamento(pedido);
  const items = pedido.items || [];
  const lines: string[] = [];

  // === Cabeçalho da empresa (como no topo do A4) ===
  const company = org?.name || org?.razaoSocial;
  if (company) lines.push(`*${company}*`);
  if (org?.cnpj) lines.push(`CNPJ: ${org.cnpj}`);
  const { street, zip } = formatAddressLines(org);
  if (street) lines.push(street);
  const contactParts: string[] = [];
  if (zip) contactParts.push(zip);
  if (org?.email) contactParts.push(org.email);
  if (org?.phone) contactParts.push(org.phone);
  if (contactParts.length) lines.push(contactParts.join(' • '));

  // Separador visual (igual à linha do A4)
  lines.push('');
  lines.push(`*${docLabel} ${docNumber}*`);
  lines.push(`Emitido em ${formatDateTime(pedido.createdAt)}`);
  lines.push('');

  // === Cliente ===
  if (pedido.customer?.name) {
    lines.push('*CLIENTE*');
    lines.push(`Nome: ${pedido.customer.name}`);
    lines.push(`Telefone: ${pedido.customer.phone || '—'}`);
    lines.push('');
  }

  // === Avisos (mesma posição do A4) ===
  const noteTpl = isBudget
    ? applyBudgetPlaceholders((settings?.printBudgetNotes && settings.printBudgetNotes.trim()) || DEFAULT_BUDGET, pedido, settings)
    : ((settings?.printFooterNotes && settings.printFooterNotes.trim()) || null);
  if (noteTpl) {
    lines.push('*AVISOS*');
    noteTpl.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(l => lines.push(l));
    lines.push('');
  }

  // === Itens ===
  if (items.length > 0) {
    lines.push('*ITENS*');
    items.forEach((item: any, idx: number) => {
      const name = item.product?.name || item.description || 'Item';
      const qty = Number(item.quantity || 0);
      const unit = Number(item.unitPrice || 0);
      const dimUnit = getItemLengthUnit(item);
      const dimensions = shouldShowDimensions(item)
        ? ` (${formatLengthFromMm(Number(item.width || 0), dimUnit)}×${formatLengthFromMm(Number(item.height || 0), dimUnit)} ${dimUnit})`
        : '';
      const disc = itemDiscount(item);
      lines.push(`${idx + 1}. ${name}${dimensions}`);
      lines.push(`   ${qty} × ${formatCurrency(unit)} = ${formatCurrency(unit * qty)}`);
      if (disc > 0) lines.push(`   Desconto neste item: -${formatCurrency(disc)} (líquido ${formatCurrency(Number(item.totalPrice || 0))})`);
      if (item.notes) lines.push(`   Obs: ${item.notes}`);
    });
    lines.push('');
  }

  // === Totais (mesma sequência do A4: Subtotal → Desconto → Total → ...) ===
  const totalDiscount = itemsDiscountTotal(items);
  if (totalDiscount > 0) {
    lines.push(`Subtotal: ${formatCurrency(total + totalDiscount)}`);
    lines.push(`Desconto: -${formatCurrency(totalDiscount)}`);
  }
  lines.push(`*Total: ${formatCurrency(total)}*`);
  if (!isBudget) {
    if (totalPaid > 0) {
      const method = methodNames.length ? methodNames.join(', ') : 'Pago';
      const date = lastPaidDate ? ` em ${formatDate(lastPaidDate)}` : '';
      lines.push(`${method}${date}: -${formatCurrency(totalPaid)}`);
    }
    if (pending > 0 && totalPaid > 0) {
      lines.push(`Saldo pendente: ${formatCurrency(pending)}`);
    } else if (pending === 0 && totalPaid > 0 && total > 0) {
      lines.push('Situação financeira: *PAGO*');
    } else if (totalPaid === 0 && total > 0) {
      lines.push('Situação financeira: *PENDENTE*');
    }
  }

  // === Prazo de Entrega / Validade (mesmo badge do A4) ===
  lines.push('');
  if (isBudget) {
    lines.push(`Validade do Orçamento: *${pedido.validUntil ? formatDate(pedido.validUntil) : 'A combinar'}*`);
  } else {
    lines.push(`Prazo de Entrega: *${pedido.deliveryDate ? formatDate(pedido.deliveryDate) : 'A combinar'}*`);
  }

  // === Observações do pedido (se houver) ===
  if (pedido.notes) {
    lines.push('');
    lines.push('*Observações*');
    lines.push(pedido.notes);
  }

  // === Rodapé ===
  lines.push('');
  lines.push(`_Documento gerado em ${formatDateTime(new Date())} — não possui valor fiscal._`);

  return lines
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Renderiza o A4 num iframe oculto e devolve o canvas pronto pra exportar.
// Usado tanto pelo PDF quanto pela cópia como imagem.
async function renderA4Canvas(pedido: Pedido, mode: PrintMode = 'order'): Promise<HTMLCanvasElement> {
  const [org, settings] = await Promise.all([loadOrganization(), loadSettings()]);
  const pdfOrg = org
    ? { ...org, logoScale: Math.round((org.logoScale ?? 100) * 0.65) }
    : org;
  const html = buildA4Html(pedido, pdfOrg, settings, mode);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = '0';
  iframe.style.zIndex = '-1';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();

    const marginOverride = doc.createElement('style');
    marginOverride.textContent = `body { padding: 12.7mm !important; }`;
    doc.head.appendChild(marginOverride);

    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') resolve();
      else iframe.addEventListener('load', () => resolve(), { once: true });
    });
    if ((doc as any).fonts?.ready) {
      try { await (doc as any).fonts.ready; } catch { /* noop */ }
    }
    const imgs = Array.from(doc.images || []);
    await Promise.all(imgs.map(img => img.complete && img.naturalWidth > 0
      ? Promise.resolve()
      : new Promise<void>(res => {
          img.addEventListener('load', () => res(), { once: true });
          img.addEventListener('error', () => res(), { once: true });
        })
    ));

    const scrollH = Math.max(doc.documentElement.scrollHeight, doc.body.scrollHeight);
    iframe.style.height = `${scrollH}px`;

    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: doc.body.scrollWidth,
      windowHeight: scrollH,
    });

    // Corta o espaço em branco abaixo do último conteúdo (o .footer ou, se ausente,
    // o último elemento real do body). Mantém ~12mm de respiro depois dele.
    const lastEl =
      (doc.body.querySelector('.footer') as HTMLElement | null) ||
      (doc.body.lastElementChild as HTMLElement | null);
    if (lastEl) {
      const bodyTop = doc.body.getBoundingClientRect().top;
      const lastBottom = lastEl.getBoundingClientRect().bottom - bodyTop;
      const scaleY = canvas.height / scrollH;
      const breathingMm = 12;
      const breathingPx = (breathingMm * 96 / 25.4) * scaleY; // mm → px na escala do canvas
      const cropH = Math.min(canvas.height, Math.ceil(lastBottom * scaleY + breathingPx));

      if (cropH < canvas.height) {
        const cropped = document.createElement('canvas');
        cropped.width = canvas.width;
        cropped.height = cropH;
        const ctx = cropped.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cropped.width, cropped.height);
        ctx.drawImage(canvas, 0, 0);
        return cropped;
      }
    }
    return canvas;
  } finally {
    iframe.remove();
  }
}

export async function copyOrderToClipboard(pedido: Pedido, mode: PrintMode = 'order'): Promise<void> {
  const [org, settings] = await Promise.all([loadOrganization(), loadSettings()]);
  const plainText = buildOrderPlainText(pedido, org, settings, mode);

  // Tenta copiar como imagem (mesmo visual do PDF) + texto fallback.
  // Em alvos que aceitam imagem (WhatsApp Web, Word, Gmail) cola a imagem;
  // em alvos só-texto (terminal, txt) cola o texto.
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      const canvas = await renderA4Canvas(pedido, mode);
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Falha ao gerar imagem')), 'image/png')
      );

      const item = new ClipboardItem({
        'image/png': blob,
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      return;
    } catch (err) {
      // Fallback para text/plain se write falhar (Safari antigo, política de permissão)
      console.warn('Cópia como imagem falhou, caindo para texto:', err);
    }
  }

  await navigator.clipboard.writeText(plainText);
}

export async function generateOrderPdf(pedido: Pedido, mode: PrintMode = 'order') {
  const canvas = await renderA4Canvas(pedido, mode);
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let heightLeft = imgH;
  let position = 0;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
  heightLeft -= pageH;

  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
  }

  const fileName = (pedido as any).orderNumber || (pedido as any).budgetNumber || (mode === 'budget' ? 'orcamento' : 'pedido');
  pdf.save(`${fileName}.pdf`);
}

export async function printOrder(pedido: Pedido, format: PrintFormat, mode: PrintMode = 'order') {
  const [org, settings] = await Promise.all([loadOrganization(), loadSettings()]);
  const html = format === 'A4' ? buildA4Html(pedido, org, settings, mode) : buildThermalHtml(pedido, org, settings, mode);
  const { w, h } = WINDOW_DIMENSIONS[format];

  let printWindow: Window | null = printWindowRef && !printWindowRef.closed ? printWindowRef : null;

  if (!printWindow) {
    printWindow = window.open('', PRINT_WINDOW_NAME, `width=${w},height=${h}`);
    if (!printWindow) {
      alert('Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.');
      return;
    }
    printWindowRef = printWindow;
  } else {
    // Janela reaproveitada: redimensiona para combinar com o novo formato.
    try { printWindow.resizeTo(w, h); } catch { /* noop */ }
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    try {
      printWindow!.focus();
      printWindow!.print();
    } catch {
      /* noop */
    }
  };

  if (printWindow.document.readyState === 'complete') {
    setTimeout(triggerPrint, 150);
  } else {
    printWindow.addEventListener('load', () => setTimeout(triggerPrint, 150));
  }
}

// ── Wrappers para Orçamento ───────────────────────────────────────────
// Reaproveitam o mesmo motor de impressão dos pedidos, no modo 'budget'.
export function printBudget(budget: Pedido, format: PrintFormat) {
  return printOrder(budget, format, 'budget');
}

export function generateBudgetPdf(budget: Pedido) {
  return generateOrderPdf(budget, 'budget');
}

export function copyBudgetToClipboard(budget: Pedido) {
  return copyOrderToClipboard(budget, 'budget');
}
