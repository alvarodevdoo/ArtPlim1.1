import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'localhost', 'admin']);

function detectSubdomain(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (!host || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
  const parts = host.split('.');
  // Precisa ter pelo menos sub.dominio.tld
  if (parts.length < 3) return '';
  const candidate = parts[0].toLowerCase();
  if (RESERVED_SUBDOMAINS.has(candidate)) return '';
  return candidate;
}

const LoginPage: React.FC = () => {
  const { login, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const detectedSubdomain = React.useMemo(() => detectSubdomain(), []);
  const [resolvedSlug, setResolvedSlug] = useState<string>('');
  const [resolvedOrg, setResolvedOrg] = useState<{ name?: string; logoFull?: string | null; logoIcon?: string | null } | null>(null);
  const [resolvingSubdomain, setResolvingSubdomain] = useState<boolean>(!!detectedSubdomain);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    organizationSlug: ''
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!detectedSubdomain) return;
    let cancelled = false;
    api.get(`/api/public/resolve-subdomain/${detectedSubdomain}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data?.data;
        if (data?.slug) {
          setResolvedSlug(data.slug);
          setResolvedOrg({ name: data.name, logoFull: data.logoFull, logoIcon: data.logoIcon });
          setFormData(prev => ({ ...prev, organizationSlug: data.slug }));
        }
      })
      .catch(() => { /* fallback: usuário digita manualmente */ })
      .finally(() => { if (!cancelled) setResolvingSubdomain(false); });
    return () => { cancelled = true; };
  }, [detectedSubdomain]);

  // Redirect se já estiver logado
  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(formData.email, formData.password, formData.organizationSlug);
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {resolvedOrg?.logoFull ? (
            <div className="mx-auto mb-4 flex items-center justify-center max-h-24">
              <img
                src={resolvedOrg.logoFull}
                alt={resolvedOrg.name || 'Logo'}
                className="max-h-24 max-w-full object-contain"
              />
            </div>
          ) : resolvedOrg?.logoIcon ? (
            <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
              <img
                src={resolvedOrg.logoIcon}
                alt={resolvedOrg.name || 'Logo'}
                className="max-h-16 max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
              <span className="text-primary-foreground font-bold text-xl">
                {(resolvedOrg?.name || 'A').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <CardTitle className="text-2xl">
            Entrar {resolvedOrg?.name ? `em ${resolvedOrg.name}` : 'no ArtPlim'}
          </CardTitle>
          <CardDescription>
            Digite suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {resolvedSlug ? (
              <input type="hidden" name="organizationSlug" value={formData.organizationSlug} />
            ) : (
              <div className="space-y-2">
                <label htmlFor="organizationSlug" className="text-sm font-medium">
                  Empresa
                </label>
                <Input
                  id="organizationSlug"
                  name="organizationSlug"
                  type="text"
                  placeholder={resolvingSubdomain ? 'Identificando empresa...' : 'slug-da-empresa'}
                  value={formData.organizationSlug}
                  onChange={handleChange}
                  required
                  disabled={resolvingSubdomain}
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            {process.env.NODE_ENV === 'development' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setFormData({
                    email: 'admin@artplim.com.br',
                    password: 'admin123',
                    organizationSlug: 'artplim'
                  })}
                >
                  🚀 Login Admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setFormData({
                    email: 'operador@artplim.com.br',
                    password: 'web123456',
                    organizationSlug: 'artplim'
                  })}
                >
                  👥 Login Func
                </Button>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <Link
                to="/register"
                className="text-primary hover:underline font-medium"
              >
                Registre-se
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;