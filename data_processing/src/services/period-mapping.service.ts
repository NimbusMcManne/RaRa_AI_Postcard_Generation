import { NormalizedPostcard } from '../types/normalized.types';
import {
  HistoricalPeriod,
  ContentCategory,
  PeriodMappedData,
  DateMapping,
  PeriodMetadata
} from '../types/period-mapping.types';

export class PeriodMappingService {
  private readonly periodMetadata: { [key in HistoricalPeriod]: PeriodMetadata } = {
    [HistoricalPeriod.EARLY_POSTCARDS]: {
      id: HistoricalPeriod.EARLY_POSTCARDS,
      name: {
        et: "Esimesed postkaardid",
        en: "Early Postcards"
      },
      yearRange: {
        start: 1894,
        end: 1905
      },
      description: {
        et: "Esimesed postkaardid Eestis, tsensuurieelne periood",
        en: "First postcards in Estonia, pre-censorship period"
      }
    },
    [HistoricalPeriod.CZARIST_ERA]: {
      id: HistoricalPeriod.CZARIST_ERA,
      name: {
        et: "Tsaariaeg",
        en: "Czarist Era"
      },
      yearRange: {
        start: 1906,
        end: 1917
      },
      description: {
        et: "Tsaari-Venemaa valitsemisaeg",
        en: "Rule of the Czarist Russia"
      }
    },
    [HistoricalPeriod.EARLY_INDEPENDENCE]: {
      id: HistoricalPeriod.EARLY_INDEPENDENCE,
      name: {
        et: "Varane iseseisvus",
        en: "Early Independence"
      },
      yearRange: {
        start: 1918,
        end: 1922
      },
      description: {
        et: "Eesti iseseisvuse esimesed aastad",
        en: "First years of Estonian independence"
      }
    },
    [HistoricalPeriod.FIRST_REPUBLIC_EARLY]: {
      id: HistoricalPeriod.FIRST_REPUBLIC_EARLY,
      name: {
        et: "Esimese vabariigi algusaeg",
        en: "Early First Republic"
      },
      yearRange: {
        start: 1923,
        end: 1929
      },
      description: {
        et: "Eesti Vabariigi esimese perioodi algusaastad",
        en: "Early years of the First Estonian Republic"
      }
    },
    [HistoricalPeriod.FIRST_REPUBLIC_LATE]: {
      id: HistoricalPeriod.FIRST_REPUBLIC_LATE,
      name: {
        et: "Esimese vabariigi lõpuaeg",
        en: "Late First Republic"
      },
      yearRange: {
        start: 1930,
        end: 1939
      },
      description: {
        et: "Eesti Vabariigi esimese perioodi lõpuaastad",
        en: "Final years of the First Estonian Republic"
      }
    },
    [HistoricalPeriod.WARTIME]: {
      id: HistoricalPeriod.WARTIME,
      name: {
        et: "Sõjaaeg",
        en: "Wartime"
      },
      yearRange: {
        start: 1940,
        end: 1945
      },
      description: {
        et: "Teine maailmasõda ja okupatsioonid",
        en: "World War II and occupations"
      }
    },
    [HistoricalPeriod.STALINIST_ERA]: {
      id: HistoricalPeriod.STALINIST_ERA,
      name: {
        et: "Stalinismi aeg",
        en: "Stalinist Era"
      },
      yearRange: {
        start: 1946,
        end: 1953
      },
      description: {
        et: "Stalinistlik periood Nõukogude okupatsioonis",
        en: "Stalinist period during Soviet occupation"
      }
    },
    [HistoricalPeriod.THAW_PERIOD]: {
      id: HistoricalPeriod.THAW_PERIOD,
      name: {
        et: "Sula periood",
        en: "Thaw Period"
      },
      yearRange: {
        start: 1954,
        end: 1964
      },
      description: {
        et: "Hruštšovi sula periood",
        en: "Khrushchev Thaw period"
      }
    },
    [HistoricalPeriod.STAGNATION_ERA]: {
      id: HistoricalPeriod.STAGNATION_ERA,
      name: {
        et: "Stagnatsiooni aeg",
        en: "Stagnation Era"
      },
      yearRange: {
        start: 1965,
        end: 1986
      },
      description: {
        et: "Nõukogude stagnatsiooni periood",
        en: "Soviet stagnation period"
      }
    },
    [HistoricalPeriod.RESTORATION]: {
      id: HistoricalPeriod.RESTORATION,
      name: {
        et: "Taasiseseisvumine",
        en: "Restoration of Independence"
      },
      yearRange: {
        start: 1987,
        end: 1991
      },
      description: {
        et: "Iseseisvuse taastamise periood",
        en: "Period of restoring independence"
      }
    },
    [HistoricalPeriod.EARLY_MODERN]: {
      id: HistoricalPeriod.EARLY_MODERN,
      name: {
        et: "Varane kaasaeg",
        en: "Early Modern Period"
      },
      yearRange: {
        start: 1992,
        end: 2002
      },
      description: {
        et: "Taasiseseisvunud Eesti esimene kümnend",
        en: "First decade of re-independent Estonia"
      }
    },
    [HistoricalPeriod.CONTEMPORARY]: {
      id: HistoricalPeriod.CONTEMPORARY,
      name: {
        et: "Kaasaeg",
        en: "Contemporary Period"
      },
      yearRange: {
        start: 2003,
        end: null
      },
      description: {
        et: "Kaasaegne periood",
        en: "Contemporary period"
      }
    }
  };

