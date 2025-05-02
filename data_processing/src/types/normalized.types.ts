// Normalized data types
export interface NormalizedPostcard {
  // Core identification
  identifier: string;
  title: string;
  creator?: string;
  publisher?: string;

  // External references
  esterUrl?: string;  // The non-digar.ee URL
  imageUrls: {
    full: string;     // edm:isShownAt
    resource: string; // edm:aggregatedCHO
  };
  location?: string;  // edm:currentLocation

  // Subjects and categorization
  subjectsEt: string[];  // Estonian subjects
  subjectsEn: string[];  // English subjects

  // Temporal information
  rawDate?: string;      // Original date string, for reference

  // Source information
  language: string;
  dataProvider: string;
  provider: string;
  rights?: string;

  // Validation/Debug info
  validationWarnings?: string[];  // Any validation issues encountered
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

// Will be used later for period mapping
export interface ProcessedDate {
  start: number;
  end: number;
  certainty: 'exact' | 'approximate' | 'unknown';
  period?: string;
  originalFormat: string;
}
