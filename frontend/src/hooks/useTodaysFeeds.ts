import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import type { GanttEntry, FeedSummary, CuFleetRow } from '../types/programme';

export interface TodaySummary {
  feedsToday: number;
  successRate: number;
  activeExceptions: number;
  activeBauCus: number;
}

const api = axios.create({ baseURL: '/api' });

const fetchTodaySummary = (): Promise<TodaySummary> =>
  api.get('/feeds/today/summary').then(r => r.data);

const fetchGanttData = (): Promise<GanttEntry[]> =>
  api.get('/feeds/today/gantt').then(r => r.data);

const fetchFeedTicker = (): Promise<FeedSummary[]> =>
  api.get('/feeds/today/ticker').then(r => r.data);

const fetchCuStatusGrid = (): Promise<CuFleetRow[]> =>
  api.get('/feeds/today/grid').then(r => r.data);

export const useTodaysSummary = () =>
  useQuery({
    queryKey: ['today-summary'],
    queryFn: fetchTodaySummary,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

export const useGanttData = () =>
  useQuery({
    queryKey: ['gantt-data'],
    queryFn: fetchGanttData,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

export const useFeedTicker = () =>
  useQuery({
    queryKey: ['feed-ticker'],
    queryFn: fetchFeedTicker,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

export const useCuStatusGrid = () =>
  useQuery({
    queryKey: ['cu-status-grid'],
    queryFn: fetchCuStatusGrid,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
