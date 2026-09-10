import { apiClient } from './api';

interface JointCheckPaymentResponse {
  paymentId: string;
  remainingAmount: number;
  isClosed: boolean;
}

export function addJointCheckPayment(jointCheckId: string, amount: number) {
  return apiClient.post<JointCheckPaymentResponse>(
    `/api/joint-checks/${encodeURIComponent(jointCheckId)}/payments`,
    { amount },
  );
}
