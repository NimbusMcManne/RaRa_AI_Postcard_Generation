import { OaiPmhRecord } from '../types/oai-pmh.types';
import { NormalizedPostcard } from '../types/normalized.types';

interface ValidationContext {
  warnings: string[];
  identifier: string;
}

export class TransformerService {

  transformRecord(record: OaiPmhRecord, context: ValidationContext): NormalizedPostcard {
    const providedCHO = record.metadata[0]['rdf:RDF'][0]['edm:ProvidedCHO'][0];
    const aggregation = record.metadata[0]['rdf:RDF'][0]['ore:Aggregation'][0];

    const title = providedCHO['dc:title']?.[0]?.['#'];
    if (!title) {
      context.warnings.push(`${context.identifier}: Missing title`);
    }

    const subjects = providedCHO['dc:subject'] || [];
    const { estonianSubjects, englishSubjects } = this.separateSubjectsByLanguage(subjects);

    const esterUrl = this.findEsterUrl(providedCHO['dc:identifier'] || []);

    const imageUrls = this.extractImageUrls(aggregation);

    const language = providedCHO['dc:language']?.[0]?.['#'];
    const validLanguages = ['et', 'ru', 'de', 'en'];
    if (!validLanguages.includes(language)) {
      context.warnings.push(`${context.identifier}: Unexpected language: ${language}`);
    }

    const normalized: NormalizedPostcard = {
      identifier: context.identifier,
      title: title || '[No Title]',
      creator: providedCHO['dc:creator']?.[0]?.['#'],
      publisher: providedCHO['dc:publisher']?.[0]?.['#'],

      esterUrl,
      imageUrls,
      location: providedCHO['edm:currentLocation']?.[0]?.['@_']?.['rdf:resource']?.value,

      subjectsEt: estonianSubjects,
      subjectsEn: englishSubjects,

      rawDate: providedCHO['dc:date']?.[0]?.['#'],

      language: language || 'et',
      dataProvider: aggregation['edm:dataProvider'][0]['#'],
      provider: aggregation['edm:provider'][0]['#'],
      rights: aggregation['edm:rights']?.[0]?.['@_']?.['rdf:resource']?.value
    };

    this.validateNormalizedRecord(normalized, context);
    return normalized;
  }

  private separateSubjectsByLanguage(subjects: Array<{ '#': string; '@_': { 'xml:lang': { value: string } } }>) {
    const estonianSubjects: string[] = [];
    const englishSubjects: string[] = [];

    subjects.forEach(subject => {
      const text = subject['#'];
      const lang = subject['@_']?.['xml:lang']?.value;
      if (lang === 'et') {
        estonianSubjects.push(text);
      } else if (lang === 'en') {
        englishSubjects.push(text);
      }
    });

    return { estonianSubjects, englishSubjects };
  }

  private findEsterUrl(identifiers: Array<{ '#': string; '@_': { 'xsi:type': { value: string } } }>): string | undefined {
    return identifiers.find(id =>
      id['#'].includes('ester.ee')
    )?.['#'];
  }

  private extractImageUrls(aggregation: OaiPmhRecord['metadata'][0]['rdf:RDF'][0]['ore:Aggregation'][0]): {
    full: string;
    resource: string;
  } {
    const full = aggregation['edm:isShownAt'][0]['@_']['rdf:resource'].value;
    const resource = aggregation['edm:aggregatedCHO'][0]['@_']['rdf:resource'].value;

    if (!full || !resource) {
      throw new Error('Missing required image URLs');
    }

    return { full, resource };
  }

  private validateNormalizedRecord(record: NormalizedPostcard, context: ValidationContext): void {
    if (!record.imageUrls.full || !record.imageUrls.resource) {
      context.warnings.push(`${context.identifier}: Missing required image URLs`);
    }

    if (!record.dataProvider || !record.provider) {
      context.warnings.push(`${context.identifier}: Missing provider information`);
    }

    if (record.subjectsEt.length === 0 && record.subjectsEn.length === 0) {
      context.warnings.push(`${context.identifier}: No subjects found in any language`);
    }
  }

  async transformRecords(records: any[]): Promise<any[]> {
    const transformedRecords = [];
    const warnings = [];

    for (const record of records) {
      try {
        const recordIdentifier = record.header?.[0]?.identifier?.[0];
        if (!recordIdentifier) {
          const errorMsg = 'Record is missing required identifier';
          console.error(errorMsg, record);
          warnings.push(errorMsg);
          continue;
        }

        const context = {
          warnings,
          identifier: recordIdentifier
        };

        const normalized = this.transformRecord(record, context);
        transformedRecords.push(normalized);
      } catch (error) {
        const recordId = record.header?.[0]?.identifier?.[0] || 'unknown record';
        const errorMsg = `Transform error for ${recordId}: ${error}`;
        console.error(errorMsg);
        warnings.push(errorMsg);
      }
    }

    if (warnings.length > 0) {
      console.log('\nTransformation warnings:');
      warnings.forEach(warning => console.log(`- ${warning}`));
    }

    console.log(`\nTransformation summary:`);
    console.log(`- Input records: ${records.length}`);
    console.log(`- Successfully transformed: ${transformedRecords.length}`);
    console.log(`- Warnings: ${warnings.length}`);

    return transformedRecords;
  }
}
