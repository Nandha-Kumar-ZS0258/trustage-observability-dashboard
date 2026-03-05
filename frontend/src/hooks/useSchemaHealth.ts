import { useQuery } from '@tanstack/react-query';
import {
  fetchSchemaHealth, fetchValidationFailures, fetchSchemaDriftAlerts, fetchColumnAnomalies,
} from '../api/observability';

export const useSchemaHealth       = () => useQuery({ queryKey: ['schema-health'],       queryFn: fetchSchemaHealth,       staleTime: 60_000 });
export const useValidationFailures = () => useQuery({ queryKey: ['val-failures'],         queryFn: fetchValidationFailures, staleTime: 60_000 });
export const useSchemaDriftAlerts  = () => useQuery({ queryKey: ['schema-drift'],         queryFn: fetchSchemaDriftAlerts,  staleTime: 60_000 });
export const useColumnAnomalies    = () => useQuery({ queryKey: ['column-anomalies'],     queryFn: fetchColumnAnomalies,    staleTime: 60_000 });
