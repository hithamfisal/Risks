import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_TENANT_IDENTITY, fetchTenantIdentity, type TenantIdentity } from '@/lib/tenantIdentity';

export function useTenantIdentity(targetTenantId?: string) {
  const [tenant, setTenant] = useState<TenantIdentity>(DEFAULT_TENANT_IDENTITY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await fetchTenantIdentity(targetTenantId);
      setTenant(next);
      return next;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load company identity.';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [targetTenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tenant, setTenant, loading, error, refresh };
}
