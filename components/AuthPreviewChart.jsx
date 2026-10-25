'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jul', income: 75000, expense: 42000 },
  { month: 'Aug', income: 78000, expense: 45000 },
  { month: 'Sep', income: 82000, expense: 41000 },
  { month: 'Oct', income: 85000, expense: 39500 },
  { month: 'Nov', income: 90000, expense: 43000 },
];

export default function AuthPreviewChart() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-[140px] w-full flex items-center justify-center bg-gray-50 rounded-lg">
        <span className="text-xs text-gray-400 font-bold">Loading chart…</span>
      </div>
    );
  }

  return (
    <div className="w-full h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
          <XAxis
            dataKey="month"
            tick={{ fill: '#111827', fontSize: 11, fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: '#111827', strokeWidth: 1.5 }}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 600 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(value, name) => [
              `₹${Number(value).toLocaleString('en-IN')}`,
              name === 'income' ? 'Income' : 'Outflow',
            ]}
            contentStyle={{
              border: '2px solid #111827',
              borderRadius: 8,
              boxShadow: '3px 3px 0px #111827',
              fontSize: '11px',
              fontWeight: 700,
            }}
          />
          <Bar dataKey="income" fill="#A7F3D0" stroke="#111827" strokeWidth={1.5} radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" fill="#FF5722" stroke="#111827" strokeWidth={1.5} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
