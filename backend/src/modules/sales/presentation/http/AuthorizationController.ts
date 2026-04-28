import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthorizationService } from '../../services/AuthorizationService';
import { z } from 'zod';

export class AuthorizationController {
  constructor(private authorizationService: AuthorizationService) {}

  async createRequest(request: FastifyRequest, reply: FastifyReply) {
    const body = z.object({
      type: z.string(),
      data: z.any()
    }).parse(request.body);

    const result = await this.authorizationService.createRequest({
      organizationId: request.user!.organizationId,
      requesterId: request.user!.userId,
      type: body.type,
      data: body.data
    });

    return reply.code(201).send({ success: true, data: result });
  }

  async listPending(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.authorizationService.listPendingRequests(request.user!.organizationId);
    return reply.send({ success: true, data: result });
  }

  async getStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const result = await this.authorizationService.getRequestStatus(id);
    return reply.send({ success: true, data: result });
  }

  async review(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const { status, notes } = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      notes: z.string().optional()
    }).parse(request.body);

    const result = await this.authorizationService.reviewRequest(id, request.user!.userId, status, notes);
    return reply.send({ success: true, data: result });
  }
}
