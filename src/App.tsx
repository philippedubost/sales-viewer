import React, { useState } from 'react';
import type { Invoice } from './types';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';
import { decodeInvoices } from './utils/shareUrl';

function loadFromUrl(): Invoice[] | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const d = params.get('d');
    if (d) return decodeInvoices(d);
  } catch { /* ignore */ }
  return null;
}

interface AppProps { initialInvoices?: Invoice[] }

const App: React.FC<AppProps> = ({ initialInvoices }) => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(initialInvoices ?? loadFromUrl);

  const handleData = (data: Invoice[]) => {
    setInvoices(data);
  };

  const handleReset = () => {
    setInvoices(null);
  };

  if (!invoices) {
    return <FileUpload onData={handleData} />;
  }

  return <Dashboard invoices={invoices} onReset={handleReset} />;
};

export default App;
