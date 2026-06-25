export type TenantRole = 'system_admin' | 'risk_admin';

export interface TenantIdentity {
  id: string;
  company_name: string;
  logo_url: string;
  cover_image_url: string;
  primary_color: string;
  secondary_color: string;
  whatsapp_number: string;
  support_email: string;
  description: string;
  updated_at: string;
}

export const DEFAULT_TENANT_ID = 'risk-main';

export const DEFAULT_TENANT_IDENTITY: TenantIdentity = {
  id: DEFAULT_TENANT_ID,
  company_name: 'Risks Management',
  logo_url: '',
  cover_image_url: '',
  primary_color: '#073266',
  secondary_color: '#0078FF',
  whatsapp_number: '',
  support_email: '',
  description: 'Enterprise risk management dashboard identity.',
  updated_at: new Date(0).toISOString(),
};
