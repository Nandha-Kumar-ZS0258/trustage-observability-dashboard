import { useQuery } from '@tanstack/react-query';
import { fetchOverviewKpis, fetchLiveFeed, fetchCuHealth, fetchTodayTimeline, fetchHourlyRows } from '../api/observability';

export const useOverviewKpis = () =>
  useQuery({
    queryKey: ['overview-kpis'],
    queryFn: fetchOverviewKpis,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

export const useLiveFeedData = () =>
  useQuery({
    queryKey: ['live-feed'],
    queryFn: fetchLiveFeed,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

export const useCuHealth = () =>
  useQuery({
    queryKey: ['cu-health'],
    queryFn: fetchCuHealth,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export const useTodayTimeline = () =>
  useQuery({
    queryKey: ['today-timeline'],
    queryFn: fetchTodayTimeline,
    refetchInterval: 60_000,
  });

export const useHourlyRows = () =>
  useQuery({
    queryKey: ['hourly-rows'],
    queryFn: fetchHourlyRows,
    refetchInterval: 60_000,
  });
