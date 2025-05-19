// Normalized data types
export interface NormalizedPostcard {
  // Core identification
  identifier: string;
  title: string;
  creator?: string;
  publisher?: string;

  // External references
  esterUrl?: string;  
  imageUrls: {
    full: string;     
    resource: string; 
  };
  location?: string; 

  // Subjects and categorization
  subjectsEt: string[];  
  subjectsEn: string[]; 

  // Temporal information
  rawDate?: string;    

  // Source information
  language: string;
  dataProvider: string;
  provider: string;
  rights?: string;

  // Validation/Debug info
  validationWarnings?: string[];  
}

export interface NormalizedHarvestResult {
  harvestedAt: string;
  totalRecords: number;
  records: NormalizedPostcard[];
  validationSummary?: {
    warnings: number;
    invalidRecords: number;
  };
}

export interface ProcessedDate {
  start: number;
  end: number;
  certainty: 'exact' | 'approximate' | 'unknown';
  period?: string;
  originalFormat: string;
}
