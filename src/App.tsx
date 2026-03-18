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

const App: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(loadFromUrl);

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
