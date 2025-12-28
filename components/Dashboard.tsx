
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Invoice, PaymentStatus } from '../types';
import { TrendingUp, Clock, AlertCircle, CheckCircle } from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
}

const Dashboard: React.FC<DashboardProps> = ({ invoices }) => {
  const stats = useMemo(() => {
    const total = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const pending = invoices.filter(i => i.status === PaymentStatus.PENDING).reduce((sum, inv) => sum + inv.amount, 0);
    const paid = invoices.filter(i => i.status === PaymentStatus.PAID).reduce((sum, inv) => sum + inv.amount, 0);
    const overdue = invoices.filter(i => i.status === PaymentStatus.OVERDUE).reduce((sum, inv) => sum + inv.amount, 0);

    return { total, pending, paid, overdue };
  }, [invoices]);

  const categoryData = useMemo(() => {
    const groups: Record<string, number> = {};
    invoices.forEach(inv => {
      groups[inv.category] = (groups[inv.category] || 0) + inv.amount;
    });
    return Object.entries(groups).map(([name, value]) => ({ name, value }));
  }, [invoices]);

  const statusData = [
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Paid', value: stats.paid, color: '#10b981' },
    { name: 'Overdue', value: stats.overdue, color: '#ef4444' },
  ];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(val);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total Volume" 
          value={formatCurrency(stats.total)} 
          icon={<TrendingUp className="text-blue-500" />} 
          bgColor="bg-blue-50"
        />
        <StatCard 
          title="Pending" 
          value={formatCurrency(stats.pending)} 
          icon={<Clock className="text-amber-500" />} 
          bgColor="bg-amber-50"
        />
        <StatCard 
          title="Paid" 
          value={formatCurrency(stats.paid)} 
          icon={<CheckCircle className="text-emerald-500" />} 
          bgColor="bg-emerald-50"
        />
        <StatCard 
          title="Overdue" 
          value={formatCurrency(stats.overdue)} 
          icon={<AlertCircle className="text-rose-500" />} 
          bgColor="bg-rose-50"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6">Payment Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(v) => `¥${v/1000}k`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-6">Expense by Category</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name }) => name}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; bgColor: string }> = ({ 
  title, value, icon, bgColor 
}) => (
  <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4">
    <div className={`${bgColor} p-3 rounded-lg`}>
      {icon}
    </div>
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

export default Dashboard;
