import { useQuery } from '@tanstack/react-query';
import {
  fetchCuSummary, fetchCuDurationTrend, fetchCuDailyVolume,
  fetchCuValidationTrend, fetchCuRecentRuns, fetchCuErrorHistory,
} from '../api/observability';

export const useCuSummary = (cuId: string) =>
  useQuery({
    queryKey: ['cu-summary', cuId],
    queryFn: () => fetchCuSummary(cuId),
    enabled: !!cuId,
    staleTime: 30_000,
  });

export const useCuDurationTrend = (cuId: string, days = 30) =>
  useQuery({
    queryKey: ['cu-duration-trend', cuId, days],
    queryFn: () => fetchCuDurationTrend(cuId, days),
    enabled: !!cuId,
    staleTime: 60_000,
  });

export const useCuDailyVolume = (cuId: string) =>
  useQuery({
    queryKey: ['cu-daily-volume', cuId],
    queryFn: () => fetchCuDailyVolume(cuId),
    enabled: !!cuId,
    staleTime: 60_000,
  });

export const useCuValidationTrend = (cuId: string) =>
  useQuery({
    queryKey: ['cu-validation-trend', cuId],
    queryFn: () => fetchCuValidationTrend(cuId),
    enabled: !!cuId,
    staleTime: 60_000,
  });

export const useCuRecentRuns = (cuId: string) =>
  useQuery({
    queryKey: ['cu-recent-runs', cuId],
    queryFn: () => fetchCuRecentRuns(cuId),
    enabled: !!cuId,
    staleTime: 30_000,
  });

export const useCuErrorHistory = (cuId: string) =>
  useQuery({
    queryKey: ['cu-error-history', cuId],
    queryFn: () => fetchCuErrorHistory(cuId),
    enabled: !!cuId,
    staleTime: 60_000,
  });
