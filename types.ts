export interface Borrower {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
  creditScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  spendingTrend: number[];
  repaymentHistory: number; // Percentage
  mobileMoneyUsage: number; // Volume
  approved?: boolean;
  maxLimit?: number;
}

export interface ChartData {
  name: string;
  value: number;
  fullMark?: number;
}
