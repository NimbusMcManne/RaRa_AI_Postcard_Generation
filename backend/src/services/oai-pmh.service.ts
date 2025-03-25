import axios, { AxiosError } from 'axios';
import { parseStringPromise } from 'xml2js';
import { config } from '../config/config';
import { OaiPmhRecord } from '../types/oai-pmh.types';

interface OaiPmhResponse {
  'OAI-PMH': {
    '@_xmlns': string;
    '@_xmlns:xsi': string;
    '@_xsi:schemaLocation': string;
    'responseDate': [string];
    'request': [{
      '@_verb': string;
      '@_set': string;
      '@_metadataPrefix': string;
      '#': string;
    }];
    'ListRecords': [{
      'record': OaiPmhRecord[];
      'resumptionToken'?: [string];
    }];
    'error'?: [{
      '@_code': string;
      '_': string;
    }];
  };
}

interface FetchOptions {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number | undefined;
}

interface RequiredExceptBatch {
  maxRetries: number;
  retryDelay: number;
  batchSize: number | undefined;
}

export class OaiPmhService {
  private readonly endpoint: string;
  private readonly defaultOptions: RequiredExceptBatch = {
    maxRetries: 3,
    retryDelay: 1000,
    batchSize: undefined
  };

  constructor() {
    this.endpoint = config.oaiPmhEndpoint;
  }


  private async fetchWithRetry(url: string, options: RequiredExceptBatch): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < options.maxRetries; attempt++) {
      try {
        const response = await axios.get(url);
        return response.data;
      } catch (error) {
        lastError = error as Error;
        if (this.shouldRetry(error as AxiosError)) {
          await this.delay(options.retryDelay * Math.pow(2, attempt));
          continue;
        }
        break;
      }
    }

    throw new Error(`Failed to fetch OAI-PMH data after ${options.maxRetries} attempts: ${lastError?.message}`);
  }


  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) return true; 
    const status = error.response.status;
    return status === 429 || status === 503 || (status >= 500 && status < 600);
  }


  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }


  private async parseXmlResponse(xml: string): Promise<OaiPmhResponse> {
    try {
      const result = await parseStringPromise(xml, {
        explicitArray: true,
        explicitRoot: true,
        xmlns: true,
        mergeAttrs: false,
        attrkey: '@_',
        charkey: '#',
        preserveChildrenOrder: true,
        explicitChildren: true
      });

      if (!result['OAI-PMH']) {
        throw new Error('Invalid OAI-PMH response structure');
      }

      if (result['OAI-PMH'].error) {
        const errorCode = result['OAI-PMH'].error[0]['@_']?.code;
        const errorMessage = result['OAI-PMH'].error[0]['#'] || result['OAI-PMH'].error[0]._;
        throw new Error(`OAI-PMH error (${errorCode}): ${errorMessage}`);
      }

      return result as OaiPmhResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse XML response: ${error.message}`);
      }
      throw new Error('Failed to parse XML response: Unknown error');
    }
  }

  private buildUrl(resumptionToken?: string): string {
    const params = new URLSearchParams();
    params.set('verb', 'ListRecords');

    if (resumptionToken) {
      params.set('resumptionToken', resumptionToken);
    } else {
      params.set('set', 'postcard');
      params.set('metadataPrefix', 'edm');
    }

    const url = `${this.endpoint}?${params.toString()}`;
    console.log(`URL is ${url}`)
    return url;
  }


  async harvest(options: FetchOptions = {}): Promise<OaiPmhRecord[]> {
    const opts = { ...this.defaultOptions, ...options };
    const allRecords: OaiPmhRecord[] = [];
    let resumptionToken: string | undefined;

    try {
      do {
        const url = this.buildUrl(resumptionToken);
        console.log(`Fetching from URL: ${url}`);
        const xmlResponse = await this.fetchWithRetry(url, opts);
        const parsedResponse = await this.parseXmlResponse(xmlResponse);

        const listRecords = parsedResponse['OAI-PMH'].ListRecords?.[0];
        if (!listRecords) {
          throw new Error('No ListRecords found in response');
        }

        allRecords.push(...listRecords.record);

        const token = listRecords.resumptionToken?.[0];
        resumptionToken = typeof token === 'string' ? token : token?.['#'];

        console.log(`Harvested ${allRecords.length} records...`);

        if (opts.batchSize && allRecords.length >= opts.batchSize) {
          break;
        }
      } while (resumptionToken);

      return allRecords;
    } catch (error) {
      throw new Error(`Harvest failed: ${(error as Error).message}`);
    }
  }
}

export default new OaiPmhService();
