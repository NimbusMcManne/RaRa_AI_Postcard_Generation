export interface NormalizedPostcard {
  identifier: string;
  title: string;
  creator?: string;
  publisher?: string;

  esterUrl?: string; 
  imageUrls: {
    full: string;    
    resource: string;
  };
  location?: string; 

  subjectsEt: string[]; 
  subjectsEn: string[]; 


  rawDate?: string; 

  language: string;
  dataProvider: string;
  provider: string;
  rights?: string;

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
