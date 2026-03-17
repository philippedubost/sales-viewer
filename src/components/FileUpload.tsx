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
      setError('Veuillez importer un fichier .csv');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const invoices = parseCSV(text);
        if (invoices.length === 0) {
          setError('Aucune facture trouvée. Vérifiez qu\'il s\'agit d\'un export PennyLane.');
          return;
        }
        setError(null);
        onData(invoices);
      } catch (err) {
        setError('Impossible de lire ce fichier.');
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

  const handleDragLeave = useCallback(() => setDragging(false), []);

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
      setError('Erreur lors du chargement des données de démo.');
      console.error(err);
    }
  }, [onData]);

  return (
    <div className="min-h-screen flex" style={{ background: '#080d17' }}>

      {/* Left panel */}
      <div className="hidden lg:flex w-72 flex-col justify-between p-10 flex-shrink-0"
        style={{ background: '#0d1526', borderRight: '1px solid #1a2740' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: '#10b981' }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="font-semibold text-white">Sales Viewer</span>
          </div>

          <div className="space-y-7">
            {[
              { icon: '📅', label: 'Chronologie', desc: 'Visualisez vos encaissements dans le temps' },
              { icon: '🥧', label: 'Répartition', desc: 'Identifiez vos clients les plus importants' },
              { icon: '📊', label: 'CA annuel', desc: 'Suivez vos performances par année' },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{f.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{f.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#3d5470' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: '#1e3048' }}>Compatible exports PennyLane</p>
      </div>

      {/* Upload area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-sm">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">Vos ventes, en clair</h1>
            <p className="text-sm" style={{ color: '#3d5470' }}>
              Importez votre export CSV PennyLane.
            </p>
          </div>

          {/* Drop zone */}
          <div
            className="rounded-2xl p-10 text-center cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragging ? '#10b981' : '#1a2740'}`,
              background: dragging ? 'rgba(16,185,129,0.05)' : '#0d1526',
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleInputChange} />
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: '#111e30' }}>
                <svg className="w-5 h-5" style={{ color: '#10b981' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-white text-sm font-medium">Déposez votre fichier ici</p>
                <p className="text-xs mt-1" style={{ color: '#3d5470' }}>ou cliquez pour parcourir</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: '#1a2740' }} />
            <span className="text-xs" style={{ color: '#1e3048' }}>ou</span>
            <div className="flex-1 h-px" style={{ background: '#1a2740' }} />
          </div>

          <button
            onClick={loadSampleData}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{ background: '#0d1526', border: '1px solid #1a2740', color: '#3d5470' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d4060';
              (e.currentTarget as HTMLButtonElement).style.color = '#6b8aaa';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a2740';
              (e.currentTarget as HTMLButtonElement).style.color = '#3d5470';
            }}
          >
            Voir la démo
          </button>

        </div>
      </div>
    </div>
  );
};

export default FileUpload;
