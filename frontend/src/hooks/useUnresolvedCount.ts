import axios from 'axios';
import { useQuery } from '@tanstack/react-query';

const api = axios.create({ baseURL: '/api' });

const fetchUnresolvedCount = (): Promise<{ count: number }> =>
  api.get<number>('/exceptions/unresolved-count').then(r => ({ count: r.data }));

export const useUnresolvedCount = () =>
  useQuery({
    queryKey: ['unresolved-count'],
    queryFn: fetchUnresolvedCount,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