  private readonly periodSubjectPatterns = {
    et: {
      century: /(\d{2})\.\s*saj(?:and)?/i,
      centuryHalf: /(\d{2})\.\s*saj(?:andi)?\s*(1|2|esimene|teine)\.\s*pool/i,
      centuryPart: /(\d{2})\.\s*saj(?:andi)?\s*(algus|lõpp)/i,
      decade: /(\d{4})-ndad/i
    },
    en: {
      century: /(\d{2})(?:th|st|nd|rd)\s*century/i,
      centuryHalf: /(first|second|1st|2nd)\s*half\s*of\s*the\s*(\d{2})(?:th|st|nd|rd)\s*century/i,
      centuryPart: /(beginning|end)\s*of\s*the\s*(\d{2})(?:th|st|nd|rd)\s*century/i,
      decade: /(\d{4})s/i
    }
  };

  private readonly categoryKeywords = {
    festive: {
      titleKeywords: ['uusaastakaardid', 'jõulu', 'head uut aastat', 'pühi', 'новым'],
      subjectKeywords: {
        et: ['emadepäev', 'sünnipäev', 'uusaasta'],
        en: ['christmas', 'congratulation', 'education', 'fishermen', 'minister', 'greeting', "mother's day"]
      }
    },
    portrait: {
      subjectKeywords: {
        et: ['portree', 'kaevur', 'kalur', 'luuletaja', 'näitleja', 'poliitika', 'poliitikud', 'teadlased', 'töötajad', 'sportlased', 'vaimulikud', 'ministrid'],
        en: ['athletes', 'portrait', 'jubilee', 'miner', 'poet', 'politician', 'politic', 'society', 'student', 'writer']
      }
    },
    misc: {
      subjectKeywords: {
        et: ['sammas', 'masin', 'altar', 'haua', 'instituut', 'kabel', 'kalmistu', 'katakomb', 'lahing', 'klubi', 'laulupeod', 'muuseum', 'matused', 'meeleavaldus', 'monumendid', 'paraad', 'propaganda', 'protsessioon', 'raamat', 'lepingud', 'sõdurid', 'sündmused', 'tõllad', 'valimised'],
        en: ['setus', 'army', 'battle', 'combat', 'border', 'carriage', 'choir', 'song', 'clergy', 'clinic', 'coach', 'education', 'demonstration', 'election', 'frontier', 'funeral', 'home', 'museum', 'memorial', 'military', 'costumes', 'national', 'sepulchral', 'naval', 'industry', 'peace', 'police', 'procession', 'sanatorium', 'sauna', 'sewing', 'singing', 'song', 'swimming', 'tombstone', 'traditional']
      }
    },
    scenery: {
      subjectKeywords: {
        et: ['viru', 'vald', 'jõgi', 'järv', 'narva', 'viljandi', 'harju', 'haapsalu', 'hiiu', 'park', 'sild', 'otepää', 'poolsaar', 'saar', 'pärnu', 'tiik', 'pakri', 'tallinn', 'tartu', 'väljak', 'valga', 'klooster', 'kool', 'näitus', 'kuurort', 'maja', 'rand', 'kasiino', 'loss', 'kabel', 'kirik', 'kalmistu', 'kino', 'linn', 'torn', 'rannik', 'maa', 'mõis', 'vabrik', 'talu', 'kindlus', 'haigla', 'hotell', 'tehas', 'maastik', 'mõis', 'turg', 'veski', 'vald', 'sadam', 'raudtee', 'kuurort', 'vare', 'maaelu', 'meri', 'vaade', 'laev', 'pood', 'kallas', 'tänav', 'kindlus', 'maastik', 'teater', 'ülikool', 'haridus', 'tuulik', 'mõis', 'vald', 'kirik', 'loss', 'villa', 'virumaa', 'mägi', 'järv', 'joad', 'jõed', 'vabrik', 'ausammas', 'kaitseala', 'jõgi', 'teater', 'park', 'jaam', 'hotell', 'kool', 'muuseum', 'sild', 'hoone', 'saal', 'sadam', 'tänav', 'haigla', 'gümnaasium', 'kauplus', 'torn', 'kindlus', 'kohavaated', 'kuurordid', 'saal', 'kohvik', 'linn', 'vaated', 'mered', 'näitus', 'puiestee', 'raudtee', 'sadam', 'rannad', 'maja', 'tuletorn', 'tänav', 'veski'],
        en: ['county', 'river', 'parish', 'lake', 'park', 'bridge', 'peninsula', 'island', 'pond', 'grounds', 'bridge', 'square', 'abbey', 'convent', 'cloister', 'aerial', 'aerophotos', 'school', 'exhibition', 'resort', 'house', 'beach', 'casino', 'castle', 'chapel', 'church', 'cemeteries', 'cinema', 'city', 'tower', 'coast', 'country', 'estate', 'factory', 'farm', 'fort', 'hospital', 'hotel', 'plant', 'landscape', 'manor', 'market', 'mill', 'municipality', 'town', 'park', 'port', 'railway', 'resort', 'ruin', 'rural', 'sea', 'scenery', 'ship', 'shop', 'shore', 'street', 'stronghold', 'terrain', 'theater', 'university', 'education', 'windmill']
      }
    },
    photo: {
      subjectKeywords: {
        et: ['fotograafid', 'foto'],
        en: ['photographer', 'photograph', 'photo', 'snapshot']
      }
    }
  };

