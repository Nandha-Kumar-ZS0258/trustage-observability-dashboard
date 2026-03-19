import { useQuery } from '@tanstack/react-query';
import {
  fetchAksSummary,
  fetchAdaptorHealth,
  fetchAdaptorById,
  fetchClusterEvents,
  fetchEventSummary,
  fetchNodeHealth,
  fetchAdaptorHistory,
  fetchAdaptorEvents,
  fetchAdaptorRuns,
  fetchRunContext,
} from '../api/observability';

// Refetch every 30 s for near-real-time feel
const REFETCH_INTERVAL = 30_000;
const STALE_TIME       = 15_000;

export const useAksSummary = () =>
  useQuery({
    queryKey:       ['aks-summary'],
    queryFn:        fetchAksSummary,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useAdaptorHealth = () =>
  useQuery({
    queryKey:       ['aks-adaptors'],
    queryFn:        fetchAdaptorHealth,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useAdaptorById = (adaptorId: string) =>
  useQuery({
    queryKey:       ['aks-adaptor', adaptorId],
    queryFn:        () => fetchAdaptorById(adaptorId),
    enabled:        !!adaptorId,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useClusterEvents = (hours = 24) =>
  useQuery({
    queryKey:       ['aks-events', hours],
    queryFn:        () => fetchClusterEvents(hours),
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useEventSummary = (hours = 24) =>
  useQuery({
    queryKey:       ['aks-event-summary', hours],
    queryFn:        () => fetchEventSummary(hours),
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useNodeHealth = () =>
  useQuery({
    queryKey:       ['aks-nodes'],
    queryFn:        fetchNodeHealth,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useAdaptorHistory = (adaptorId: string, hours = 24, days = 7) =>
  useQuery({
    queryKey:       ['aks-adaptor-history', adaptorId, hours, days],
    queryFn:        () => fetchAdaptorHistory(adaptorId, hours, days),
    enabled:        !!adaptorId,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useAdaptorEvents = (adaptorId: string, hours = 24) =>
  useQuery({
    queryKey:       ['aks-adaptor-events', adaptorId, hours],
    queryFn:        () => fetchAdaptorEvents(adaptorId, hours),
    enabled:        !!adaptorId,
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useAdaptorRuns = (limit = 50) =>
  useQuery({
    queryKey:       ['aks-runs', limit],
    queryFn:        () => fetchAdaptorRuns(limit),
    refetchInterval: REFETCH_INTERVAL,
    staleTime:       STALE_TIME,
  });

export const useRunContext = (batchId: string | null) =>
  useQuery({
    queryKey:       ['aks-run-context', batchId],
    queryFn:        () => fetchRunContext(batchId!),
    enabled:        !!batchId,
    staleTime:       STALE_TIME,
  });
