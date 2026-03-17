export interface Invoice {
  id: string;
  num: string;
  date: Date;
  invoiceDate: Date;
  paymentDate: Date | null;
  client: string;
  ttc: number;
  ht: number;
  tva: number;
  status: string;
  title: string;
  year: number;
  cancelled: boolean;
  avoir: boolean;
}

export interface ClientData {
  name: string;
  total: number;
  invoices: Invoice[];
  color: string;
}

export interface MergedBubble {
  client: string;
  x: number;
  date: Date;
  ttc: number;
  invoices: Invoice[];
  isPending: boolean;
}
