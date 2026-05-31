import type { PrismaClient } from '@prisma/client';

/**
 * Mantém em cache os subdomínios cadastrados em Organization.subdomain e
 * autoriza dinamicamente origens do tipo `https://<sub>.<base-domain>`.
 *
 * Os domínios-base aceitos vêm da env `CORS_BASE_DOMAINS` (lista separada
 * por vírgula). Ex.: `artplim.com.br,artplim.app`. Se vazia, a validação
 * dinâmica fica desligada e só valem as origens estáticas em CORS_ALLOWED_ORIGINS.
 */
export class SubdomainCorsService {
  private subdomains = new Set<string>();
  private baseDomains: string[];
  private ready = false;

  constructor(private prisma: PrismaClient) {
    this.baseDomains = (process.env.CORS_BASE_DOMAINS || process.env.CORS_BASE_DOMAIN || '')
      .split(',')
      .map(d => d.trim().toLowerCase().replace(/^\./, ''))
      .filter(Boolean);
  }

  hasBaseDomains(): boolean {
    return this.baseDomains.length > 0;
  }

  /** Carrega todos os subdomínios atualmente cadastrados. */
  async refresh(): Promise<void> {
    if (!this.hasBaseDomains()) {
      this.ready = true;
      return;
    }
    try {
      const rows = await this.prisma.organization.findMany({
        where: { subdomain: { not: null } },
        select: { subdomain: true }
      });
      this.subdomains = new Set(
        rows
          .map(r => (r.subdomain || '').trim().toLowerCase())
          .filter(Boolean)
      );
      this.ready = true;
    } catch (err) {
      console.error('[SubdomainCorsService] Falha ao carregar subdomínios:', err);
    }
  }

  add(subdomain: string | null | undefined): void {
    if (!subdomain) return;
    this.subdomains.add(subdomain.trim().toLowerCase());
  }

  remove(subdomain: string | null | undefined): void {
    if (!subdomain) return;
    this.subdomains.delete(subdomain.trim().toLowerCase());
  }

  /**
   * Decide se a origem é permitida pela regra de subdomínio dinâmico.
   * Retorna true SOMENTE se a origem casa com `<sub>.<base>` onde `<sub>`
   * está cadastrado em Organization.subdomain. O apex NÃO é liberado.
   */
  isOriginAllowed(origin: string): boolean {
    if (!this.hasBaseDomains()) return false;
    let host: string;
    try {
      host = new URL(origin).hostname.toLowerCase();
    } catch {
      return false;
    }

    for (const base of this.baseDomains) {
      if (host.endsWith(`.${base}`)) {
        const sub = host.slice(0, -base.length - 1);
        // Aceita apenas o primeiro nível (ex.: "dev"), não "x.dev.artplim.com.br"
        if (sub && !sub.includes('.') && this.subdomains.has(sub)) {
          return true;
        }
      }
    }
    return false;
  }

  isReady(): boolean {
    return this.ready;
  }
}

let instance: SubdomainCorsService | null = null;

export function initSubdomainCorsService(prisma: PrismaClient): SubdomainCorsService {
  instance = new SubdomainCorsService(prisma);
  return instance;
}

export function getSubdomainCorsService(): SubdomainCorsService | null {
  return instance;
}
