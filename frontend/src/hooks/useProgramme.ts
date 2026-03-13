import axios from 'axios';
import { useQuery, useMutation } from '@tanstack/react-query';
import type { LifecycleCounts, CuFleetRow, CuConfiguration, LifecycleState } from '../types/programme';

const api = axios.create({ baseURL: '/api' });

export interface CuFleetFilters {
  state?: string;
  platform?: string;
  health?: string;
  search?: string;
}

const fetchLifecycleCounts = (): Promise<LifecycleCounts> =>
  api.get('/programme/lifecycle-counts').then(r => r.data);

const fetchCuFleet = (filters: CuFleetFilters): Promise<CuFleetRow[]> =>
  api.get('/programme/cu-fleet', { params: filters }).then(r => r.data);

const fetchLifecyclePanel = (state: LifecycleState): Promise<CuConfiguration[]> =>
  api.get(`/programme/lifecycle-panel/${encodeURIComponent(state)}`).then(r => r.data);

export const useLifecycleCounts = () =>
  useQuery({
    queryKey: ['lifecycle-counts'],
    queryFn: fetchLifecycleCounts,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export const useCuFleet = (filters: CuFleetFilters = {}) =>
  useQuery({
    queryKey: ['cu-fleet', filters],
    queryFn: () => fetchCuFleet(filters),
    staleTime: 30_000,
  });

export const useLifecyclePanel = (state: LifecycleState) =>
  useQuery({
    queryKey: ['lifecycle-panel', state],
    queryFn: () => fetchLifecyclePanel(state),
    staleTime: 30_000,
    enabled: !!state,
  });

export interface CuNoteRequest {
  cuId: string;
  note: string;
  ownerId: string;
}

export const useSaveCuNote = () =>
  useMutation({
    mutationFn: (req: CuNoteRequest) =>
      api.post('/programme/lifecycle-panel/note', req).then(r => r.data),
  });
