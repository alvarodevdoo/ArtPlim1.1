import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { getTenantClient, prisma } from '../../shared/infrastructure/database/tenant';

const SHARE_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Token compacto = base64url(uuidBytes16 + hmac8) → ~32 chars
function encodeShareToken(orderId: string): string {
  const uuidBytes = Buffer.from(orderId.replace(/-/g, ''), 'hex'); // 16 bytes
  if (uuidBytes.length !== 16) throw new Error('orderId inválido');
  const sig = crypto.createHmac('sha256', SHARE_SECRET).update(uuidBytes).digest().subarray(0, 8);
  return Buffer.concat([uuidBytes, sig]).toString('base64url');
}

function decodeShareToken(token: string): string | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length !== 24) return null;
    const uuidBytes = buf.subarray(0, 16);
    const sig = buf.subarray(16, 24);
    const expected = crypto.createHmac('sha256', SHARE_SECRET).update(uuidBytes).digest().subarray(0, 8);
    if (!crypto.timingSafeEqual(sig, expected)) return null;
    const hex = uuidBytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

export async function publicOrderRoutes(fastify: FastifyInstance) {
  // Gera link público (autenticado)
  fastify.post('/orders/:id/share-link', {
    preHandler: [fastify.authenticate]
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const prisma = getTenantClient(request.user!.organizationId);

    const order = await prisma.order.findFirst({
      where: { id, organizationId: request.user!.organizationId },
      select: { id: true, organizationId: true, orderNumber: true }
    });
    if (!order) {
      return reply.code(404).send({ success: false, message: 'Pedido não encontrado' });
    }

    const token = encodeShareToken(order.id);

    const origin =
      (request.headers.origin as string) ||
      (request.headers.referer ? new URL(request.headers.referer as string).origin : '') ||
      process.env.PUBLIC_APP_URL ||
      '';

    const url = `${origin.replace(/\/$/, '')}/p/pedido?t=${token}`;

    return reply.send({ success: true, data: { token, url, orderNumber: order.orderNumber } });
  });
}

export async function publicAccessRoutes(fastify: FastifyInstance) {
  // Endpoint público (sem auth) — token via query string para evitar problemas com JWT em path
  fastify.get('/order', async (request, reply) => {
    return handlePublicOrder(request, reply);
  });

  // Resolve subdomínio → slug da organização (usado pelo LoginPage quando acessado via erp.artplim.com.br)
  fastify.get('/resolve-subdomain/:subdomain', async (request, reply) => {
    const { subdomain } = request.params as { subdomain: string };
    if (!subdomain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
      return reply.code(400).send({ success: false, message: 'Subdomínio inválido.' });
    }
    const org = await prisma.organization.findUnique({
      where: { subdomain },
      select: { slug: true, name: true, logoFull: true, logoIcon: true, active: true },
    });
    if (!org || !org.active) {
      return reply.code(404).send({ success: false, message: 'Organização não encontrada.' });
    }
    return reply.send({
      success: true,
      data: { slug: org.slug, name: org.name, logoFull: org.logoFull, logoIcon: org.logoIcon },
    });
  });
}

async function handlePublicOrder(request: any, reply: any) {
    const q = (request.query as any) || {};
    const token = q.t || q.token || (request.params as any)?.token;
    if (!token) {
      return reply.code(400).send({ success: false, message: 'Token ausente.' });
    }

    const orderId = decodeShareToken(token);
    if (!orderId) {
      return reply.code(401).send({ success: false, message: 'Link inválido.' });
    }

    const prisma = getTenantClient();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        validUntil: true,
        deliveryDate: true,
        customer: { select: { name: true } },
        processStatus: { select: { name: true, color: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            width: true,
            height: true,
            totalPrice: true,
            notes: true,
            product: { select: { name: true } },
          }
        },
        transactions: {
          where: { status: 'PAID', type: { in: ['INCOME', 'CREDIT'] as any } },
          select: {
            id: true,
            amount: true,
            paidAt: true,
            paymentDate: true,
            createdAt: true,
            paymentMethod: { select: { name: true, type: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        organization: {
          select: {
            name: true,
            logoFull: true,
            logoIcon: true,
            phone: true,
            settings: { select: { pixKey: true, pixKeyType: true, pixBeneficiary: true } },
          },
        },
      }
    });

    if (!order) {
      return reply.code(404).send({ success: false, message: 'Pedido não encontrado' });
    }

    // Histórico de status (timeline)
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        notes: true,
        fromProcessStatus: { select: { name: true, color: true } },
        toProcessStatus: { select: { name: true, color: true } },
      }
    }).catch(() => [] as any[]);

    return reply.send({ success: true, data: { order, history } });
}
