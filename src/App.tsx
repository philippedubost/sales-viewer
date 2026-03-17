import React, { useState } from 'react';
import type { Invoice } from './types';
import FileUpload from './components/FileUpload';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

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
