import { apiClient } from './api';

export type VaultPaymentStatus = 'pending' | 'paid' | 'failed';
export type TelegramInvoiceStatus = 'paid' | 'cancelled' | 'failed' | 'pending';
export type VaultSubscriptionState = 'inactive' | 'active' | 'demo_active';

interface VaultCheckoutResponse {
  invoiceUrl: string;
  order: string;
  amountStars: number;
  currency: 'XTR';
  periodDays: 30;
}

interface VaultStatusResponse {
  status: VaultPaymentStatus;
}

export interface VaultSubscriptionResponse {
  status: VaultSubscriptionState;
  isActive: boolean;
  isDemo: boolean;
  amountStars: number;
  displayPriceStars: number;
  periodDays: 30;
  activatedAt: number | null;
}

export function createVaultCheckout(initData: string) {
  return apiClient.post<VaultCheckoutResponse>('/api/vault/checkout', { initData }, false);
}

export function getVaultPaymentStatus(initData: string, order: string) {
  return apiClient.post<VaultStatusResponse>('/api/vault/status', { initData, order }, false);
}

export function getVaultSubscription(initData: string) {
  return apiClient.post<VaultSubscriptionResponse>('/api/vault/subscription', { initData }, false);
}

export function activateVaultDemo(initData: string) {
  return apiClient.post<VaultSubscriptionResponse>('/api/vault/demo-activate', { initData }, false);
}
