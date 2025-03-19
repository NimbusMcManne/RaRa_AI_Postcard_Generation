// Raw XML response types
export interface OaiPmhRecord {
    '@_ns': {
      uri: string;
      local: string;
    };
    '$$': Array<{
      '#name': string;
      '@_ns': {
        uri: string;
        local: string;
      };
      '$$'?: any[];
      identifier?: string[];
      datestamp?: string[];
      setSpec?: string[];
      'rdf:RDF'?: Array<{
        '@_xmlns:rdf': string;
        '@_xmlns:edm': string;
        '@_xmlns:dc': string;
        '@_xmlns:ore': string;
        '@_xmlns:xsi': string;
        '@_xmlns:dcterms': string;
        'edm:ProvidedCHO': [{
          '@_rdf:about': string;
          'dc:title': [{ '#': string }];
          'dc:creator'?: [{ '#': string }];
          'dc:publisher'?: [{ '#': string }];
          'dc:identifier'?: Array<{
            '#': string;
            '@_': {
              'xsi:type': {
                value: string;
              };
            };
          }>;
          'dc:type': Array<{
            '#': string;
            '@_'?: {
              'xml:lang'?: {
                value: string;
              };
            };
          }>;
          'edm:type': [{ '#': string }];
          'dc:subject': Array<{
            '#': string;
            '@_': {
              'xml:lang': {
                value: string;
              };
            };
          }>;
          'dc:date'?: [{ '#': string }];
          'dc:language': [{ '#': string }];
          'dcterms:isPartOf'?: [{ '#': string }];
          'dc:rights'?: [{ '#': string }];
          'edm:currentLocation'?: [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
        }];
        'ore:Aggregation': [{
          '@_ns': {
            uri: string;
            local: string;
          };
          'edm:aggregatedCHO': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:isShownAt': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:object': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:rights'?: [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:dataProvider': [{ '#': string }];
          'edm:provider': [{ '#': string }];
        }];
      }>;
    }>;
    header: [{
      '@_ns': {
        uri: string;
        local: string;
      };
      '$$': any[];
      identifier: string[];
      datestamp: string[];
      setSpec: string[];
    }];
    metadata: [{
      '@_ns': {
        uri: string;
        local: string;
      };
      '$$': any[];
      'rdf:RDF': Array<{
        '@_xmlns:rdf': string;
        '@_xmlns:edm': string;
        '@_xmlns:dc': string;
        '@_xmlns:ore': string;
        '@_xmlns:xsi': string;
        '@_xmlns:dcterms': string;
        'edm:ProvidedCHO': [{
          '@_rdf:about': string;
          'dc:title': [{ '#': string }];
          'dc:creator'?: [{ '#': string }];
          'dc:publisher'?: [{ '#': string }];
          'dc:identifier'?: Array<{
            '#': string;
            '@_': {
              'xsi:type': {
                value: string;
              };
            };
          }>;
          'dc:type': Array<{
            '#': string;
            '@_'?: {
              'xml:lang'?: {
                value: string;
              };
            };
          }>;
          'edm:type': [{ '#': string }];
          'dc:subject': Array<{
            '#': string;
            '@_': {
              'xml:lang': {
                value: string;
              };
            };
          }>;
          'dc:date'?: [{ '#': string }];
          'dc:language': [{ '#': string }];
          'dcterms:isPartOf'?: [{ '#': string }];
          'dc:rights'?: [{ '#': string }];
          'edm:currentLocation'?: [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
        }];
        'ore:Aggregation': [{
          '@_ns': {
            uri: string;
            local: string;
          };
          'edm:aggregatedCHO': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:isShownAt': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:object': [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:rights'?: [{
            '@_': {
              'rdf:resource': {
                value: string;
              };
            };
          }];
          'edm:dataProvider': [{ '#': string }];
          'edm:provider': [{ '#': string }];
        }];
      }>;
    }];
  }
  