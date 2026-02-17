import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  CartesianGrid
} from 'recharts';
import { Borrower } from '../types';

interface CreditMixChartProps {
  data: Borrower[];
}

export const CreditMixChart: React.FC<CreditMixChartProps> = ({ data }) => {
  // Aggregate risk levels
  const riskCounts = data.reduce((acc, curr) => {
    acc[curr.riskLevel] = (acc[curr.riskLevel] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = [
    { name: 'Low Risk', value: riskCounts['Low'] || 0, fill: '#34d399' },
    { name: 'Medium Risk', value: riskCounts['Medium'] || 0, fill: '#fbbf24' },
    { name: 'High Risk', value: riskCounts['High'] || 0, fill: '#ef4444' },
  ];

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={0} tickFormatter={(val) => val.split(' ')[0]} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface BorrowerRadarProps {
  borrower: Borrower;
}

export const BorrowerRadar: React.FC<BorrowerRadarProps> = ({ borrower }) => {
  const data = [
    { subject: 'Repayment', A: borrower.repaymentHistory, fullMark: 100 },
    { subject: 'Credit Score', A: (borrower.creditScore / 850) * 100, fullMark: 100 },
    { subject: 'Mobile $', A: Math.min(100, (borrower.mobileMoneyUsage / 1000) * 100), fullMark: 100 },
    { subject: 'Velocity', A: Math.random() * 100, fullMark: 100 }, // Mock velocity
    { subject: 'Stability', A: borrower.riskLevel === 'Low' ? 90 : borrower.riskLevel === 'Medium' ? 60 : 30, fullMark: 100 },
  ];

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={borrower.name}
            dataKey="A"
            stroke="#10b981"
            strokeWidth={2}
            fill="#10b981"
            fillOpacity={0.3}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            itemStyle={{ color: '#10b981' }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface TrendChartProps {
  data: number[];
}

export const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
  const formattedData = data.map((val, i) => ({ month: `M${i + 1}`, amount: val }));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            itemStyle={{ color: '#22d3ee' }}
          />
          <Area type="monotone" dataKey="amount" stroke="#06b6d4" fillOpacity={1} fill="url(#colorAmount)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
