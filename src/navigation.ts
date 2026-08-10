export type RootStackParamList = {
  MainApp: undefined;
  Auth: undefined;
  Pay: {
    /** The scanned QR public code. Sent to POST /api/payments as qrPublicCode. */
    publicCode: string;
    businessName: string;
  };
  Confirmation: {
    businessName: string;
    subtotal: number;
    tipPercent: number | null;
    tipAmount: number;
    total: number;
  };
};
