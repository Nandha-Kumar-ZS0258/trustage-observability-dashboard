import { useQuery } from '@tanstack/react-query';
import { fetchRuns } from '../api/observability';
import type { RunFilters } from '../types/telemetry';

export const useRunList = (filters: RunFilters) =>
  useQuery({
    queryKey: ['runs', filters],
    queryFn: () => fetchRuns(filters),
    staleTime: 15_000,
  });
