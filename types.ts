
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED'
}

export interface BankAccountInfo {
  bankName?: string;
  branchName?: string;
  accountType?: string; // 普通, 当座, etc.
  accountNumber?: string;
  accountName?: string;
}

export interface Invoice {
  id: string;
  vendorName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  status: PaymentStatus;
  category: string;
  extractedAt: string;
  notes?: string;
  fileName: string;
  bankAccount?: BankAccountInfo;
  paymentDate?: string;
  driveFileId?: string;
  webViewLink?: string;
}

export interface InvoiceExtractionResult {
  vendorName: string;
  invoiceNumber: string;
  totalAmount: number;
  currency: string;
  dueDate: string;
  issueDate: string;
  category: string;
  notes?: string;
  bankAccount?: BankAccountInfo;
}

export interface DriveFolder {
  id: string;
  name: string;
  folderId: string;
  createdAt: string;
  enabled: boolean;
}
