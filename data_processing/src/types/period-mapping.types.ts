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

export interface VisualCharacteristics {
  colorAnalysis?: {
    dominantColors?: string[]; 
    colorScheme?: 'monochrome' | 'sepia' | 'color';
    contrast?: number;             
    brightness?: number;          
    saturation?: number;         
    colorPalette?: {
      primary: string[];
      secondary: string[];
      accent?: string[];
    };
  };

  compositionAnalysis?: {
    layout?: 'centered' | 'rule-of-thirds' | 'symmetric' | 'other';
    mainSubjectLocation?: { x: number; y: number };
    complexityScore?: number;   
    depthOfField?: 'shallow' | 'medium' | 'deep';
    perspective?: 'frontal' | 'angular' | 'aerial' | 'other';
    focusPoints?: Array<{ x: number; y: number }>;
  };

  technicalCharacteristics?: {
    grainPattern?: string;
    printTechnique?: string;
    textureType?: string;
    quality?: number;            
    degradation?: {
      type?: string[];         
      severity?: number;       
    };
    edges?: {
      condition?: 'sharp' | 'worn' | 'damaged';
      style?: 'straight' | 'decorative' | 'scalloped';
    };
  };

  styleMetrics?: {
    vintage?: number;         
    clarity?: number;    
    artifactPresence?: number; 
    styleConfidence?: number;  
  };

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

export interface DateMapping {
  rawDate: string;
  mappedPeriod: HistoricalPeriod;
  potentialPeriods?: HistoricalPeriod[]; 
  confidence: 'high' | 'medium' | 'low';
  reasoning?: string;
  visualVerification?: {
    suggestedPeriod?: HistoricalPeriod;
    confidence: 'high' | 'medium' | 'low';
    characteristics: string[]; 
    needsReview: boolean;   
  };
}

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
          records: string[]; 
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
              [key: string]: number; 
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
