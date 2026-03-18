import type { Invoice } from '../types';

type SerializedInvoice = Omit<Invoice, 'date' | 'invoiceDate' | 'paymentDate'> & {
  date: string;
  invoiceDate: string;
  paymentDate: string | null;
};

export function encodeInvoices(invoices: Invoice[]): string {
  const serialized: SerializedInvoice[] = invoices.map((inv) => ({
    ...inv,
    date: inv.date.toISOString(),
    invoiceDate: inv.invoiceDate.toISOString(),
    paymentDate: inv.paymentDate ? inv.paymentDate.toISOString() : null,
  }));
  return btoa(encodeURIComponent(JSON.stringify(serialized)));
}

export function decodeInvoices(encoded: string): Invoice[] {
  const serialized: SerializedInvoice[] = JSON.parse(decodeURIComponent(atob(encoded)));
  return serialized.map((inv) => ({
    ...inv,
    date: new Date(inv.date),
    invoiceDate: new Date(inv.invoiceDate),
    paymentDate: inv.paymentDate ? new Date(inv.paymentDate) : null,
  }));
}