  private readonly excludeSubjects = {
    generic: ['fotod', 'postcards', 'photographs', 'photos', 'snapshots', 'kaardid', 'cards'],
    periods: [
      // Estonian patterns
      /\d{2}\.\s*saj(?:and)?/i,
      /\d{4}-ndad/i,
      /\d{3,4}s/i,
      /(?:esimene|teine)\s*pool/i,
      /algus|lõpp/i,
      // English patterns
      /\d{4}s/i,
      /(?:first|second)\s*half/i,
      /(?:beginning|end)\s*of/i,
      /century/i
    ]
  };

  /**
   * Maps a raw date string to a historical period with visual verification
   */
  mapDateToPeriod(rawDate: string, record?: NormalizedPostcard): DateMapping {
    const initialMapping = this._mapDateToPeriod(rawDate);

    if (record && (initialMapping.confidence === 'low' || !rawDate)) {
      const subjectInfo = this.extractPeriodFromSubjects(record);
      if (subjectInfo.estimatedYear) {
        const mapping: DateMapping = {
          rawDate: rawDate || '',
          mappedPeriod: this.findPeriodForYear(subjectInfo.estimatedYear),
          confidence: subjectInfo.confidence,
          reasoning: `Period estimated from subjects: ${subjectInfo.subjectsEt.concat(subjectInfo.subjectsEn).join(', ')}`
        };

        if (initialMapping.potentialPeriods) {
          mapping.potentialPeriods = initialMapping.potentialPeriods;
        }

        return mapping;
      }
    }

    return initialMapping;
  }

