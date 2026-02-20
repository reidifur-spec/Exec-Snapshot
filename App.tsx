import React, { useState } from 'react';
import InputForm from './components/InputForm';
import SnapshotDisplay from './components/SnapshotDisplay';
import { generateSnapshot, validateSnapshot, refineSnapshot } from './services/geminiService';
import { SnapshotInputs, AppStatus, ValidationResult } from './types';
import { INITIAL_INPUTS } from './constants';
import { Layout } from 'lucide-react';

const App: React.FC = () => {
  const [inputs, setInputs] = useState<SnapshotInputs>(INITIAL_INPUTS);
  const [generatedContent, setGeneratedContent] = useState<string>('');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoDownloadTrigger, setAutoDownloadTrigger] = useState<number>(0);

  const getFriendlyError = (err: any) => {
    const msg = err?.message || JSON.stringify(err);
    if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
       return "Daily quota exceeded (429). The AI model is currently busy or your API key has hit its limit. Please try again later.";
    }
    return msg || "An unexpected error occurred.";
  };

  const handleGenerate = async (mode: 'auto' | 'manual') => {
    setStatus(AppStatus.GENERATING);
    setValidationResult(null);
    setErrorMsg(null);
    setGeneratedContent('');

    try {
      // Step 1: Generate Content
      const initialContent = await generateSnapshot(inputs);
      setGeneratedContent(initialContent);

      // If Manual Mode (Draft Only), stop here.
      if (mode === 'manual') {
        setStatus(AppStatus.GENERATED);
        return;
      }
      
      // Step 2: Auto-Validate
      // Switch status to VALIDATING immediately
      setStatus(AppStatus.VALIDATING);
      const valResult = await validateSnapshot(inputs, initialContent);
      setValidationResult(valResult);



      // Step 3: Auto-Fix (Refine) ONLY if there are validation issues
      if (!valResult.isValid || valResult.score < 100) {
        setStatus(AppStatus.REFINING);
        // Use the validation feedback to refine the document
        const fixedContent = await refineSnapshot(inputs, initialContent, valResult.feedback);

        setGeneratedContent(fixedContent);
        
        // Clear the old validation result because we just fixed the document.
        // The user can manually click "Deep Dive Validate" again if they want to double-check the fixed version.
        setValidationResult(null);
      }

      // Mark as finished
      setStatus(AppStatus.GENERATED);

      // Step 4: Auto-Download
      // Trigger the download in SnapshotDisplay
      setAutoDownloadTrigger(Date.now());

    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(getFriendlyError(err));
    }
  };

  const handleValidate = async () => {
    if (!generatedContent) return;
    setStatus(AppStatus.VALIDATING);
    try {
      // Pass inputs along with content so validator can check facts against source docs/search
      const result = await validateSnapshot(inputs, generatedContent);
      setValidationResult(result);
      setStatus(AppStatus.VALIDATED);
    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(getFriendlyError(err));
    }
  };

  const handleRefine = async () => {
    if (!generatedContent || !validationResult) return;
    
    setStatus(AppStatus.REFINING);
    setErrorMsg(null);
    
    try {
      const result = await refineSnapshot(inputs, generatedContent, validationResult.feedback);
      setGeneratedContent(result);
      // Clear validation result after refinement, user can validate again if they wish
      setValidationResult(null); 
      setStatus(AppStatus.GENERATED);
    } catch (err: any) {
      console.error(err);
      setStatus(AppStatus.ERROR);
      setErrorMsg(getFriendlyError(err));
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Layout className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Executive Snapshot Generator</h1>
          </div>
          <div className="text-xs text-slate-400 font-mono">
             v1.0.0
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
          
          {/* Left Column: Inputs */}
          <div className="lg:col-span-4 h-full overflow-y-auto pb-8 lg:pb-0">
             <InputForm 
                inputs={inputs} 
                setInputs={setInputs} 
                status={status} 
                onGenerate={handleGenerate} 
             />
             {errorMsg && (
               <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                 <div className="mt-0.5 min-w-[1rem] font-bold">!</div>
                 <div>
                   <strong>Error:</strong> {errorMsg}
                 </div>
               </div>
             )}
          </div>

          {/* Right Column: Display */}
          <div className="lg:col-span-8 h-full flex flex-col min-h-[500px]">
            <SnapshotDisplay 
              content={generatedContent} 
              status={status} 
              validationResult={validationResult}
              onValidate={handleValidate}
              onRefine={handleRefine}
              autoDownloadTrigger={autoDownloadTrigger}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;