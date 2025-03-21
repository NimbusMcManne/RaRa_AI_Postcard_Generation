import { OaiPmhService } from '../services/oai-pmh.service';
import { StorageService } from '../services/storage.service';
import { TransformerService } from '../services/transformer.service';
import { PeriodMappingService } from '../services/period-mapping.service';
import * as path from 'path';

async function main() {
  try {
    console.log('Initializing services...');
    const oaiPmh = new OaiPmhService();
    const storage = new StorageService();
    const transformer = new TransformerService();
    const periodMapper = new PeriodMappingService();

    console.log('Cleaning up old data...');
    await storage.cleanupOldData();

    console.log('Fetching records from OAI-PMH endpoint...');
    const records = await oaiPmh.harvest();
    console.log(`Fetched ${records.length} records. Saving raw data...`);
    await storage.saveRawHarvest(records);

    console.log('Transforming records...');
    const transformedRecords = await transformer.transformRecords(records);

    console.log('Saving normalized data...');
    await storage.saveNormalizedRecords(transformedRecords);

    console.log('Generating period-mapped data...');
    const periodMappedData = periodMapper.generatePeriodMappedData(transformedRecords);

    const periodMappedDir = path.join(process.cwd(), 'data', 'period-mapped');
    await storage.ensureDirectory(periodMappedDir);

    await storage.saveJson(
      path.join(periodMappedDir, 'period_mapped_data.json'),
      periodMappedData
    );

    console.log('Done! Data has been saved to:');
    console.log('- data/raw/: Raw harvested data');
    console.log('- data/normalized/: Normalized postcard records');
    console.log('- data/period-mapped/: Period-mapped data and statistics');

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
