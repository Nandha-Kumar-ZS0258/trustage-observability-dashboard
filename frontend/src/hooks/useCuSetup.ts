import { useQuery } from '@tanstack/react-query';
import {
  fetchCuSetupKpis,
  fetchCuDirectory,
  fetchCuDrift,
  fetchCuDriftDetail,
  fetchOnboardingTimeline,
  fetchAdapterSpread,
  fetchMappingSpread,
  fetchFirstDeliveryGap,
  fetchOwnerTeams,
} from '../api/observability';
import type { CuDirectoryFilters } from '../types/telemetry';

export const useCuSetupKpis = () =>
  useQuery({ queryKey: ['cu-setup-kpis'], queryFn: fetchCuSetupKpis, staleTime: 60_000 });

export const useCuDirectory = (filters: CuDirectoryFilters) =>
  useQuery({ queryKey: ['cu-setup-dir', filters], queryFn: () => fetchCuDirectory(filters), staleTime: 60_000 });

export const useCuDrift = () =>
  useQuery({ queryKey: ['cu-setup-drift'], queryFn: fetchCuDrift, staleTime: 60_000 });

export const useCuDriftDetail = (cuId: string) =>
  useQuery({ queryKey: ['cu-drift', cuId], queryFn: () => fetchCuDriftDetail(cuId), staleTime: 60_000, enabled: !!cuId });

export const useOnboardingTimeline = () =>
  useQuery({ queryKey: ['cu-onboard-timeline'], queryFn: fetchOnboardingTimeline, staleTime: 120_000 });

export const useAdapterSpread = () =>
  useQuery({ queryKey: ['cu-adapter-spread'], queryFn: fetchAdapterSpread, staleTime: 120_000 });

export const useMappingSpread = () =>
  useQuery({ queryKey: ['cu-mapping-spread'], queryFn: fetchMappingSpread, staleTime: 120_000 });

export const useFirstDeliveryGap = () =>
  useQuery({ queryKey: ['cu-first-gap'], queryFn: fetchFirstDeliveryGap, staleTime: 120_000 });

export const useOwnerTeams = () =>
  useQuery({ queryKey: ['cu-owner-teams'], queryFn: fetchOwnerTeams, staleTime: 120_000 });
