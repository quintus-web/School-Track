import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { 
  UploadCloud, FileText, CheckCircle2, AlertTriangle, 
  XCircle, ArrowRight, Loader2, Download, Trash2 
} from 'lucide-react';

interface CSVRow {
  student_name: string;
  admission_number: string;
  guardian_name: string;
  guardian_phone: string;
  route_name: string;
  stop_name: string;
  relationship?: string;
  [key: string]: string | undefined;
}

interface RowValidation {
  rowNumber: number;
  data: CSVRow;
  errors: string[];
  isValid: boolean;
}

interface ServerImportResponse {
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ row: number; admission_number?: string; error: string }>;
  error?: string;
}

interface Props {
  schoolSlug: string;
  authToken: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function StudentRosterImportModal({ 
  schoolSlug, 
  authToken, 
  isOpen, 
  onClose, 
  onSuccess 
}: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validatedRows, setValidatedRows] = useState<RowValidation[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverFeedback, setServerFeedback] = useState<ServerImportResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Client-side quick validation for Kenyan phone numbers before network roundtrip
  const isValidKenyanPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s-]/g, '');
    const keRegex = /^(?:\+254|254|0)?(7\d{8}|1\d{8})$/;
    return keRegex.test(cleaned);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setServerFeedback(null);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        const rows: RowValidation[] = results.data.map((row, index) => {
          const rowErrors: string[] = [];

          if (!row.student_name?.trim()) rowErrors.push('Missing Student Name');
          if (!row.admission_number?.trim()) rowErrors.push('Missing Admission No');
          if (!row.guardian_phone?.trim()) {
            rowErrors.push('Missing Phone Number');
          } else if (!isValidKenyanPhone(row.guardian_phone)) {
            rowErrors.push(`Invalid phone ('${row.guardian_phone}')`);
          }
          if (!row.route_name?.trim()) rowErrors.push('Missing Route');
          if (!row.stop_name?.trim()) rowErrors.push('Missing Stop');

          return {
            rowNumber: index + 2, // Accounting for CSV 1-index + header row
            data: row,
            errors: rowErrors,
            isValid: rowErrors.length === 0,
          };
        });

        setValidatedRows(rows);
      },
      error: () => {
        alert('Could not parse CSV file. Please verify file encoding.');
      },
    });
  };

  const handleDownloadTemplate = () => {
    const csvContent = 
      "student_name,admission_number,guardian_name,guardian_phone,route_name,stop_name,relationship\n" +
      "Brian Mwangi,ADM-2026-089,Grace Mwangi,0711223344,Rongai - Galleria Route,TotalEnergies Ongata Rongai,Mother\n" +
      "Faith Muthoni,ADM-2026-101,David Muthoni,+254722123456,Rongai - Galleria Route,Maasai Mall Gate,Father\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'schooltrack_roster_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCommitImport = async () => {
    if (!selectedFile) return;

    setIsSubmitting(true);
    setServerFeedback(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(
        `http://localhost:8000/api/students/admin/${schoolSlug}/import-students/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        }
      );

      const result: ServerImportResponse = await response.json();
      setServerFeedback(result);

      if (response.ok && result.success && result.errors.length === 0) {
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch {
      setServerFeedback({
        success: false,
        created: 0,
        updated: 0,
        errors: [],
        error: 'Network error communicating with SchoolTrack backend API.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setValidatedRows([]);
    setServerFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Bulk Import Student Roster</h2>
            <p className="text-xs text-slate-500">Upload transport assignments and auto-link guardian profiles</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-600 bg-white hover:bg-slate-100 transition"
            >
              <Download size={14} className="mr-1.5 text-slate-500" />
              CSV Template
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {!selectedFile ? (
            /* Upload Drop Area */
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 text-blue-600 flex items-center justify-center mb-3 transition">
                <UploadCloud size={28} />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">Click or drag CSV roster to upload</h3>
              <p className="text-xs text-slate-400 mt-1">Supports UTF-8 CSVs up to 5MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            /* File Active Banner */
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-3">
                <FileText className="text-blue-600" size={24} />
                <div>
                  <p className="text-xs font-semibold text-slate-800">{selectedFile.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB · {validatedRows.length} rows detected
                  </p>
                </div>
              </div>
              <button
                onClick={clearSelection}
                className="text-xs text-red-600 hover:text-red-700 inline-flex items-center p-1.5 rounded-lg hover:bg-red-50"
              >
                <Trash2 size={16} className="mr-1" /> Remove
              </button>
            </div>
          )}

          {/* Validation Metrics Summary */}
          {validatedRows.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Total Rows</span>
                <p className="text-lg font-bold text-slate-800">{validatedRows.length}</p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-[11px] font-semibold text-emerald-600 uppercase">Valid Rows</span>
                <p className="text-lg font-bold text-emerald-700">{validCount}</p>
              </div>
              <div className={`p-3 rounded-xl border ${invalidCount > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-[11px] font-semibold uppercase ${invalidCount > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                  Issues Detected
                </span>
                <p className={`text-lg font-bold ${invalidCount > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                  {invalidCount}
                </p>
              </div>
            </div>
          )}

          {/* Validation Errors Notice */}
          {invalidCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2 text-xs text-amber-800">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> {invalidCount} row(s) contain validation errors. Valid rows will still be processed, but failed rows will be rejected during upload.
              </span>
            </div>
          )}

          {/* Server Response Feedback */}
          {serverFeedback && (
            <div className={`p-4 rounded-xl border ${serverFeedback.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center space-x-2">
                {serverFeedback.success ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <XCircle size={18} className="text-red-600" />
                )}
                <span className={`text-xs font-bold ${serverFeedback.success ? 'text-emerald-900' : 'text-red-900'}`}>
                  {serverFeedback.success 
                    ? `Successfully processed: ${serverFeedback.created} created, ${serverFeedback.updated} updated.`
                    : serverFeedback.error || 'Import operation failed.'}
                </span>
              </div>
              {serverFeedback.errors?.length > 0 && (
                <ul className="mt-2 text-[11px] text-red-700 space-y-1 list-disc list-inside">
                  {serverFeedback.errors.map((err, i) => (
                    <li key={i}>
                      Row {err.row} {err.admission_number ? `(${err.admission_number})` : ''}: {err.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Data Preview Table */}
          {validatedRows.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner">
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Adm No</th>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Guardian</th>
                      <th className="py-2.5 px-3">Phone</th>
                      <th className="py-2.5 px-3">Route / Stop</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validatedRows.map((item) => (
                      <tr 
                        key={item.rowNumber} 
                        className={item.isValid ? 'hover:bg-slate-50' : 'bg-red-50/50 hover:bg-red-50'}
                      >
                        <td className="py-2.5 px-3">
                          {item.isValid ? (
                            <span className="inline-flex items-center text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Valid
                            </span>
                          ) : (
                            <span 
                              title={item.errors.join(', ')} 
                              className="inline-flex items-center text-[10px] font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full cursor-help"
                            >
                              Issue
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          {item.data.admission_number || '—'}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.data.student_name || '—'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.data.guardian_name || '—'}</td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className={!isValidKenyanPhone(item.data.guardian_phone || '') ? 'text-red-600 font-bold' : 'text-slate-600'}>
                            {item.data.guardian_phone || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.data.route_name} <ArrowRight size={10} className="inline text-slate-400 mx-1" /> {item.data.stop_name}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {validatedRows.length > 0 && `Ready to import ${validCount} student record(s).`}
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleCommitImport}
              disabled={!selectedFile || isSubmitting || validCount === 0}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Importing...
                </>
              ) : (
                `Commit ${validCount} Records`
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}