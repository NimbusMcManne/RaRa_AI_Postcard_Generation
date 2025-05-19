import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';

interface RawCategoryData {
  records: string[];
  count: number;
}

interface PeriodMetadata {
    id: string;
    name: { et: string; en: string };
    yearRange: { start: number; end: number };
    description: { et: string; en: string };
}

interface RawPeriodData {
  metadata: PeriodMetadata;
  categories: {
    [categoryKey: string]: RawCategoryData;
  };
  statistics: object;
}

interface RawStyleData {
  metadata: object;
  periods: {
      [periodKey: string]: RawPeriodData;
  };
  index: object;
}

interface ApiCategory {
  id: string;
  name: { en: string; et: string };
  hasImages: boolean;
  exampleImageUrl: string | null;
}

interface ApiPeriod {
  id: string;
  name: { en: string; et: string };
  yearRange: { start: number; end: number };
  categories: ApiCategory[];
}

interface ApiResponse {
  periods: ApiPeriod[];
}

const DATA_FILE_PATH = path.join(__dirname, '../../data/period-mapped/period_mapped_data.json');

/**
 * Reads and transforms period-mapped data for the API.
 */
async function loadAndTransformStyleData(): Promise<ApiResponse> {
  try {
    const rawData = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    const jsonData: RawStyleData = JSON.parse(rawData);

    const apiResponse: ApiResponse = { periods: [] };
    const periodsData = jsonData.periods;

    for (const periodKey in periodsData) {
      if (Object.prototype.hasOwnProperty.call(periodsData, periodKey)) {
        const periodInputData = periodsData[periodKey];
        const apiPeriod: ApiPeriod = {
          id: periodKey,
          name: {
            en: periodInputData.metadata.name.en || periodKey.replace(/_/g, '-'),
            et: periodInputData.metadata.name.et || periodKey.replace(/_/g, '-')
          },
          yearRange: periodInputData.metadata.yearRange,
          categories: []
        };

        const categoriesData = periodInputData.categories;
        for (const categoryKey in categoriesData) {
          if (Object.prototype.hasOwnProperty.call(categoriesData, categoryKey)) {
            const categoryInputData = categoriesData[categoryKey];
            const hasImages = categoryInputData.records && categoryInputData.records.length > 0;
            let exampleImageUrl: string | null = null;

            if (hasImages) {
              const randomIndex = Math.floor(Math.random() * categoryInputData.records.length);
              exampleImageUrl = categoryInputData.records[randomIndex];
            }

            const formattedNameEn = categoryKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const formattedNameEt = formattedNameEn;

            const apiCategory: ApiCategory = {
              id: categoryKey,
              name: { en: formattedNameEn, et: formattedNameEt },
              hasImages: hasImages,
              exampleImageUrl: exampleImageUrl
            };
            apiPeriod.categories.push(apiCategory);
          }
        }

        apiPeriod.categories.sort((a, b) => a.name.en.localeCompare(b.name.en));

        if (apiPeriod.categories.length > 0) {
            apiResponse.periods.push(apiPeriod);
        }
      }
    }

    apiResponse.periods.sort((a, b) => a.yearRange.start - b.yearRange.start);

    return apiResponse;
  } catch (error) {
    console.error('Error loading or processing style data:', error);
    if (error instanceof SyntaxError) {
        throw new Error('Failed to parse style data file.');
    }
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error('Style data file not found.');
    }
    throw new Error('Failed to load style data.');
  }
}

/**
 * Express request handler for getting style data.
 */
export const getStyles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = await loadAndTransformStyleData();
    res.json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * Express request handler for getting multiple style reference image URLs.
 */
export const getStyleReferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { periodId, categoryId } = req.params;
    const count = Math.min(parseInt(req.query.count as string || '3', 10), 10);

    if (!periodId || !categoryId) {
      res.status(400).json({ message: 'Missing periodId or categoryId parameter' });
      return;
    }

    const rawData = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    const jsonData: RawStyleData = JSON.parse(rawData);
    const periodsData = jsonData.periods;

    const period = periodsData[periodId];
    if (!period) {
        res.status(404).json({ message: `Period '${periodId}' not found` });
        return;
    }

    const category = period.categories[categoryId];
    if (!category) {
        res.status(404).json({ message: `Category '${categoryId}' not found in period '${periodId}'` });
        return;
    }

    const allRecords = category.records || [];
    if (allRecords.length === 0) {
        res.json({ urls: [] });
        return;
    }

    const selectedRecords = allRecords.length <= count
        ? allRecords
        : random.sample(allRecords, count);

    res.json({ urls: selectedRecords });

  } catch (error) {
    console.error('Error getting style references:', error);
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        next(new Error('Style data file not found.'));
     } else if (error instanceof SyntaxError) {
         next(new Error('Failed to parse style data file.'));
     } else {
         next(error);
     }
  }
};

namespace random {
    export function sample<T>(population: T[], k: number): T[] {
        if (k < 0 || k > population.length) {
            throw new Error("Sample size out of range.");
        }
        const result = [...population];
        for (let i = population.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result.slice(0, k);
    }
}

export const getLocalTestStyles = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const testImagesDir = path.join(__dirname, '../../data/full_size_test_images');
    const files = await fs.readdir(testImagesDir);

    const responseDataPromises = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png'].includes(ext);
      })
      .map(async (file) => {
        const filePath = path.join(testImagesDir, file);
        const fileBuffer = await fs.readFile(filePath);
        const base64Data = fileBuffer.toString('base64');
        const ext = path.extname(file).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const imageDataUrl = `data:${mimeType};base64,${base64Data}`;

        return {
          id: file,
          displayName: file,
          imageDataUrl: imageDataUrl
        };
      });

    const responseData = await Promise.all(responseDataPromises);

    res.json({ styles: responseData });

  } catch (error) {
    console.error('Error getting local test styles:', error);
    next(error);
  }
};
