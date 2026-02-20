import React, { useRef, useState, useEffect } from 'react';
import { SnapshotInputs, AppStatus, UploadedFile } from '../types';
import { FileText, Calendar, Building2, Clock, Upload, X, File as FileIcon, Table, Sparkles, FileEdit, ScrollText, Users, LoaderCircle } from 'lucide-react';
import { COMPANY_LIST, QUARTER_OPTIONS, YEAR_OPTIONS } from '../constants';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';

interface InputFormProps {
  inputs: SnapshotInputs;
  setInputs: React.Dispatch<React.SetStateAction<SnapshotInputs>>;
  status: AppStatus;
  onGenerate: (mode: 'auto' | 'manual') => void;
}

const InputForm: React.FC<InputFormProps> = ({ inputs, setInputs, status, onGenerate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const metricsInputRef = useRef<HTMLInputElement>(null);
  const consensusInputRef = useRef<HTMLInputElement>(null);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null); // For Quarterly Metrics
  const [consensusWorkbook, setConsensusWorkbook] = useState<XLSX.WorkBook | null>(null); // For Consensus Data

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleQuarterChange = (type: 'q' | 'y', value: string) => {
    const parts = inputs.quarter.split(' ');
    let q = parts[0] || QUARTER_OPTIONS[0];
    let y = parts[1] || YEAR_OPTIONS[0];

    if (type === 'q') q = value;
    if (type === 'y') y = value;

    setInputs(prev => ({ ...prev, quarter: `${q} ${y}` }));
  };

  // --- Unified File Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'analyst' | 'transcript') => {
    if (e.target.files) {
      const fileList: File[] = Array.from(e.target.files);

      fileList.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} is too large (max 10MB)`);
          return;
        }

        const fileId = uuidv4();
        const reader = new FileReader();

        const newFile: UploadedFile = {
          id: fileId,
          name: file.name,
          mimeType: file.type || 'application/pdf',
          data: '',
          status: 'uploading',
          progress: 0,
          type: type,
          cancel: () => reader.abort(),
        };

        // Add to the correct array
        const targetArray = type === 'analyst' ? 'files' : 'transcriptFiles';
        setInputs(prev => ({
          ...prev,
          [targetArray]: [...prev[targetArray], newFile]
        }));

        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded * 100) / event.total);
            setInputs(prev => ({
              ...prev,
              [targetArray]: prev[targetArray].map(f => f.id === fileId ? { ...f, progress } : f)
            }));
          }
        };

        reader.onload = () => {
          const base64Data = reader.result as string;
          const cleanBase64 = base64Data.split(',')[1];
          setInputs(prev => ({
            ...prev,
            [targetArray]: prev[targetArray].map(f => f.id === fileId ? { ...f, status: 'completed', data: cleanBase64, progress: 100 } : f)
          }));
        };

        reader.onerror = () => {
          setInputs(prev => ({
            ...prev,
            [targetArray]: prev[targetArray].map(f => f.id === fileId ? { ...f, status: 'error' } : f)
          }));
        };

        reader.onabort = () => {
          setInputs(prev => ({
            ...prev,
            [targetArray]: prev[targetArray].filter(f => f.id !== fileId)
          }));
        };

        reader.readAsDataURL(file);
      });

      // Reset file input
      if (e.target) e.target.value = '';
    }
  };

  const removeFile = (id: string, type: 'analyst' | 'transcript') => {
    const targetArray = type === 'analyst' ? 'files' : 'transcriptFiles';
    const fileToRemove = inputs[targetArray].find(f => f.id === id);

    if (fileToRemove && fileToRemove.status === 'uploading' && fileToRemove.cancel) {
      fileToRemove.cancel();
    } else {
      setInputs(prev => ({
        ...prev,
        [targetArray]: prev[targetArray].filter(f => f.id !== id)
      }));
    }
  };

  // --- Metrics File Upload Logic (Quarterly) ---
  const handleMetricsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setInputs(prev => ({ ...prev, metricsFileName: file.name }));
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.");
      }
      if (metricsInputRef.current) metricsInputRef.current.value = '';
    }
  };

  const removeMetricsFile = () => {
    setWorkbook(null);
    setInputs(prev => ({ ...prev, metricsFileName: undefined, metricsContext: undefined }));
  };

  // --- Consensus Data File Upload Logic (Was Segment Data) ---
  const handleConsensusUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        setConsensusWorkbook(wb);
        setInputs(prev => ({ ...prev, consensusFileName: file.name }));
      } catch (err) {
        console.error("Error parsing Excel:", err);
        alert("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.");
      }
      if (consensusInputRef.current) consensusInputRef.current.value = '';
    }
  };

  const removeConsensusFile = () => {
    setConsensusWorkbook(null);
    setInputs(prev => ({ ...prev, consensusFileName: undefined, consensusContext: undefined }));
  };

  // Helper to extract data from a workbook based on range
  const extractFromWorkbook = (wb: XLSX.WorkBook, company: string, range: XLSX.Range) => {
      // Prioritize searching for a 'Metrics' tab
      let targetSheetName = wb.SheetNames.find(s => s.trim().toLowerCase() === 'metrics');
      
      // Fallback: Check for company name if 'Metrics' tab is not found
      if (!targetSheetName) {
        const companyLower = company.toLowerCase();
        targetSheetName = wb.SheetNames.find(s => s.toLowerCase() === companyLower);
        
        if (!targetSheetName) {
          const simplifiedName = company.replace(/The /i, '').replace(/ Company/i, '').replace(/ Corporation/i, '').replace(/ Holdings/i, '').trim().toLowerCase();
          targetSheetName = wb.SheetNames.find(s => s.toLowerCase().includes(simplifiedName) || simplifiedName.includes(s.toLowerCase()));
        }
      }

      if (targetSheetName) {
        const sheet = wb.Sheets[targetSheetName];
        const options = { range: range, header: 1, defval: '', raw: false };
        const jsonData = XLSX.utils.sheet_to_json(sheet, options) as any[][];
        
        let lastCategory = '';
        const processedData = jsonData.map((row, rowIndex) => {
            const newRow = [...row];
            // Fill Right (Row 1 generally)
            if (rowIndex === 1) {
                let lastVal = '';
                for (let i = 3; i < newRow.length; i++) {
                    const val = newRow[i];
                    if (val && String(val).trim() !== '') {
                        lastVal = String(val);
                    } else if (lastVal) {
                        newRow[i] = lastVal;
                    }
                }
            }
            // Fill Down (Column 0)
            if (rowIndex > 1) {
                const currentCat = newRow[0] ? String(newRow[0]).trim() : '';
                if (currentCat) {
                    lastCategory = currentCat;
                } else if (lastCategory) {
                    newRow[0] = lastCategory;
                }
            }
            return newRow;
        });
        return processedData.map(row => row.join(',')).join('\n');
      }
      return null;
  };

  // Effect: Extract Quarterly Metrics (B31:K43)
  useEffect(() => {
    if (workbook && inputs.company) {
        // B31:K43 -> Col 1 to 10, Row 30 to 42 (0-indexed)
        const range = { s: { c: 1, r: 30 }, e: { c: 10, r: 42 } };
        const csv = extractFromWorkbook(workbook, inputs.company, range);
        if (csv) {
            setInputs(prev => ({ ...prev, metricsContext: csv }));
        } else {
            console.warn(`Could not find 'Metrics' sheet or sheet for ${inputs.company} in Quarterly Metrics file`);
            setInputs(prev => ({ ...prev, metricsContext: undefined }));
        }
    }
  }, [workbook, inputs.company, setInputs]);

  // Effect: Extract Consensus Data (B53:K55)
  useEffect(() => {
    if (consensusWorkbook && inputs.company) {
        // B53:K55 -> Col 1 to 10, Row 52 to 54 (0-indexed)
        const range = { s: { c: 1, r: 52 }, e: { c: 10, r: 54 } };
        const csv = extractFromWorkbook(consensusWorkbook, inputs.company, range);
        if (csv) {
            setInputs(prev => ({ ...prev, consensusContext: csv }));
        } else {
            console.warn(`Could not find 'Metrics' sheet or sheet for ${inputs.company} in Consensus Data file`);
            setInputs(prev => ({ ...prev, consensusContext: undefined }));
        }
    }
  }, [consensusWorkbook, inputs.company, setInputs]);


  // --- Render Helpers ---
  const [currentQ, currentY] = inputs.quarter.split(' ');
  const safeQ = QUARTER_OPTIONS.includes(currentQ) ? currentQ : QUARTER_OPTIONS[0];
  const safeY = YEAR_OPTIONS.includes(currentY) ? currentY : YEAR_OPTIONS[0];
  const isGenerating = status === AppStatus.GENERATING || status === AppStatus.REFINING || status === AppStatus.VALIDATING;

  // Disable future quarters logic
  const today = new Date();
  const realCurrentYear = today.getFullYear();
  const realCurrentMonth = today.getMonth(); 
  const realCurrentQValue = Math.floor(realCurrentMonth / 3) + 1;

  const FileUploadItem: React.FC<{file: UploadedFile}> = ({ file }) => {
    const getFileIcon = () => {
      if (file.type === 'analyst') return <FileIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />;
      if (file.type === 'transcript') return <ScrollText className="w-4 h-4 text-indigo-500 flex-shrink-0" />;
      return <FileIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />;
    };

    return (
      <div className="bg-white p-2 rounded border border-slate-200 text-sm relative overflow-hidden">
        <div className={`absolute top-0 left-0 h-full bg-blue-100 transition-all duration-300 ${file.status === 'completed' ? 'bg-green-100' : ''}`} style={{ width: `${file.progress}%` }}></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-hidden">
            {getFileIcon()}
            <span className="truncate text-slate-700" title={file.name}>{file.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {file.status === 'uploading' && (
              <span className="text-xs text-slate-500 font-mono">{file.progress}%</span>
            )}
             {file.status === 'error' && (
              <span className="text-xs text-red-500 font-semibold">Error</span>
            )}
            <button 
              onClick={() => removeFile(file.id, file.type)}
              disabled={isGenerating}
              className="text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          Snapshot Parameters
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure the target company and period for the report.
        </p>
      </div>

      <div className="space-y-5 flex-grow overflow-y-auto pr-2">
        {/* Analyst Coverage Upload */}
        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
             <Upload className="w-8 h-8 text-blue-500 mb-2" />
             <h3 className="text-sm font-semibold text-slate-700">Add Analyst Coverage</h3>
             <p className="text-xs text-slate-500 mb-3 px-2">
               Upload PDF reports or text files. Prioritized over public data.
             </p>
             <input
               ref={fileInputRef}
               type="file"
               multiple
               accept=".pdf,.txt,application/pdf,text/plain"
               onChange={(e) => handleFileUpload(e, 'analyst')}
               disabled={isGenerating}
               className="hidden"
               id="file-upload"
             />
             <label 
               htmlFor="file-upload"
               className={`px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               Select Files
             </label>
          </div>
          {inputs.files.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Analyst Reports ({inputs.files.length})</p>
              {inputs.files.map((file) => (
                <FileUploadItem key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>

        {/* Earnings Transcript Upload */}
        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
             <ScrollText className="w-8 h-8 text-indigo-500 mb-2" />
             <h3 className="text-sm font-semibold text-slate-700">Add Earnings Transcript</h3>
             <p className="text-xs text-slate-500 mb-3 px-2">
               Upload transcript PDF or text. Used for management commentary and guidance.
             </p>
             <input
               ref={transcriptInputRef}
               type="file"
               multiple
               accept=".pdf,.txt,application/pdf,text/plain"
               onChange={(e) => handleFileUpload(e, 'transcript')}
               disabled={isGenerating}
               className="hidden"
               id="transcript-upload"
             />
             <label 
               htmlFor="transcript-upload"
               className={`px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               Select Files
             </label>
          </div>
          {inputs.transcriptFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Earnings Transcripts ({inputs.transcriptFiles.length})</p>
              {inputs.transcriptFiles.map((file) => (
                <FileUploadItem key={file.id} file={file} />
              ))}
            </div>
          )}
        </div>

        {/* Quarterly Metrics File Upload */}
        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
             <Table className="w-8 h-8 text-emerald-500 mb-2" />
             <h3 className="text-sm font-semibold text-slate-700">Add Quarterly Metrics</h3>
             <p className="text-xs text-slate-500 mb-3 px-2">
               Upload Excel. Extracts range <strong>B31:K43</strong> of the company tab.
             </p>
             <input
               ref={metricsInputRef}
               type="file"
               accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
               onChange={handleMetricsUpload}
               disabled={isGenerating}
               className="hidden"
               id="metrics-upload"
             />
             <label 
               htmlFor="metrics-upload"
               className={`px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               Select Excel File
             </label>
          </div>
          {inputs.metricsFileName && (
             <div className="mt-4 flex items-center justify-between bg-emerald-50 p-2 rounded border border-emerald-200 text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Table className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="truncate text-emerald-900 font-medium" title={inputs.metricsFileName}>{inputs.metricsFileName}</span>
                    <span className="text-xs text-emerald-600">
                      {inputs.metricsContext ? 'Quarterly metrics extracted' : 'Tab not found'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={removeMetricsFile}
                  disabled={isGenerating}
                  className="text-emerald-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
          )}
        </div>

        {/* Consensus (Analyst) File Upload (Renamed from Segment Data) */}
        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg">
          <div className="flex flex-col items-center justify-center text-center">
             <Users className="w-8 h-8 text-purple-500 mb-2" />
             <h3 className="text-sm font-semibold text-slate-700">Consensus (Analyst)</h3>
             <p className="text-xs text-slate-500 mb-3 px-2">
               Upload Excel. Extracts range <strong>B53:K55</strong> of the company tab.
             </p>
             <input
               ref={consensusInputRef}
               type="file"
               accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
               onChange={handleConsensusUpload}
               disabled={isGenerating}
               className="hidden"
               id="consensus-upload"
             />
             <label 
               htmlFor="consensus-upload"
               className={`px-4 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               Select Excel File
             </label>
          </div>
          {inputs.consensusFileName && (
             <div className="mt-4 flex items-center justify-between bg-purple-50 p-2 rounded border border-purple-200 text-sm">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="flex flex-col truncate">
                    <span className="truncate text-purple-900 font-medium" title={inputs.consensusFileName}>{inputs.consensusFileName}</span>
                    <span className="text-xs text-purple-600">
                      {inputs.consensusContext ? 'Consensus data extracted' : 'Tab not found'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={removeConsensusFile}
                  disabled={isGenerating}
                  className="text-purple-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
             </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Target Company</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <select
              name="company"
              value={inputs.company}
              onChange={handleChange}
              disabled={isGenerating}
              className="pl-10 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-slate-100 disabled:text-slate-500"
            >
              {COMPANY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Designated Quarter</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs pointer-events-none">YR</div>
              <select
                value={safeY}
                onChange={(e) => handleQuarterChange('y', e.target.value)}
                disabled={isGenerating}
                className="pl-10 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-slate-100 disabled:text-slate-500"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <Clock className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
              <select
                value={safeQ}
                onChange={(e) => handleQuarterChange('q', e.target.value)}
                disabled={isGenerating}
                className="pl-10 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-slate-100 disabled:text-slate-500"
              >
                {QUARTER_OPTIONS.map((q) => {
                  const qVal = parseInt(q.replace('Q', ''));
                  const isCurrentYear = parseInt(safeY) === realCurrentYear;
                  const isDisabled = isCurrentYear && qVal > realCurrentQValue + 1;
                  return (
                    <option key={q} value={q} disabled={isDisabled} className={isDisabled ? 'text-slate-300' : ''}>
                      {q} {isDisabled ? '(Future)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prepared Date (DD, MM, YYYY)</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
            <input
              type="text"
              name="preparedDate"
              value={inputs.preparedDate}
              onChange={handleChange}
              disabled={isGenerating}
              className="pl-10 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border disabled:bg-slate-100 disabled:text-slate-500"
              placeholder="DD, MM, YYYY"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-6 border-t border-slate-100 space-y-3">
        {/* Draft Button (Manual Mode) */}
        <button
          onClick={() => onGenerate('manual')}
          disabled={isGenerating}
          className={`w-full flex justify-center items-center gap-2 py-3 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-semibold text-slate-700 
            ${isGenerating ? 'bg-slate-50 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50 hover:border-slate-400'}
            transition-all duration-200`}
        >
          <FileEdit className="w-4 h-4 text-slate-500" />
          Generate Draft Only
        </button>

        {/* Fully Automated Button */}
        <button
          onClick={() => onGenerate('auto')}
          disabled={isGenerating}
          className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white 
            ${isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'}
            transition-all duration-200`}
        >
          {isGenerating ? (
            <span className="flex items-center gap-2">
              <LoaderCircle className="animate-spin h-4 w-4 text-white" />
              {status === AppStatus.REFINING ? 'Refining...' : status === AppStatus.VALIDATING ? 'Validating...' : 'Automating...'}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-200" />
              Generate Snapshot - Fully Automated
            </span>
          )}
        </button>
        
        <p className="text-xs text-slate-400 mt-2 text-center">
          Uses Gemini 3 Pro with Google Search Grounding.
        </p>
      </div>
    </div>
  );
};

export default InputForm;