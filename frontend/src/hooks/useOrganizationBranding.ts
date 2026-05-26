import { useEffect, useState } from 'react';
import api from '@/lib/api';

interface OrganizationBranding {
  name?: string | null;
  razaoSocial?: string | null;
  logoFull?: string | null;
  logoIcon?: string | null;
}

// Cache em módulo para evitar refetch entre montagens de componentes.
let cached: OrganizationBranding | null = null;
let pending: Promise<OrganizationBranding | null> | null = null;
const subscribers = new Set<(b: OrganizationBranding | null) => void>();

async function fetchBranding(): Promise<OrganizationBranding | null> {
  if (cached) return cached;
  if (pending) return pending;
  pending = api.get('/api/organization')
    .then((res) => {
      const data = res.data?.data;
      cached = data
        ? {
            name: data.name,
            razaoSocial: data.razaoSocial,
            logoFull: data.logoFull,
            logoIcon: data.logoIcon,
          }
        : null;
      subscribers.forEach((cb) => cb(cached));
      return cached;
    })
    .catch(() => null)
    .finally(() => { pending = null; });
  return pending;
}

export function invalidateOrganizationBranding() {
  cached = null;
  fetchBranding();
}

function applyFavicon(href: string | null | undefined) {
  if (!href) return;
  // Remove favicons existentes para garantir que o novo seja usado
  document.querySelectorAll('link[rel*="icon"]').forEach((el) => el.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  document.head.appendChild(link);
}

export function useOrganizationBranding(): OrganizationBranding | null {
  const [branding, setBranding] = useState<OrganizationBranding | null>(cached);

  useEffect(() => {
    let mounted = true;
    const onUpdate = (b: OrganizationBranding | null) => {
      if (mounted) setBranding(b);
    };
    subscribers.add(onUpdate);

    if (!cached) {
      fetchBranding().then((b) => mounted && setBranding(b));
    }
    return () => {
      mounted = false;
      subscribers.delete(onUpdate);
    };
  }, []);

  useEffect(() => {
    applyFavicon(branding?.logoIcon || branding?.logoFull);
  }, [branding?.logoIcon, branding?.logoFull]);

  return branding;
}
