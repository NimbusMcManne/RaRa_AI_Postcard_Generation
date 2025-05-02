import * as fs from 'fs/promises';
import * as path from 'path';

interface StorageOptions {
  backupExisting?: boolean;
  storagePath?: string;
}

export class StorageService {
  private readonly baseDir: string;
  private readonly defaultOptions: Required<StorageOptions> = {
    backupExisting: true,
    storagePath: path.join(process.cwd(), 'data')
  };

  constructor(options: StorageOptions = {}) {
    const mergedOptions = { ...this.defaultOptions, ...options };
    this.baseDir = mergedOptions.storagePath;
  }

  /**
   * Ensure a directory exists, create if it doesn't
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
      throw error;
    }
  }

  /**
   * Save JSON data to a file
   */
  async saveJson(filePath: string, data: any): Promise<void> {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save JSON data:', error);
      throw error;
    }
  }

  /**
   * Clean up old data before a new harvest
   */
  async cleanupOldData(): Promise<void> {
    try {
      await fs.rm(this.baseDir, { recursive: true, force: true });
      await fs.mkdir(this.baseDir, { recursive: true });
    } catch (error) {
      console.error('Failed to clean up old data:', error);
      throw error;
    }
  }

  /**
   * Save raw harvest data in chunks
   */
  async saveRawHarvest(records: any[]): Promise<void> {
    const CHUNK_SIZE = 100;
    const chunks = [];

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      chunks.push(records.slice(i, i + CHUNK_SIZE));
    }

    await fs.mkdir(path.join(this.baseDir, 'raw'), { recursive: true });

    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(this.baseDir, 'raw', `raw_harvest_${i + 1}.json`);
      await fs.writeFile(chunkPath, JSON.stringify(chunks[i], null, 2));
    }

    const metadata = {
      totalRecords: records.length,
      numberOfChunks: chunks.length,
      chunkSize: CHUNK_SIZE,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.baseDir, 'raw', 'harvest_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * Save normalized records with metadata
   */
  async saveNormalizedRecords(records: any[]): Promise<void> {
    const CHUNK_SIZE = 100;
    const chunks = [];

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      chunks.push(records.slice(i, i + CHUNK_SIZE));
    }

    await fs.mkdir(path.join(this.baseDir, 'normalized'), { recursive: true });

    for (let i = 0; i < chunks.length; i++) {
      const chunkPath = path.join(this.baseDir, 'normalized', `normalized_records_${i + 1}.json`);
      await fs.writeFile(chunkPath, JSON.stringify(chunks[i], null, 2));
    }

    const metadata = {
      totalRecords: records.length,
      numberOfChunks: chunks.length,
      chunkSize: CHUNK_SIZE,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(this.baseDir, 'normalized', 'normalized_metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }
}
