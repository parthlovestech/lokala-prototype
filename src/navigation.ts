import type { PaymentReceipt } from './payments/types';

export type RootStackParamList = {
  MainApp: undefined;
  Auth: undefined;
  Pay: {
    /** The scanned QR public code. Sent to POST /api/payments as qrPublicCode. */
    publicCode: string;
    businessName: string;
  };
  Confirmation: {
    /** The canonical, server-confirmed receipt. Every amount comes from here. */
    receipt: PaymentReceipt;
  };
};
