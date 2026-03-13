import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import {
  fetchCuSummary, fetchCuDurationTrend, fetchCuDailyVolume,
  fetchCuValidationTrend, fetchCuRecentRuns, fetchCuErrorHistory,
} from '../api/observability';
import type { StepTimingPoint } from '../types/telemetry';

// New /api client for kafka-backed endpoints (distinct from legacy /observability)
const newApi = axios.create({ baseURL: '/api' });

const fetchCuStepTimingTrend = (cuId: string): Promise<StepTimingPoint[]> =>
  newApi.get(`/cu/${cuId}/step-timing-trend`).then(r => r.data);

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

/** Step Timing Trend — per-feed stage durations for the stacked area chart.
 *  Source: kafka.PipelineStageTimings scoped to this CU, last 30 feeds.
 *  Endpoint: GET /api/cu/:cuId/step-timing-trend */
export const useCuStepTimingTrend = (cuId: string) =>
  useQuery({
    queryKey: ['cu-step-timing-trend', cuId],
    queryFn: () => fetchCuStepTimingTrend(cuId),
    enabled: !!cuId,
    staleTime: 60_000,
  });
