import { useQuery } from '@tanstack/react-query';
import {
  fetchStageDurationHeatmap, fetchThroughputTrend, fetchSlowestRuns,
  fetchStageSplit, fetchMemoryTrend,
} from '../api/observability';

export const useStageDurationHeatmap = () =>
  useQuery({ queryKey: ['perf-stages'],     queryFn: fetchStageDurationHeatmap, staleTime: 60_000 });

export const useThroughputTrend = () =>
  useQuery({ queryKey: ['perf-throughput'], queryFn: fetchThroughputTrend,      staleTime: 60_000 });

export const useSlowestRuns = () =>
  useQuery({ queryKey: ['perf-slowest'],    queryFn: fetchSlowestRuns,          staleTime: 60_000 });

export const useStageSplit = () =>
  useQuery({ queryKey: ['perf-split'],      queryFn: fetchStageSplit,           staleTime: 60_000 });

export const useMemoryTrend = () =>
  useQuery({ queryKey: ['perf-memory'],     queryFn: fetchMemoryTrend,          staleTime: 60_000 });
