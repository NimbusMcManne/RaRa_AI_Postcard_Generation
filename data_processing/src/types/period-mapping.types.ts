// Period enumeration
export enum HistoricalPeriod {
  EARLY_POSTCARDS = "1894_1905",
  CZARIST_ERA = "1906_1917",
  EARLY_INDEPENDENCE = "1918_1922",
  FIRST_REPUBLIC_EARLY = "1923_1929",
  FIRST_REPUBLIC_LATE = "1930_1939",
  WARTIME = "1940_1945",
  STALINIST_ERA = "1946_1953",
  THAW_PERIOD = "1954_1964",
  STAGNATION_ERA = "1965_1986",
  RESTORATION = "1987_1991",
  EARLY_MODERN = "1992_2002",
  CONTEMPORARY = "2003_present"
}

// Content category enumeration
export enum ContentCategory {
  DRAWN_SCENERY = "drawn_scenery",
  PHOTO_SCENERY = "photo_scenery",
  DRAWN_FESTIVE = "drawn_festive",
  PHOTO_FESTIVE = "photo_festive",
  DRAWN_PORTRAIT = "drawn_portrait",
  PHOTO_PORTRAIT = "photo_portrait",
  DRAWN_MISC = "drawn_misc",
  PHOTO_MISC = "photo_misc"
}

// Visual characteristics interface
export interface VisualCharacteristics {
  // Color-related characteristics
  colorAnalysis?: {
    dominantColors?: string[];      // RGB values
    colorScheme?: 'monochrome' | 'sepia' | 'color';
    contrast?: number;              // 0-1 scale
    brightness?: number;            // 0-1 scale
    saturation?: number;           // 0-1 scale
    colorPalette?: {
      primary: string[];
      secondary: string[];
      accent?: string[];
    };
  };

  // Composition analysis
  compositionAnalysis?: {
    layout?: 'centered' | 'rule-of-thirds' | 'symmetric' | 'other';
    mainSubjectLocation?: { x: number; y: number };
    complexityScore?: number;      // 0-1 scale
    depthOfField?: 'shallow' | 'medium' | 'deep';
    perspective?: 'frontal' | 'angular' | 'aerial' | 'other';
    focusPoints?: Array<{ x: number; y: number }>;
  };

  // Technical characteristics
  technicalCharacteristics?: {
    grainPattern?: string;
    printTechnique?: string;
    textureType?: string;
    quality?: number;              // 0-1 scale
    degradation?: {
      type?: string[];            // e.g., ['fading', 'scratches', 'yellowing']
      severity?: number;          // 0-1 scale
    };
    edges?: {
      condition?: 'sharp' | 'worn' | 'damaged';
      style?: 'straight' | 'decorative' | 'scalloped';
    };
  };

  // Style metrics
  styleMetrics?: {
    vintage?: number;             // 0-1 score
    clarity?: number;             // 0-1 score
    artifactPresence?: number;    // 0-1 score
    styleConfidence?: number;     // How confident the AI is about the style classification
  };

  // Additional artistic elements
  artisticElements?: {
    borderType?: string;
    textElements?: {
      present: boolean;
      location?: 'top' | 'bottom' | 'integrated';
      style?: string;
    };
    decorativeElements?: string[];
  };
}

// Period metadata interface
export interface PeriodMetadata {
  id: HistoricalPeriod;
  name: {
    et: string;
    en: string;
  };
  yearRange: {
    start: number;
    end: number | null;
  };
  description: {
    et: string;
    en: string;
  };
}

// Date mapping interface
export interface DateMapping {
  rawDate: string;
  mappedPeriod: HistoricalPeriod;
  potentialPeriods?: HistoricalPeriod[];  // For dates spanning multiple periods
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
  visualVerification?: {
    suggestedPeriod?: HistoricalPeriod;
    confidence: 'high' | 'medium' | 'low';
    characteristics: string[];  // Visual cues that suggest this period
    needsReview: boolean;      // Flag for cases where date and visual evidence conflict
  };
}

// Main period-mapped data interface
export interface PeriodMappedData {
  metadata: {
    lastUpdated: string;
    totalRecords: number;
    periodsPresent: HistoricalPeriod[];
  };

  periods: {
    [key in HistoricalPeriod]: {
      metadata: PeriodMetadata;
      categories: {
        [key in ContentCategory]: {
          records: string[];  // Array of postcard identifiers
          count: number;
          visualCharacteristics?: {
            common: {
              colorAnalysis?: VisualCharacteristics['colorAnalysis'];
              compositionAnalysis?: VisualCharacteristics['compositionAnalysis'];
              technicalCharacteristics?: VisualCharacteristics['technicalCharacteristics'];
              styleMetrics?: VisualCharacteristics['styleMetrics'];
              artisticElements?: VisualCharacteristics['artisticElements'];
            };
            variations: {
              [key: string]: number;  // frequency of different characteristics
            };
          };
        };
      };
      statistics: {
        totalCount: number;
        categoryDistribution: {
          [key in ContentCategory]: number;
        };
      };
    };
  };

  // Quick lookup index
  index: {
    [postcardId: string]: {
      period: HistoricalPeriod;
      category: ContentCategory;
      imageUrl: string;
      location?: string;
      subjects: {
        et: string[];
        en: string[];
      };
      visualCharacteristics?: VisualCharacteristics;
    };
  };
}
