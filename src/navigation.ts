import type { RedemptionConfirmation } from './payments/redeemBalance';

export type RootStackParamList = {
  MainApp: undefined;
  Auth: undefined;
  Pay: {
    /** The scanned QR public code. Sent to redeem_lokala_balance as p_public_code. */
    publicCode: string;
    businessName: string;
    locationLabel: string | null;
  };
  Confirmation: {
    /** The server-confirmed redemption result. Every amount comes from here. */
    confirmation: RedemptionConfirmation;
  };
};
