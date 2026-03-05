import { useQuery } from '@tanstack/react-query';
import { fetchRunDetail } from '../api/observability';

export const useRunDetail = (correlationId: string) =>
  useQuery({
    queryKey: ['run', correlationId],
    queryFn: () => fetchRunDetail(correlationId),
    staleTime: 60_000,
    enabled: !!correlationId,
  });
