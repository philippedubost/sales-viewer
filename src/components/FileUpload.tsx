import React, { useCallback, useRef, useState } from 'react';
import { parseCSV, SAMPLE_CSV } from '../utils/csvParser';
import type { Invoice } from '../types';

interface FileUploadProps {
  onData: (invoices: Invoice[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onData }) => {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const invoices = parseCSV(text);
        if (invoices.length === 0) {
          setError('No valid invoices found in this CSV file. Please check the format.');
          return;
        }
        setError(null);
        onData(invoices);
      } catch (err) {
        setError('Failed to parse CSV file. Please check the format.');
        console.error(err);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, [onData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const loadSampleData = useCallback(() => {
    try {
      const invoices = parseCSV(SAMPLE_CSV);
      setError(null);
      onData(invoices);
    } catch (err) {
      setError('Failed to load sample data.');
      console.error(err);
    }
  }, [onData]);

  return (
    <div className="min-h-screen bg-[#0e1018] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Sales Dashboard</h1>
          <p className="text-gray-400 text-lg">Upload your PennyLane CSV export to visualize your revenue</p>
        </div>

        {/* Drop zone */}
        <div
          className={`
            border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200
            ${dragging
              ? 'border-blue-400 bg-blue-400/10'
              : 'border-gray-600 hover:border-gray-400 hover:bg-white/5'
            }
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-white text-lg font-medium">Drop your CSV file here</p>
              <p className="text-gray-400 text-sm mt-1">or click to browse</p>
            </div>
            <p className="text-gray-500 text-xs">Supports PennyLane CSV format (.csv)</p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/40 border border-red-600 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-700" />
          <span className="text-gray-500 text-sm">or</span>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        {/* Sample data button */}
        <button
          onClick={loadSampleData}
          className="w-full py-4 rounded-xl border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 hover:bg-white/5 transition-all duration-200 font-medium"
        >
          Load sample data
          <span className="ml-2 text-gray-500 text-sm font-normal">— preview the app with demo invoices</span>
        </button>

        {/* Format hint */}
        <div className="mt-8 p-4 bg-gray-800/50 rounded-xl text-xs text-gray-500">
          <p className="font-medium text-gray-400 mb-2">Expected CSV columns (PennyLane format):</p>
          <p>Col 0: ID · Col 1: Invoice # · Col 2: Date DD/MM/YYYY · Col 4: Client · Col 8: Total TTC · Col 16: Status · Col 27: Payment date</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
