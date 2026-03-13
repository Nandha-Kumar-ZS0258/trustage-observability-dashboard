import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FeedException, ExceptionSummary } from '../types/exceptions';

export interface ExceptionFilters {
  cuId?: string;
  status?: 'resolved' | 'unresolved';
  step?: string;
  from?: string;
  to?: string;
}

const api = axios.create({ baseURL: '/api' });

const fetchExceptionSummary = (): Promise<ExceptionSummary> =>
  api.get('/exceptions/summary').then(r => r.data);

const fetchExceptions = (filters: ExceptionFilters): Promise<FeedException[]> =>
  api.get('/exceptions', { params: filters }).then(r => r.data);

const fetchException = (id: number): Promise<FeedException> =>
  api.get(`/exceptions/${id}`).then(r => r.data);

export const useExceptionSummary = () =>
  useQuery({
    queryKey: ['exception-summary'],
    queryFn: fetchExceptionSummary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export const useExceptions = (filters: ExceptionFilters = {}) =>
  useQuery({
    queryKey: ['exceptions', filters],
    queryFn: () => fetchExceptions(filters),
    staleTime: 15_000,
  });

export const useException = (id: number) =>
  useQuery({
    queryKey: ['exception', id],
    queryFn: () => fetchException(id),
    staleTime: 60_000,
    enabled: !!id,
  });

export const usePatchOwner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ownerId }: { id: number; ownerId: string }) =>
      api.patch(`/exceptions/${id}/owner`, { ownerId }).then(r => r.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['exception', id] });
      qc.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });
};

export const usePatchNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      api.patch(`/exceptions/${id}/note`, { note }).then(r => r.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['exception', id] });
      qc.invalidateQueries({ queryKey: ['exceptions'] });
    },
  });
};

export const useResolveException = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolvedById }: { id: number; resolvedById: string }) =>
      api.patch(`/exceptions/${id}/resolve`, { resolvedById }).then(r => r.data),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['exception', id] });
      qc.invalidateQueries({ queryKey: ['exceptions'] });
      qc.invalidateQueries({ queryKey: ['exception-summary'] });
      qc.invalidateQueries({ queryKey: ['unresolved-count'] });
    },
  });
};
