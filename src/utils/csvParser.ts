import Papa from 'papaparse';
import { parse, isValid } from 'date-fns';
import type { Invoice } from '../types';

export function parseAmount(str: string): number {
  if (!str) return 0;
  // handles: "1 154,40 €", "1154.40", "-700,00 €"
  const cleaned = str.replace(/[€\s]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function parseDate(str: string): Date | null {
  if (!str || str.trim() === '') return null;
  const trimmed = str.trim();
  // Try DD/MM/YYYY first
  const d1 = parse(trimmed, 'dd/MM/yyyy', new Date());
  if (isValid(d1)) return d1;
  // Try YYYY-MM-DD
  const d2 = parse(trimmed, 'yyyy-MM-dd', new Date());
  if (isValid(d2)) return d2;
  return null;
}

export function processInvoices(rows: string[][]): Invoice[] {
  const invoices: Invoice[] = [];

  for (const row of rows) {
    if (row.length < 17) continue;

    const id = row[0]?.trim() ?? '';
    const num = row[1]?.trim() ?? '';
    const rawInvoiceDate = row[2]?.trim() ?? '';
    const clientName = row[4]?.trim() ?? '';
    const rawTtc = row[8]?.trim() ?? '';
    const rawTva = row[9]?.trim() ?? '';
    const rawHt = row[10]?.trim() ?? '';
    const status = row[16]?.trim() ?? '';
    const title = row[22]?.trim() ?? '';
    const rawPaymentDate = row[27]?.trim() ?? '';

    if (!clientName || !rawInvoiceDate) continue;

    const invoiceDate = parseDate(rawInvoiceDate);
    if (!invoiceDate) continue;

    const paymentDate = parseDate(rawPaymentDate);
    const ttc = parseAmount(rawTtc);
    const tva = parseAmount(rawTva);
    const ht = parseAmount(rawHt);

    const cancelled = status === 'Annulée' || ttc < 0;
    const avoir = ttc < 0;

    // Primary date: payment date if present, else invoice date
    const date = paymentDate ?? invoiceDate;
    const year = date.getFullYear();

    invoices.push({
      id,
      num,
      date,
      invoiceDate,
      paymentDate,
      client: clientName,
      ttc,
      ht,
      tva,
      status,
      title,
      year,
      cancelled,
      avoir,
    });
  }

  return invoices;
}

export function parseCSV(csvText: string): Invoice[] {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    header: false,
  });

  // Skip header row if first cell looks like a header
  let rows = result.data as string[][];
  if (rows.length > 0) {
    const firstCell = rows[0][0]?.toLowerCase() ?? '';
    if (firstCell === 'id' || firstCell === 'identifiant' || isNaN(Number(firstCell))) {
      rows = rows.slice(1);
    }
  }

  return processInvoices(rows);
}

export const SAMPLE_CSV = `1,FA-2023-001,15/01/2023,,Acme Corp,,,,1154.40,192.40,962.00,,,,,,Encaissée,,,,,,"Développement site web",,,,,,15/01/2023
2,FA-2023-002,20/03/2023,,Globex Inc,,,,2400.00,400.00,2000.00,,,,,,Encaissée,,,,,,"Audit sécurité",,,,,,25/03/2023
3,FA-2023-003,10/06/2023,,Acme Corp,,,,3600.00,600.00,3000.00,,,,,,Encaissée,,,,,,"Maintenance Q2",,,,,,15/06/2023
4,FA-2023-004,01/11/2023,,Initech,,,,720.00,120.00,600.00,,,,,,Encaissée,,,,,,"Formation React",,,,,,05/11/2023
5,FA-2024-001,10/01/2024,,Acme Corp,,,,1800.00,300.00,1500.00,,,,,,Encaissée,,,,,,"Développement mobile",,,,,,15/01/2024
6,FA-2024-002,14/02/2024,,Globex Inc,,,,960.00,160.00,800.00,,,,,,Encaissée,,,,,,"Support technique",,,,,,20/02/2024
7,FA-2024-003,22/04/2024,,Initech,,,,4800.00,800.00,4000.00,,,,,,Encaissée,,,,,,"Refonte ERP",,,,,,30/04/2024
8,FA-2024-004,15/07/2024,,Acme Corp,,,,2160.00,360.00,1800.00,,,,,,Encaissée,,,,,,"Hébergement annuel",,,,,,20/07/2024
9,FA-2024-005,10/09/2024,,Umbrella Ltd,,,,5400.00,900.00,4500.00,,,,,,Encaissée,,,,,,"Projet IA",,,,,,18/09/2024
10,FA-2024-006,15/11/2024,,Globex Inc,,,,1320.00,220.00,1100.00,,,,,,Encaissée,,,,,,"Audit RGPD",,,,,,22/11/2024
11,FA-2025-001,05/01/2025,,Acme Corp,,,,2400.00,400.00,2000.00,,,,,,Encaissée,,,,,,"Dev Q1 2025",,,,,,10/01/2025
12,FA-2025-002,20/02/2025,,Umbrella Ltd,,,,3000.00,500.00,2500.00,,,,,,Encaissée,,,,,,"Consulting data",,,,,,01/03/2025
13,FA-2025-003,10/03/2025,,Initech,,,,1440.00,240.00,1200.00,,,,,,À venir,,,,,,,"Formation avancée",,,,,,
14,FA-2025-004,25/03/2025,,Acme Corp,,,,1200.00,200.00,1000.00,,,,,,En retard,,,,,,,"Support urgent",,,,,, `;
