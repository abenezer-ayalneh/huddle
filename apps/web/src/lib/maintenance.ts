import { API_URL } from './api';
import { httpFetch } from './http';

export type MaintenanceStatus = { phase: 'off' | 'scheduled' | 'active'; startsAt: string | null; message: string; serverTime: string };
export async function maintenanceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await httpFetch(`${API_URL}/maintenance/${path}`, { credentials: 'include', cache: 'no-store', ...init });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Sign in to manage maintenance.');
    if (response.status === 403) throw new Error('This account does not have owner access.');
    throw new Error('Could not update maintenance. Check the current status and try again.');
  }
  return response.json() as Promise<T>;
}
