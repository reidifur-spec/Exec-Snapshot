import React, { useState, useEffect, useCallback } from 'react';
import { Check, ShieldCheck, AlertCircle, Sparkles, FileCheck, Globe, FileDown, ClipboardCopy, ChevronDown, ChevronUp } from 'lucide-react';
import { AppStatus, ValidationResult } from '../types';
import { marked } from 'marked';

interface SnapshotDisplayProps {
  content: string;
  status: AppStatus;
  validationResult: ValidationResult | null;
  onValidate: () => void;
  onRefine: () => void;
  autoDownloadTrigger?: number;
}

const SnapshotDisplay: React.FC<SnapshotDisplayProps> = ({ 
  content, 
  status, 
  validationResult, 
  onValidate, 
  onRefine,
  autoDownloadTrigger = 0 
}) => {
  const [richCopied, setRichCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [isValidationMinimized, setIsValidationMinimized] = useState(false);



  // Helper to format citations as superscript
  const formatCitations = useCallback((text: string) => {
    if (!text) return "";
    // Replace [V1], [C10], [V1, V2] etc. with sup tags
    return text.replace(/\[((?:[CV]\d+(?:,\s*)?)+)\]/g, '<sup>[$1]</sup>');
  }, []);

  // Helper to generate the HTML with inline styles for Google Docs/Word compatibility
  const getStyledHtml = useCallback((markdown: string) => {
    // Format citations before parsing
    const formattedMarkdown = formatCitations(markdown || '');
    // Configure marked to respect line breaks (gfm: true is default, breaks: true treats \n as <br>)
    const rawHtml = marked.parse(formattedMarkdown, { async: false, breaks: true }) as string;
    
    // We wrap it in a full HTML structure with specific styles that Word/Docs respect
    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <style>
          body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; text-align: justify; }
          h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 12pt; color: #4C9E0D; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 24pt; margin-bottom: 6pt; page-break-after: avoid; text-align: left; color: #4C9E0D; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 12pt; margin-bottom: 3pt; page-break-after: avoid; text-align: left; color: #4C9E0D; }
          p { margin-bottom: 6pt; margin-top: 0; text-align: justify; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 8pt; margin-top: 2pt; }
          th { background-color: #f2f2f2; font-weight: bold; text-align: left; border: 1px solid #d1d5db; padding: 3pt; font-size: 11pt; margin: 0; }
          td { border: 1px solid #d1d5db; padding: 3pt; vertical-align: top; font-size: 11pt; margin: 0; text-align: left; }
          /* Ensure no spacing after or before in table cells */
          th p, td p { margin-top: 0; margin-bottom: 0; text-align: left; }
          
          ul { margin-bottom: 8pt; margin-top: 2pt; }
          ol { margin-bottom: 8pt; margin-top: 2pt; list-style-type: decimal; }
          li { margin-bottom: 2pt; font-size: 11pt; text-align: justify; }
          strong, b { color: #000000; }
          sup { vertical-align: super; font-size: smaller; }
        </style>
      </head>
      <body>
        ${rawHtml}
      </body>
      </html>
    `;
  }, [formatCitations]);

  const handleCopyRichText = async () => {
    const html = getStyledHtml(content);
    try {
      const blob = new Blob([html], { type: 'text/html' });
      // Also provide plain text fallback
      const textBlob = new Blob([content], { type: 'text/plain' });
      
      const data = [new ClipboardItem({
        'text/html': blob,
        'text/plain': textBlob,
      })];
      
      await navigator.clipboard.write(data);
      setRichCopied(true);
      setTimeout(() => setRichCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy rich text:', err);
      alert('Browser does not support rich copy. Please use "Download .doc" instead.');
    }
  };

  const handleDownloadDoc = useCallback(() => {
    const html = getStyledHtml(content);
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Extract ticker and quarter for filename if possible
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `Snapshot_Export_${dateStr}.doc`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [content, getStyledHtml]);

  const getFeedbackColor = (item: string, defaultColor: string) => {
    if (item.includes('[VERIFIED (DOC)]')) return 'text-emerald-700 font-bold'; 
    if (item.includes('[VERIFIED (WEB)]')) return 'text-green-600 font-medium';
    if (item.includes('[CONTENT ERROR]')) return 'text-red-700 font-bold';
    if (item.includes('[FORMAT ERROR]')) return 'text-amber-700';
    return defaultColor;
  };

  const getFeedbackIcon = (item: string) => {
    if (item.includes('[VERIFIED (DOC)]')) return <FileCheck className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />;
    if (item.includes('[VERIFIED (WEB)]')) return <Globe className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />;
    if (item.includes('[CONTENT ERROR]')) return <AlertCircle className="w-4 h-4 text-red-600 mt-1 flex-shrink-0" />;
    return <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0"></span>;
  };

  // Auto-switch to preview when content changes significantly
  useEffect(() => {
    if (content) {
        setViewMode('preview');
    }
  }, [content]);

  // Handle auto-download when trigger changes
  useEffect(() => {
    if (autoDownloadTrigger > 0 && content) {
        handleDownloadDoc();
    }
  }, [autoDownloadTrigger, content, handleDownloadDoc]);

  // Reset minimized state when a new validation result comes in
  useEffect(() => {
    if (validationResult) {
      setIsValidationMinimized(false);
    }
  }, [validationResult]);

  if (!content && status !== AppStatus.GENERATING && status !== AppStatus.REFINING) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl h-full flex flex-col items-center justify-center text-slate-400 min-h-[500px]">
        <FileTextPlaceholder />
        <p className="mt-4 font-medium">Ready to generate</p>
        <p className="text-sm">Enter parameters on the left to begin.</p>
      </div>
    );
  }

  const isValidating = status === AppStatus.VALIDATING;
  const isRefining = status === AppStatus.REFINING;
  const isGenerating = status === AppStatus.GENERATING;
  
  // Show spinner overlay for Generating, Refining, AND Validating
  const isBusy = isGenerating || isRefining || isValidating;
  
  // Use breaks: true so newlines in generated markdown are preserved as <br>
  const renderedContent = marked.parse(formatCitations(content || ''), { async: false, breaks: true }) as string;

  let busyMessage = 'Processing...';
  if (isRefining) busyMessage = 'Applying Auto-Fixes & Polishing...';
  if (isGenerating) busyMessage = 'Researching & Writing...';
  if (isValidating) busyMessage = 'Performing Deep Dive Audit... Please Wait.';

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 gap-4">
        <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-700">Generated Output</h3>
            <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                <button
                    onClick={() => setViewMode('preview')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'preview' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Preview
                </button>
                <button
                    onClick={() => setViewMode('raw')}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'raw' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Raw
                </button>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
           {!isBusy && content && (
             <button
               onClick={onValidate}
               disabled={isValidating}
               className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors border border-indigo-200"
             >
               <ShieldCheck className="w-4 h-4" />
               {validationResult ? 'Re-Validate' : 'Deep Dive Validate'}
             </button>
           )}

            <div className="h-5 w-px bg-slate-300 mx-1 hidden sm:block"></div>

            <button
                onClick={handleCopyRichText}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-md transition-colors border border-slate-200 shadow-sm group"
                title="Copy formatted text for Google Docs/Word"
            >
                {richCopied ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardCopy className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />}
                {richCopied ? 'Copied!' : 'Copy Formatted'}
            </button>

            <button
                onClick={handleDownloadDoc}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 rounded-md transition-colors border border-slate-200 shadow-sm group"
                title="Download as Word Document"
            >
                <FileDown className="w-4 h-4 text-slate-500 group-hover:text-blue-600" />
                Download .doc
            </button>
        </div>
      </div>

      {/* Editor/Viewer */}
      <div className="flex-grow relative bg-white overflow-hidden flex flex-col">
        {isBusy ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
               <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
               <p className="text-slate-500 font-medium animate-pulse">
                 {busyMessage}
               </p>
            </div>
        ) : null}
        
        {/* Content Area */}
        <div className="flex-grow overflow-auto p-6">
            {viewMode === 'preview' ? (
                <div 
                  className="markdown-preview"
                  dangerouslySetInnerHTML={{ __html: renderedContent }} 
                />
            ) : (
                <textarea
                  readOnly
                  value={content}
                  className="w-full h-full resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-800 bg-white"
                  spellCheck={false}
                />
            )}
        </div>
      </div>

      {/* Validation Panel Overlay */}
      {validationResult && !isBusy && (
        <div className={`border-t ${validationResult.isValid ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'} transition-all duration-300`}>
          <div className="p-4 flex items-start gap-4">
             <div className={`p-2 rounded-full ${validationResult.isValid ? 'bg-green-100' : 'bg-amber-100'}`}>
                {validationResult.isValid ? (
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600" />
                )}
             </div>
             <div className="flex-grow">
                <div className="flex justify-between items-start">
                   <div>
                       <h4 className={`font-bold ${validationResult.isValid ? 'text-green-800' : 'text-amber-800'}`}>
                         Quality Audit Score: {validationResult.score}/100
                       </h4>
                       {isValidationMinimized ? (
                         <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                           {validationResult.feedback.length} items found. 
                           <button onClick={() => setIsValidationMinimized(false)} className="underline hover:text-slate-700">
                             Show details
                           </button>
                         </p>
                       ) : (
                         <span className="text-xs font-mono text-slate-500">Est. Words: {validationResult.wordCount}</span>
                       )}
                   </div>
                   <button 
                     onClick={() => setIsValidationMinimized(!isValidationMinimized)}
                     className="p-1 hover:bg-black/5 rounded text-slate-500 transition-colors"
                     title={isValidationMinimized ? "Expand" : "Minimize"}
                   >
                     {isValidationMinimized ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                   </button>
                </div>
                
                {!isValidationMinimized && (
                  <div className="mt-3">
                    <ul className="text-sm space-y-2 mb-3 max-h-[300px] overflow-y-auto pr-2">
                      {validationResult.feedback.map((item, idx) => {
                        const defaultColor = validationResult.isValid ? 'text-green-700' : 'text-amber-800';
                        return (
                          <li key={idx} className={`flex items-start gap-2 ${getFeedbackColor(item, defaultColor)}`}>
                            {getFeedbackIcon(item)}
                            <span className="leading-snug">{item.replace(/\*\*/g, '')}</span>
                          </li>
                        );
                      })}
                    </ul>
                    
                    {/* Auto-Fix Button */}
                    <button
                       onClick={onRefine}
                       className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm
                        ${validationResult.isValid 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-amber-600 hover:bg-amber-700 text-white'}`}
                    >
                       <Sparkles className="w-4 h-4" />
                       {validationResult.score === 100 ? 'Re-Generate Snapshot' : 'Auto-Fix Issues'}
                    </button>
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FileTextPlaceholder = () => (
    <svg className="w-16 h-16 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
)

export default SnapshotDisplay;