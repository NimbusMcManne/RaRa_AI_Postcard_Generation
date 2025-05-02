import { StorageService } from './storage.service';
import OaiPmhService from './oai-pmh.service';
import { TransformerService } from './transformer.service';
import { OaiPmhRecord } from '../types/oai-pmh.types';
import { NormalizedPostcard } from '../types/normalized.types';

export class HarvesterService {
  private readonly transformer: TransformerService;

  constructor(
    private readonly storage: StorageService,
    private readonly oaiPmh: typeof OaiPmhService
  ) {
    this.transformer = new TransformerService();
  }

  /**
   * Main harvesting process
   */
  async harvestData(options: {
    batchSize?: number;
    saveRawData?: boolean;
  } = {}): Promise<void> {
    const {
      batchSize = 100,
      saveRawData = true
    } = options;

    try {
      // Phase 1: Fetch and store raw data
      console.log('Starting data harvest...');
      const records = await this.oaiPmh.harvest({ batchSize });

      if (saveRawData) {
        await this.storage.saveRawHarvest(records);
      }

      // Phase 2: Transform and store normalized data
      const normalizedRecords = await this.transformAndSave(records);

      console.log(`Harvest completed. Processed ${normalizedRecords.length} records.`);
    } catch (error) {
      console.error('Harvest failed:', error);
      throw error;
    }
  }

  /**
   * Transform raw records to normalized format and save
   */
  private async transformAndSave(records: OaiPmhRecord[]): Promise<NormalizedPostcard[]> {
    const normalizedRecords: NormalizedPostcard[] = [];
    const warnings: string[] = [];
    let invalidCount = 0;

    for (const record of records) {
      try {
        const recordHeader = record.header[0];
        if (!recordHeader || !recordHeader.identifier || !recordHeader.identifier[0]) {
          throw new Error('Invalid record header structure');
        }

        const context = {
          warnings,
          identifier: recordHeader.identifier[0]
        };

        const normalized = this.transformer.transformRecord(record, context);
        normalizedRecords.push(normalized);
      } catch (error) {
        invalidCount++;
        const recordId = record.header[0]?.identifier?.[0] || 'unknown';
        warnings.push(`Failed to transform record ${recordId}: ${error}`);
      }
    }

    if (warnings.length > 0) {
      console.log('\nTransformation warnings:');
      warnings.forEach(warning => console.log(`- ${warning}`));
    }

    console.log(`\nTransformation summary:`);
    console.log(`- Input records: ${records.length}`);
    console.log(`- Successfully transformed: ${normalizedRecords.length}`);
    console.log(`- Warnings: ${warnings.length}`);

    await this.storage.saveNormalizedRecords(normalizedRecords);
    return normalizedRecords;
  }
}
