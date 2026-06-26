function defaultApiBaseUrl() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  if (host === 'risks-dashboard.com' || host === 'www.risks-dashboard.com') {
    return 'https://api.risks-dashboard.com';
  }
  return '';
}

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl()).replace(/\/$/, '');

export async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Request failed with status ${response.status}`);
  }
  if (body === null) {
    throw new Error('API returned an invalid response. Check that the frontend API URL points to the Node.js backend.');
  }
  return body as T;
}
