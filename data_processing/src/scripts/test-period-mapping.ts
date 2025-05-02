import fs from 'fs';
import path from 'path';
import { NormalizedPostcard } from '../types/normalized.types';
import { PeriodMappingService } from '../services/period-mapping.service';
import { ContentCategory, HistoricalPeriod } from '../types/period-mapping.types';

async function readAllNormalizedRecords(): Promise<NormalizedPostcard[]> {
  const normalizedDir = path.join(__dirname, '../../data/normalized');
  const files = fs.readdirSync(normalizedDir)
    .filter(file => file.startsWith('normalized_records_') && file.endsWith('.json'));

  const allRecords: NormalizedPostcard[] = [];

  for (const file of files) {
    const filePath = path.join(normalizedDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const records: NormalizedPostcard[] = JSON.parse(content);
    allRecords.push(...records);
  }

  return allRecords;
}

function generateStats(records: NormalizedPostcard[], mappingService: PeriodMappingService) {
  const stats = {
    total: records.length,
    byPeriod: {} as Record<HistoricalPeriod, number>,
    byCategory: {} as Record<ContentCategory, number>,
    confidenceLevels: {
      high: 0,
      medium: 0,
      low: 0
    },
    visualVerification: {
      total: 0,
      conflicts: 0
    }
  };

  Object.values(HistoricalPeriod).forEach(period => {
    stats.byPeriod[period] = 0;
  });
  Object.values(ContentCategory).forEach(category => {
    stats.byCategory[category] = 0;
  });

  records.forEach(record => {
    const periodMapping = mappingService.mapDateToPeriod(record.rawDate || '', record);
    const category = mappingService.categorizeContent(record);

    stats.byPeriod[periodMapping.mappedPeriod]++;

    stats.byCategory[category]++;

    stats.confidenceLevels[periodMapping.confidence]++;
    stats.confidenceLevels[periodMapping.confidence]++;

    if (periodMapping.visualVerification) {
      stats.visualVerification.total++;
      if (periodMapping.visualVerification.needsReview) {
        stats.visualVerification.conflicts++;
      }
    }
  });

  return stats;
}

async function main() {
  try {
    console.log('Reading normalized records...');
    const records = await readAllNormalizedRecords();
    console.log(`Found ${records.length} records`);

    const mappingService = new PeriodMappingService();

    console.log('\nGenerating period-mapped data...');
    const mappedData = mappingService.generatePeriodMappedData(records);

    console.log('\nGenerating statistics...');
    const stats = generateStats(records, mappingService);

    const outputDir = path.join(__dirname, '../../data/period-mapped');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(outputDir, 'period_mapped_data.json'),
      JSON.stringify(mappedData, null, 2)
    );

    fs.writeFileSync(
      path.join(outputDir, 'mapping_statistics.json'),
      JSON.stringify(stats, null, 2)
    );

    console.log('\nMapping Summary:');
    console.log(`Total records processed: ${stats.total}`);
    console.log('\nBy Period:');
    Object.entries(stats.byPeriod)
      .sort(([, a], [, b]) => b - a)
      .forEach(([period, count]) => {
        console.log(`${period}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
      });

    console.log('\nBy Category:');
    Object.entries(stats.byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`${category}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
      });

    console.log('\nConfidence Levels:');
    Object.entries(stats.confidenceLevels)
      .forEach(([level, count]) => {
        console.log(`${level}: ${count} (${((count / stats.total) * 100).toFixed(1)}%)`);
      });

    console.log('\nVisual Verification:');
    console.log(`Total with visual cues: ${stats.visualVerification.total}`);
    console.log(`Conflicts requiring review: ${stats.visualVerification.conflicts}`);

    console.log('\nResults have been saved to:');
    console.log('- data/period-mapped/period_mapped_data.json');
    console.log('- data/period-mapped/mapping_statistics.json');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