  /**
   * Determines the content category of a postcard
   */
  categorizeContent(record: NormalizedPostcard): ContentCategory {
    const subjects = [...record.subjectsEt, ...record.subjectsEn].map(s => s.toLowerCase());
    const title = record.title.toLowerCase();

    if (this.categoryKeywords.festive.titleKeywords.some(keyword => title.includes(keyword.toLowerCase()))) {
      return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_FESTIVE : ContentCategory.PHOTO_FESTIVE;
    }

    if (this.matchesKeywords(subjects, this.categoryKeywords.festive.subjectKeywords)) {
      return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_FESTIVE : ContentCategory.PHOTO_FESTIVE;
    }

    if (this.matchesKeywords(subjects, this.categoryKeywords.portrait.subjectKeywords) ||
        this.hasNameWithYears(subjects)) {
      return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_PORTRAIT : ContentCategory.PHOTO_PORTRAIT;
    }

    if (this.matchesKeywords(subjects, this.categoryKeywords.misc.subjectKeywords)) {
      return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_MISC : ContentCategory.PHOTO_MISC;
    }

    if (this.matchesKeywords(subjects, this.categoryKeywords.scenery.subjectKeywords)) {
      return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_SCENERY : ContentCategory.PHOTO_SCENERY;
    }

    return this.isDrawnCard(subjects) ? ContentCategory.DRAWN_MISC : ContentCategory.PHOTO_MISC;
  }

  private matchesKeywords(subjects: string[], keywordSets: { et: string[], en: string[] }): boolean {
    const allKeywords = [...keywordSets.et, ...keywordSets.en].map(k => k.toLowerCase());
    return subjects.some(subject =>
      allKeywords.some(keyword => subject.includes(keyword.toLowerCase()))
    );
  }

  private hasNameWithYears(subjects: string[]): boolean {
    const nameWithYearsPattern = /^[^,]+,\s*[^,]+,\s*\d{4}-\d{4}$/;
    return subjects.some(subject => nameWithYearsPattern.test(subject));
  }

  private isDrawnCard(subjects: string[]): boolean {
    return !this.matchesKeywords(subjects, this.categoryKeywords.photo.subjectKeywords);
  }

