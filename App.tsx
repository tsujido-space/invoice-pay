
import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  X,
  FileCheck,
  CloudDownload,
  Building2,
  Copy,
  Check,
  Settings
} from 'lucide-react';
import { Invoice, PaymentStatus, BankAccountInfo, DriveFolder } from './types';
import { extractInvoiceData } from './services/geminiService';
import * as firestoreService from './services/firestoreService';
import Dashboard from './components/Dashboard';
import FolderSettings from './components/FolderSettings';

const App: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list' | 'settings'>('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDriveSimulating, setIsDriveSimulating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invoiceData, folderData] = await Promise.all([
          firestoreService.getInvoices(),
          firestoreService.getDriveFolders()
        ]);
        setInvoices(invoiceData);
        setDriveFolders(folderData);
      } catch (err) {
        console.error("Failed to load data from Firestore:", err);
      }
    };
    fetchData();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const file = files[0];

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = (e.target?.result as string).split(',')[1];
        const mimeType = file.type;

        try {
          const result = await extractInvoiceData(base64Data, mimeType);
          const newInvoice: Invoice = {
            id: Math.random().toString(36).substr(2, 9),
            vendorName: result.vendorName,
            invoiceNumber: result.invoiceNumber,
            amount: result.totalAmount,
            currency: result.currency || 'JPY',
            dueDate: result.dueDate,
            issueDate: result.issueDate || new Date().toISOString().split('T')[0],
            status: PaymentStatus.PENDING,
            category: result.category || 'Other',
            extractedAt: new Date().toISOString(),
            notes: result.notes,
            fileName: file.name,
            bankAccount: result.bankAccount
          };

          const docId = await firestoreService.saveInvoice(newInvoice);
          setInvoices(prev => [{ ...newInvoice, id: docId }, ...prev]);
        } catch (err) {
          alert('Failed to process invoice. Ensure it is a clear image or PDF.');
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsUploading(false);
    }
  };

  const simulateDriveSync = () => {
    setIsDriveSimulating(true);
    setTimeout(() => {
      const newInvoice: Invoice = {
        id: Math.random().toString(36).substr(2, 9),
        vendorName: 'Google Workspace',
        invoiceNumber: 'GWS-88221',
        amount: 1200,
        currency: 'JPY',
        dueDate: '2024-07-01',
        issueDate: '2024-06-01',
        status: PaymentStatus.PENDING,
        category: 'Software',
        extractedAt: new Date().toISOString(),
        fileName: 'google_workspace_june.pdf',
        bankAccount: {
          bankName: '三井住友銀行',
          branchName: '本店営業部',
          accountType: '普通',
          accountNumber: '9988776',
          accountName: 'グーグル・クラウド・ジャパン（ド'
        }
      };

      firestoreService.saveInvoice(newInvoice).then(docId => {
        setInvoices(prev => [{ ...newInvoice, id: docId }, ...prev]);
        setIsDriveSimulating(false);
        setActiveTab('list');
      });
    }, 2000);
  };

  const toggleStatus = (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    if (invoice && invoice.status === PaymentStatus.PENDING && invoice.bankAccount) {
      setSelectedInvoice(invoice);
    } else {
      updateStatus(id);
    }
  };

  const updateStatus = (id: string, paymentDate?: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === id) {
        const nextStatus = inv.status === PaymentStatus.PAID ? PaymentStatus.PENDING : PaymentStatus.PAID;
        const newPaymentDate = nextStatus === PaymentStatus.PAID ? (paymentDate || new Date().toISOString().split('T')[0]) : undefined;

        // Update Firestore asynchronously
        firestoreService.updateInvoiceStatus(id, nextStatus, newPaymentDate);

        return {
          ...inv,
          status: nextStatus,
          paymentDate: newPaymentDate
        };
      }
      return inv;
    }));
    setSelectedInvoice(null);
  };

  const handleAddFolder = async (name: string, folderId: string) => {
    try {
      const newFolder: Omit<DriveFolder, 'id'> = {
        name,
        folderId,
        enabled: true,
        createdAt: new Date().toISOString()
      };
      const id = await firestoreService.saveDriveFolder(newFolder);
      setDriveFolders(prev => [{ ...newFolder, id }, ...prev]);
    } catch (err) {
      console.error("Failed to save folder:", err);
      alert("フォルダの保存に失敗しました。");
      throw err;
    }
  };

  const handleDeleteFolder = async (id: string) => {
    await firestoreService.deleteDriveFolder(id);
    setDriveFolders(prev => prev.filter(f => f.id !== id));
  };

  const handleToggleFolder = async (id: string, enabled: boolean) => {
    await firestoreService.updateDriveFolderStatus(id, enabled);
    setDriveFolders(prev => prev.map(f => f.id === id ? { ...f, enabled } : f));
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv =>
      inv.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex-shrink-0">
        <div className="p-6">
          <div className="flex items-center space-x-2 mb-10">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FileCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Gemini Pay</h1>
          </div>
          <nav className="space-y-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('list')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <FileText size={20} />
              <span className="font-medium">Invoices</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 space-y-4">
          <label className={`block w-full cursor-pointer bg-white text-slate-900 text-center py-3 rounded-xl font-bold hover:bg-slate-100 transition shadow-lg ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
            <div className="flex items-center justify-center space-x-2">
              {isUploading ? <Clock className="animate-spin" size={18} /> : <Plus size={18} />}
              <span>{isUploading ? 'Extracting...' : 'Add Invoice'}</span>
            </div>
          </label>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search vendor, invoice ID..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={simulateDriveSync}
              disabled={isDriveSimulating}
              className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium text-slate-600"
            >
              {isDriveSimulating ? <Clock className="animate-spin text-blue-600" size={18} /> : <CloudDownload size={18} className="text-blue-600" />}
              <span>Sync Drive</span>
            </button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'dashboard' ? (
            <Dashboard invoices={invoices} />
          ) : activeTab === 'list' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">Invoice Tasks</h2>
                  <p className="text-slate-500">Track and verify bank transfers.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Vendor / Invoice</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Due Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Bank Account</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition group">
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">{inv.vendorName}</p>
                          <p className="text-sm text-slate-500">{inv.invoiceNumber}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">
                            {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: inv.currency }).format(inv.amount)}
                          </p>
                        </td>
                        <td className="px-6 py-5 text-sm text-slate-600">{inv.dueDate}</td>
                        <td className="px-6 py-5">
                          {inv.bankAccount ? (
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
                            >
                              <Building2 size={12} />
                              <span>{inv.bankAccount.bankName}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No bank info</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={inv.status} onClick={() => toggleStatus(inv.id)} />
                          {inv.paymentDate && (
                            <p className="text-[10px] text-emerald-600 font-medium mt-1">Paid on: {inv.paymentDate}</p>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="p-2 text-slate-400 opacity-0 group-hover:opacity-100"><MoreVertical size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <FolderSettings
              folders={driveFolders}
              onAddFolder={handleAddFolder}
              onDeleteFolder={handleDeleteFolder}
              onToggleFolder={handleToggleFolder}
            />
          )}
        </div>
      </main>

      {/* Payment Confirmation Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900">振込情報の確認</h3>
                <p className="text-sm text-slate-500">以下の口座へ振込を行ってください。</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-slate-100 rounded-full">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <BankDetailRow label="銀行名" value={selectedInvoice.bankAccount?.bankName} />
                <BankDetailRow label="支店名" value={selectedInvoice.bankAccount?.branchName} />
                <BankDetailRow label="口座種別" value={selectedInvoice.bankAccount?.accountType} />
                <BankDetailRow label="口座番号" value={selectedInvoice.bankAccount?.accountNumber} isBold />
                <BankDetailRow label="口座名義" value={selectedInvoice.bankAccount?.accountName} />
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-medium">振込金額</span>
                <span className="text-2xl font-black text-blue-600">
                  {new Intl.NumberFormat('ja-JP', { style: 'currency', currency: selectedInvoice.currency }).format(selectedInvoice.amount)}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  キャンセル
                </button>
                <button
                  onClick={() => updateStatus(selectedInvoice.id)}
                  className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition flex items-center justify-center space-x-2 shadow-lg shadow-blue-200"
                >
                  <CheckCircle2 size={18} />
                  <span>振込完了にする</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BankDetailRow: React.FC<{ label: string; value?: string; isBold?: boolean }> = ({ label, value, isBold }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex justify-between items-start group">
      <span className="text-xs font-bold text-blue-400 uppercase tracking-wider w-20 pt-1">{label}</span>
      <div className="flex-1 flex items-center justify-between">
        <span className={`text-slate-900 ${isBold ? 'font-black text-lg' : 'font-medium'}`}>
          {value || '---'}
        </span>
        {value && (
          <button
            onClick={handleCopy}
            className="ml-2 p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition"
            title="コピー"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

const StatusBadge: React.FC<{ status: PaymentStatus; onClick: () => void }> = ({ status, onClick }) => {
  const styles = {
    [PaymentStatus.PAID]: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
    [PaymentStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
    [PaymentStatus.OVERDUE]: 'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100',
    [PaymentStatus.CANCELLED]: 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100',
  };
  const icons = {
    [PaymentStatus.PAID]: <CheckCircle2 size={14} />,
    [PaymentStatus.PENDING]: <Clock size={14} />,
    [PaymentStatus.OVERDUE]: <AlertCircle size={14} />,
    [PaymentStatus.CANCELLED]: <X size={14} />,
  };

  return (
    <button onClick={onClick} className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition ${styles[status]}`}>
      {icons[status]}
      <span>{status === PaymentStatus.PENDING ? '未振込' : status === PaymentStatus.PAID ? '振込済' : status}</span>
    </button>
  );
};

export default App;
