import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ParsedDataset, Variable } from './useAnalysisWizard';

export function useDataParser() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = useCallback((file: File): Promise<ParsedDataset> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = results.data as Record<string, unknown>[];

          resolve({
            headers,
            rows,
            fileName: file.name,
            fileType: 'csv',
            rowCount: rows.length,
            columnCount: headers.length,
          });
        },
        error: (err) => {
          reject(new Error(`CSV parsing failed: ${err.message}`));
        },
      });
    });
  }, []);

  const parseExcel = useCallback((file: File): Promise<ParsedDataset> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
          const headers = Object.keys(jsonData[0] || {});

          resolve({
            headers,
            rows: jsonData,
            fileName: file.name,
            fileType: file.name.endsWith('.xlsx') ? 'xlsx' : 'xls',
            rowCount: jsonData.length,
            columnCount: headers.length,
          });
        } catch (err) {
          reject(new Error(`Excel parsing failed: ${err}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsBinaryString(file);
    });
  }, []);

  const parseFile = useCallback(
    async (file: File): Promise<ParsedDataset> => {
      setIsLoading(true);
      setError(null);

      try {
        const extension = file.name.split('.').pop()?.toLowerCase();

        let result: ParsedDataset;

        if (extension === 'csv') {
          result = await parseCSV(file);
        } else if (extension === 'xlsx' || extension === 'xls') {
          result = await parseExcel(file);
        } else {
          throw new Error(`Unsupported file type: ${extension}`);
        }

        setIsLoading(false);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse file';
        setError(errorMessage);
        setIsLoading(false);
        throw err;
      }
    },
    [parseCSV, parseExcel]
  );

  const detectVariableTypes = useCallback(
    (parsedData: ParsedDataset): Variable[] => {
      return parsedData.headers.map((header, index) => {
        // Sample values from the column
        const values = parsedData.rows
          .slice(0, 100)
          .map((row) => row[header])
          .filter((v) => v !== null && v !== undefined && v !== '');

        // Detect type based on values
        let type: 'nominal' | 'ordinal' | 'scale' = 'nominal';
        const uniqueValues = new Set(values);

        if (values.length > 0) {
          const allNumbers = values.every(
            (v) => typeof v === 'number' || (!isNaN(Number(v)) && v !== '')
          );

          if (allNumbers) {
            // If all numbers and many unique values, likely scale
            if (uniqueValues.size > 10) {
              type = 'scale';
            } else {
              // Few unique numbers could be ordinal or nominal codes
              type = 'ordinal';
            }
          } else {
            // String values - likely nominal
            type = 'nominal';
          }
        }

        // Determine decimals based on data
        let decimals = 0;
        if (type === 'scale') {
          const numValues = values.filter((v) => typeof v === 'number') as number[];
          const hasDecimals = numValues.some((v) => !Number.isInteger(v));
          decimals = hasDecimals ? 2 : 0;
        }

        return {
          name: header,
          label: '',
          type,
          measure: type,
          width: 8,
          decimals,
          valueLabels: {},
          missingValues: [],
          columnIndex: index,
        };
      });
    },
    []
  );

  return {
    parseFile,
    detectVariableTypes,
    isLoading,
    error,
  };
}
