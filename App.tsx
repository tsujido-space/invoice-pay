import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileCheck,
  CloudDownload,
  Building2,
  Copy,
  Check,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  Eye,
  Calendar,
  Layers
} from 'lucide-react';
import { Invoice, PaymentStatus, BankAccountInfo, DriveFolder } from './types';
import { extractInvoiceData } from './services/geminiService';
import * as firestoreService from './services/firestoreService';
import FolderSettings from './components/FolderSettings';

const App: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list');
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDriveSimulating, setIsDriveSimulating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number, total: number } | null>(null);

  // Filtering & Sorting states
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Invoice | 'amount'; direction: 'asc' | 'desc' }>({
    key: 'dueDate',
    direction: 'desc'
  });

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
          const invoiceToSave: Omit<Invoice, 'id'> = {
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

          const docId = await firestoreService.saveInvoice(invoiceToSave);
          const newInvoice: Invoice = { ...invoiceToSave, id: docId } as Invoice;
          setInvoices(prev => [newInvoice, ...prev]);
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

  const syncDrive = async () => {
    setIsDriveSimulating(true);
    setSyncProgress(null);

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Reload invoices to show new ones
        const invoiceData = await firestoreService.getInvoices();
        setInvoices(invoiceData);

        if (data.message && (data.message.toLowerCase().includes("started") || data.message.toLowerCase().includes("job"))) {
          alert("Google Drive との同期プロセスを開始しました。新しい請求書が表示されるまで数分かかる場合があります。");
        } else if (data.processedCount > 0) {
          alert(`${data.processedCount} 件の新しい請求書を取り込みました。`);
        } else {
          alert("新しい請求書は見つかりませんでした。");
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err) {
      console.error("Sync Drive failed:", err);
      alert("Google Drive との同期に失敗しました。詳細はコンソールを確認してください。");
    } finally {
      setIsDriveSimulating(false);
    }
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

  const handleDeleteInvoice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("この請求書を削除してもよろしいですか？")) return;

    try {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete on server');
      }

      setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (err) {
      console.error("Delete invoice failed:", err);
      alert("請求書の削除に失敗しました。サーバー側の権限や接続を確認してください。");
    }
  };

  // Derive unique values for filters
  const filterOptions = useMemo(() => {
    const vendors = Array.from(new Set(invoices.map(inv => inv.vendorName))).sort();
    const years = Array.from(new Set(invoices.map(inv => {
      const date = inv.issueDate || inv.dueDate;
      return date ? date.split('-')[0] : null;
    }))).filter(Boolean).sort((a, b) => b!.localeCompare(a!));
    const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));

    return { vendors, years, months };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => {
      if (inv.status === 'DELETED') return false;

      const matchesSearch =
        inv.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesVendor = filterVendor === 'all' || inv.vendorName === filterVendor;
      const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;

      const date = inv.issueDate || inv.dueDate;
      const year = date ? date.split('-')[0] : null;
      const month = date ? date.split('-')[1] : null;

      const matchesYear = filterYear === 'all' || year === filterYear;
      const matchesMonth = filterMonth === 'all' || month === filterMonth;

      return matchesSearch && matchesVendor && matchesStatus && matchesYear && matchesMonth;
    });

    // Sort
    result.sort((a, b) => {
      const { key, direction } = sortConfig;
      let valA: any = a[key as keyof Invoice];
      let valB: any = b[key as keyof Invoice];

      if (key === 'amount') {
        valA = a.amount;
        valB = b.amount;
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, searchTerm, filterVendor, filterYear, filterMonth, filterStatus, sortConfig]);

  const handleSort = (key: keyof Invoice | 'amount') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

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
          <div className="max-w-7xl mx-auto px-6 py-4 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
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
                onClick={syncDrive}
                disabled={isDriveSimulating}
                className="flex items-center space-x-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition font-medium text-slate-600 disabled:opacity-50"
              >
                {isDriveSimulating ? (
                  <>
                    <Clock className="animate-spin text-blue-600" size={18} />
                    <span>{syncProgress ? `Syncing (${syncProgress.current}/${syncProgress.total})` : 'Syncing...'}</span>
                  </>
                ) : (
                  <>
                    <CloudDownload size={18} className="text-blue-600" />
                    <span>Sync Drive</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <Filter size={14} className="text-slate-400" />
                <span className="text-slate-500 font-medium">Filter:</span>
              </div>

              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
              >
                <option value="all">すべての取引先</option>
                {filterOptions.vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>

              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="all">年</option>
                {filterOptions.years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>

              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="all">月</option>
                {filterOptions.months.map(m => <option key={m} value={m}>{parseInt(m)}月</option>)}
              </select>

              <select
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">すべてのステータス</option>
                <option value={PaymentStatus.PENDING}>未振込</option>
                <option value={PaymentStatus.PAID}>振込済</option>
              </select>

              {(filterVendor !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterStatus !== 'all') && (
                <button
                  onClick={() => {
                    setFilterVendor('all');
                    setFilterYear('all');
                    setFilterMonth('all');
                    setFilterStatus('all');
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium ml-2 flex items-center space-x-1"
                >
                  <X size={14} />
                  <span>クリア</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {activeTab === 'list' ? (
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
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => handleSort('vendorName')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Vendor / Invoice</span>
                          {sortConfig.key === 'vendorName' && (
                            sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => handleSort('amount')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Amount</span>
                          {sortConfig.key === 'amount' && (
                            sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:bg-slate-100 transition"
                        onClick={() => handleSort('dueDate')}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Due Date</span>
                          {sortConfig.key === 'dueDate' && (
                            sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Bank Account</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-blue-50/30 transition group cursor-pointer"
                        onClick={() => setSelectedInvoice(inv)}
                      >
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
                            <div className="flex items-center space-x-1.5 px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium w-fit">
                              <Building2 size={12} />
                              <span>{inv.bankAccount.bankName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No bank info</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <StatusBadge status={inv.status} onClick={(e: any) => { e.stopPropagation(); toggleStatus(inv.id); }} />
                          {inv.paymentDate && (
                            <p className="text-[10px] text-emerald-600 font-medium mt-1">Paid on: {inv.paymentDate}</p>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {inv.webViewLink && (
                              <a
                                href={inv.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="プレビュー"
                              >
                                <Eye size={18} />
                              </a>
                            )}
                            <button
                              onClick={(e) => handleDeleteInvoice(inv.id, e)}
                              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="削除"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
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

              {selectedInvoice.webViewLink && (
                <div className="mb-8 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between group">
                  <div className="flex items-center space-x-3 text-blue-700 font-bold">
                    <CloudDownload size={20} />
                    <span>元のファイルをプレビュー</span>
                  </div>
                  <a
                    href={selectedInvoice.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-md shadow-blue-200"
                  >
                    <Search size={18} />
                  </a>
                </div>
              )}

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
