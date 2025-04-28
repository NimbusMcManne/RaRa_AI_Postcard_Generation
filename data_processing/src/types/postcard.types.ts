export interface PostcardMetadata {
  identifier: string;
  title: string;
  creator?: string;
  date?: string;
  normalizedDate?: {
    start: number;
    end: number;
    period?: string;
  };
  type: string[];
  description?: string[];
  subjects?: string[];
  imageUrl?: string;
  source: string;
  language: string;
  provider: string;
}

export interface HarvestResult {
  harvestedAt: string;
  totalRecords: number;
  records: PostcardMetadata[];
}

export interface StorageOptions {
  batchSize?: number;
  storagePath?: string;
  backupExisting?: boolean;
}