  /**
   * Generates period-mapped data from normalized records
   */
  generatePeriodMappedData(records: NormalizedPostcard[]): PeriodMappedData {
    const result: PeriodMappedData = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalRecords: records.length,
        periodsPresent: []
      },
      periods: this.initializePeriodsStructure(),
      index: {}
    };

    records.forEach(record => {
      const mapping = this.mapDateToPeriod(record.rawDate || '', record);
      const category = this.categorizeContent(record);

      const filteredSubjectsEt = this.filterSubjects(record.subjectsEt);
      const filteredSubjectsEn = this.filterSubjects(record.subjectsEn);

      result.index[record.imageUrls.full] = {
        period: mapping.mappedPeriod,
        category,
        imageUrl: record.imageUrls.full,
        location: record.location,
        subjects: {
          et: filteredSubjectsEt,
          en: filteredSubjectsEn
        }
      };

      if (!result.metadata.periodsPresent.includes(mapping.mappedPeriod)) {
        result.metadata.periodsPresent.push(mapping.mappedPeriod);
      }

      const periodData = result.periods[mapping.mappedPeriod];
      periodData.categories[category].records.push(record.imageUrls.full);
      periodData.categories[category].count++;
      periodData.statistics.totalCount++;
      periodData.statistics.categoryDistribution[category]++;

      this.analyzeVisualCharacteristics(record, mapping);
    });

    return result;
  }

  private isExactYear(date: string): boolean {
    return /^\d{4}$/.test(date);
  }

  private isBracketedYear(date: string): boolean {
    return /^\[\d{4}\]$/.test(date);
  }

  private isYearRange(date: string): boolean {
    return /^\d{4}-\d{4}$/.test(date);
  }

  private isYearRangeWithSlash(date: string): boolean {
    return /^\d{4}\/\d{4}$/.test(date);
  }

  private isUncertainYear(date: string): boolean {
    return /^\d{4}\?$/.test(date);
  }

  private isUncertainDecade(date: string): boolean {
    return /^\d{3}-\?$/.test(date);
  }

  private isBracketedUncertainDecade(date: string): boolean {
    return /^\[\d{3}-\?\]$/.test(date);
  }

  private isParenthesizedUncertainDecade(date: string): boolean {
    return /^\(\d{3}-\?\]$/.test(date);
  }

  // Private helper methods for mapping dates to periods
  private mapExactYear(date: string): DateMapping {
    const year = parseInt(date);
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(year),
      confidence: 'high',
      reasoning: 'Exact year provided'
    };
  }

  private mapBracketedYear(date: string): DateMapping {
    const year = parseInt(date.replace(/[\[\]]/g, ''));
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(year),
      confidence: 'medium',
      reasoning: 'Year in brackets, likely verified from context'
    };
  }

  private mapYearRange(date: string): DateMapping {
    const [startYear, endYear] = date.split('-').map(Number);
    const midYear = Math.floor((startYear + endYear) / 2);
    const potentialPeriods = this.findPeriodsInRange(startYear, endYear);

    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(midYear),
      potentialPeriods,
      confidence: potentialPeriods.length > 1 ? 'low' : 'medium',
      reasoning: `Date range ${startYear}-${endYear} spans ${potentialPeriods.length} periods`
    };
  }

  private findPeriodsInRange(startYear: number, endYear: number): HistoricalPeriod[] {
    const periods = new Set<HistoricalPeriod>();

    for (let year = startYear; year <= endYear; year++) {
      periods.add(this.findPeriodForYear(year));
    }

    return Array.from(periods);
  }

  private mapYearRangeWithSlash(date: string): DateMapping {
    const [startYear, endYear] = date.split('/').map(Number);
    const midYear = Math.floor((startYear + endYear) / 2);
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(midYear),
      confidence: 'medium',
      reasoning: `Using middle year (${midYear}) of range ${startYear}/${endYear}`
    };
  }

  private mapUncertainYear(date: string): DateMapping {
    const year = parseInt(date.replace('?', ''));
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(year),
      confidence: 'low',
      reasoning: 'Uncertain year'
    };
  }

  private mapUncertainDecade(date: string): DateMapping {
    const decadeStart = parseInt(date.slice(0, 3) + '0');
    const midDecadeYear = decadeStart + 5;
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(midDecadeYear),
      confidence: 'low',
      reasoning: `Using middle year (${midDecadeYear}) of uncertain decade ${decadeStart}s`
    };
  }

  private mapBracketedUncertainDecade(date: string): DateMapping {
    const decadeStart = parseInt(date.replace(/[\[\]?-]/g, '').slice(0, 3) + '0');
    const midDecadeYear = decadeStart + 5;
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(midDecadeYear),
      confidence: 'low',
      reasoning: `Using middle year (${midDecadeYear}) of bracketed uncertain decade ${decadeStart}s`
    };
  }

  private mapParenthesizedUncertainDecade(date: string): DateMapping {
    const decadeStart = parseInt(date.replace(/[\(\]\?-]/g, '').slice(0, 3) + '0');
    const midDecadeYear = decadeStart + 5;
    return {
      rawDate: date,
      mappedPeriod: this.findPeriodForYear(midDecadeYear),
      confidence: 'low',
      reasoning: `Using middle year (${midDecadeYear}) of parenthesized uncertain decade ${decadeStart}s`
    };
  }

  private findPeriodForYear(year: number): HistoricalPeriod {
    for (const period of Object.values(HistoricalPeriod)) {
      const metadata = this.periodMetadata[period];
      if (year >= metadata.yearRange.start &&
          (metadata.yearRange.end === null || year <= metadata.yearRange.end)) {
        return period;
      }
    }
    return HistoricalPeriod.CONTEMPORARY;
  }

  private initializePeriodsStructure(): PeriodMappedData['periods'] {
    const periods: PeriodMappedData['periods'] = {} as PeriodMappedData['periods'];

    for (const period of Object.values(HistoricalPeriod)) {
      periods[period] = {
        metadata: this.periodMetadata[period],
        categories: this.initializeCategories(),
        statistics: {
          totalCount: 0,
          categoryDistribution: this.initializeCategoryDistribution()
        }
      };
    }

    return periods;
  }

  private initializeCategories(): { [key in ContentCategory]: { records: string[]; count: number } } {
    const categories: any = {};
    for (const category of Object.values(ContentCategory)) {
      categories[category] = {
        records: [],
        count: 0
      };
    }
    return categories;
  }

  private initializeCategoryDistribution(): { [key in ContentCategory]: number } {
    const distribution: any = {};
    for (const category of Object.values(ContentCategory)) {
      distribution[category] = 0;
    }
    return distribution;
  }

  /**
   * Extract period information from subjects
   */
  private extractPeriodFromSubjects(record: NormalizedPostcard): {
    subjectsEt: string[];
    subjectsEn: string[];
    estimatedYear?: number;
    confidence: 'high' | 'medium' | 'low';
  } {
    const periodSubjectsEt: string[] = [];
    const periodSubjectsEn: string[] = [];
    let estimatedYear: number | undefined;
    let confidence: 'high' | 'medium' | 'low' = 'low';

    record.subjectsEt.forEach(subject => {
      if (this.isPeriodSubject(subject, 'et')) {
        periodSubjectsEt.push(subject);
        const year = this.extractYearFromSubject(subject, 'et');
        if (year) {
          estimatedYear = year;
          confidence = 'medium';
        }
      }
    });

    record.subjectsEn.forEach(subject => {
      if (this.isPeriodSubject(subject, 'en')) {
        periodSubjectsEn.push(subject);
        const year = this.extractYearFromSubject(subject, 'en');
        if (year) {
          if (estimatedYear && Math.abs(estimatedYear - year) < 10) {
            confidence = 'high';
          } else if (!estimatedYear) {
            estimatedYear = year;
            confidence = 'medium';
          }
        }
      }
    });

    return {
      subjectsEt: periodSubjectsEt,
      subjectsEn: periodSubjectsEn,
      estimatedYear,
      confidence
    };
  }

  /**
   * Check if a subject contains period information
   */
  private isPeriodSubject(subject: string, language: 'et' | 'en'): boolean {
    const patterns = this.periodSubjectPatterns[language];
    return Object.values(patterns).some(pattern => pattern.test(subject));
  }

  /**
   * Extract year from a period subject
   */
  private extractYearFromSubject(subject: string, language: 'et' | 'en'): number | undefined {
    const patterns = this.periodSubjectPatterns[language];
    let year: number | undefined;

    const centuryMatch = subject.match(patterns.century);
    if (centuryMatch) {
      const century = parseInt(centuryMatch[1]);
      year = (century - 1) * 100 + 50;
      return year;
    }

    const halfMatch = subject.match(patterns.centuryHalf);
    if (halfMatch) {
      const century = language === 'et' ? parseInt(halfMatch[1]) : parseInt(halfMatch[2]);
      const half = language === 'et' ? halfMatch[2] : halfMatch[1];
      const isFirstHalf = ['1', 'first', 'esimene'].includes(half.toLowerCase());
      year = (century - 1) * 100 + (isFirstHalf ? 25 : 75);
      return year;
    }

    const partMatch = subject.match(patterns.centuryPart);
    if (partMatch) {
      const century = language === 'et' ? parseInt(partMatch[1]) : parseInt(partMatch[2]);
      const part = language === 'et' ? partMatch[2] : partMatch[1];
      const isBeginning = ['beginning', 'algus'].includes(part.toLowerCase());
      year = (century - 1) * 100 + (isBeginning ? 10 : 90);
      return year;
    }

    const decadeMatch = subject.match(patterns.decade);
    if (decadeMatch) {
      const decade = parseInt(decadeMatch[1]);
      year = decade + 5;
      return year;
    }

    return undefined;
  }

  /**
   * Internal method for raw date mapping
   */
  private _mapDateToPeriod(rawDate: string): DateMapping {
    if (!rawDate || typeof rawDate !== 'string') {
      return {
        rawDate: rawDate || '',
        mappedPeriod: HistoricalPeriod.CONTEMPORARY,
        confidence: 'low',
        reasoning: 'Invalid or empty date'
      };
    }

    const cleanDate = rawDate.trim();

    if (this.isExactYear(cleanDate)) {
      return this.mapExactYear(cleanDate);
    }

    if (this.isBracketedYear(cleanDate)) {
      return this.mapBracketedYear(cleanDate);
    }

    if (this.isYearRange(cleanDate)) {
      return this.mapYearRange(cleanDate);
    }

    if (this.isYearRangeWithSlash(cleanDate)) {
      return this.mapYearRangeWithSlash(cleanDate);
    }

    if (this.isUncertainYear(cleanDate)) {
      return this.mapUncertainYear(cleanDate);
    }

    if (this.isUncertainDecade(cleanDate)) {
      return this.mapUncertainDecade(cleanDate);
    }

    if (this.isBracketedUncertainDecade(cleanDate)) {
      return this.mapBracketedUncertainDecade(cleanDate);
    }

    if (this.isParenthesizedUncertainDecade(cleanDate)) {
      return this.mapParenthesizedUncertainDecade(cleanDate);
    }

    return {
      rawDate: cleanDate,
      mappedPeriod: this.findPeriodForYear(new Date().getFullYear()),
      confidence: 'low',
      reasoning: 'Unrecognized date format'
    };
  }

  /**
   * Analyze visual characteristics to verify period mapping
   */
  private analyzeVisualCharacteristics(record: NormalizedPostcard, mapping: DateMapping): void {
    const characteristics: string[] = [];
    let suggestedPeriod: HistoricalPeriod | undefined;
    let visualConfidence: 'high' | 'medium' | 'low' = 'low';

    const allText = [...record.subjectsEt, ...record.subjectsEn, record.title].map(t => t.toLowerCase());

    if (allText.some(t => t.includes('sõja') || t.includes('war'))) {
      characteristics.push('War-related imagery');
      if (mapping.potentialPeriods?.includes(HistoricalPeriod.WARTIME)) {
        suggestedPeriod = HistoricalPeriod.WARTIME;
        visualConfidence = 'medium';
      }
    }

    if (allText.some(t => t.includes('nõukogude') || t.includes('soviet'))) {
      characteristics.push('Soviet-era imagery');
      if (mapping.potentialPeriods?.includes(HistoricalPeriod.STALINIST_ERA) ||
          mapping.potentialPeriods?.includes(HistoricalPeriod.THAW_PERIOD) ||
          mapping.potentialPeriods?.includes(HistoricalPeriod.STAGNATION_ERA)) {
        suggestedPeriod = this.findMostLikelySovietPeriod(allText);
        visualConfidence = 'medium';
      }
    }

    if (characteristics.length > 0) {
      mapping.visualVerification = {
        suggestedPeriod,
        confidence: visualConfidence,
        characteristics,
        needsReview: suggestedPeriod !== undefined && suggestedPeriod !== mapping.mappedPeriod
      };
    }
  }

  private findMostLikelySovietPeriod(textHints: string[]): HistoricalPeriod {
    if (textHints.some(t => t.includes('stalin') || t.includes('stalinism'))) {
      return HistoricalPeriod.STALINIST_ERA;
    }
    if (textHints.some(t => t.includes('hruštšov') || t.includes('khrushchev') || t.includes('sula') || t.includes('thaw'))) {
      return HistoricalPeriod.THAW_PERIOD;
    }
    return HistoricalPeriod.STAGNATION_ERA;
  }

  /**
   * Temporary function to analyze all unique subjects across records
   * Returns two arrays of unique subjects (Estonian and English)
   */
  public analyzeAllSubjects(records: NormalizedPostcard[]): {
    subjectsEt: string[],
    subjectsEn: string[]
  } {
    const excludeTermsEt = [
      'postkaardid',
      'Eesti',
      '20. saj.',
      'saj.',
      'algus',
      'lõpp',
      'pool',
      'esimene pool',
      'teine pool',
      'ndad'
    ];

    const excludeTermsEn = [
      'postcards',
      'Estonia',
      'century',
      'beginning of the',
      'end of the',
      'first half of the',
      'second half of the',
      'half of the'
    ];

    const uniqueEt = new Set<string>();
    const uniqueEn = new Set<string>();

    records.forEach(record => {
      record.subjectsEt?.forEach(subject => {
        if (!excludeTermsEt.some(term => subject.toLowerCase().includes(term.toLowerCase()))) {
          uniqueEt.add(subject.trim());
        }
      });

      record.subjectsEn?.forEach(subject => {
        if (!excludeTermsEn.some(term => subject.toLowerCase().includes(term.toLowerCase()))) {
          uniqueEn.add(subject.trim());
        }
      });
    });

    return {
      subjectsEt: Array.from(uniqueEt).sort(),
      subjectsEn: Array.from(uniqueEn).sort()
    };
  }

  private filterSubjects(subjects: string[]): string[] {
    return subjects.filter(subject => {
      const lowerSubject = subject.toLowerCase();

      if (this.excludeSubjects.generic.some(term => lowerSubject.includes(term.toLowerCase()))) {
        return false;
      }

      if (this.excludeSubjects.periods.some(pattern => pattern.test(subject))) {
        return false;
      }

      return true;
    });
  }
}
