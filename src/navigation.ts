export type RootStackParamList = {
  MainApp: undefined;
  Auth: undefined;
  Pay: { businessId: string; businessName: string };
  Confirmation: {
    businessName: string;
    subtotal: number;
    tipPercent: number | null;
    tipAmount: number;
    total: number;
  };
};
