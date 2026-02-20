export type UploadStatus = 'uploading' | 'completed' | 'error';

export interface UploadedFile {
  id: string; // Unique ID for each file
  name: string;
  mimeType: string;
  data: string; // Base64 string without the data URL prefix
  status: UploadStatus;
  progress: number; // 0-100
  type: 'analyst' | 'transcript';
  cancel?: () => void; // Function to cancel the upload
}

export interface SnapshotInputs {
  quarter: string;
  company: string;
  preparedDate: string;
  files: UploadedFile[]; // Analyst Reports
  transcriptFiles: UploadedFile[]; // Earnings Transcripts
  metricsContext?: string; // Quarterly Metrics (B31:K42)
  metricsFileName?: string;
  consensusContext?: string; // Consensus (Analyst) (B52:K54)
  consensusFileName?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  wordCount: number;
  feedback: string[];
}

export enum AppStatus {
  IDLE = 'IDLE',
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  REFINING = 'REFINING',
  ERROR = 'ERROR'
}