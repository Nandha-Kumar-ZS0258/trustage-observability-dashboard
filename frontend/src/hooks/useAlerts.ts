import { useQuery } from '@tanstack/react-query';
import {
  fetchSlaSummary, fetchSlaBreaches, fetchErrorSummary, fetchRetryRuns, fetchFailedRuns,
} from '../api/observability';

export const useSlaSummary  = () => useQuery({ queryKey: ['sla-summary'],  queryFn: fetchSlaSummary,  staleTime: 60_000 });
export const useSlaBreaches = () => useQuery({ queryKey: ['sla-breaches'], queryFn: fetchSlaBreaches, staleTime: 60_000 });
export const useErrorSummary = () => useQuery({ queryKey: ['err-summary'], queryFn: fetchErrorSummary, staleTime: 60_000 });
export const useRetryRuns   = () => useQuery({ queryKey: ['retry-runs'],   queryFn: fetchRetryRuns,   staleTime: 60_000 });
export const useFailedRuns  = () => useQuery({ queryKey: ['failed-runs'],  queryFn: fetchFailedRuns,  staleTime: 30_000 });
