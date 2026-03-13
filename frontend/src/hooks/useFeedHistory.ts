import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import type { FeedSummary } from '../types/programme';

export interface FeedListFilters {
  cuId?: string;
  from?: string;
  to?: string;
  status?: string;
  search?: string;
}

export interface StepTimelineItem {
  stageName: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface ValidationReport {
  overallStatus: string;
  gate1Passed: boolean;
  gate1ErrorCount: number;
  gate2Passed: boolean;
  gate2ErrorCount: number;
  gate3Passed: boolean;
  gate3ErrorCount: number;
  sourceMemberCount: number | null;
  prodMemberCount: number | null;
  sourceAccountCount: number | null;
  prodAccountCount: number | null;
  sourceLoanCount: number | null;
  prodLoanCount: number | null;
  dqBlocked: number;
  dqWarnings: number;
  dataAlignmentScore: number | null;
  gateDetailsJson: string | null;
}

export interface FeedDetailSummary {
  feedReferenceId: string;
  cuId: string;
  cuName: string;
  blobName: string | null;
  feedReceived: string;
  feedDelivered: string | null;
  totalDurationMs: number | null;
  memberRecordsProcessed: number | null;
  recordsRejected: number | null;
  status: string;
  mappingVersion: string | null;
  runType: string | null;
  nextFeedExpectedAt: string | null;
  onTime: boolean | null;
}

export interface FeedDetail {
  summary: FeedDetailSummary;
  stepTimeline: StepTimelineItem[];
  validationReport: ValidationReport | null;
}

const api = axios.create({ baseURL: '/api' });

const fetchFeedList = (filters: FeedListFilters): Promise<FeedSummary[]> =>
  api.get('/history/feeds', { params: filters }).then(r => r.data);

const fetchFeedDetail = (feedRefId: string): Promise<FeedDetail> =>
  api.get(`/history/feeds/${feedRefId}`).then(r => r.data);

export const useFeedList = (filters: FeedListFilters = {}) =>
  useQuery({
    queryKey: ['feed-list', filters],
    queryFn: () => fetchFeedList(filters),
    staleTime: 15_000,
  });

export const useFeedDetail = (feedRefId: string) =>
  useQuery({
    queryKey: ['feed-detail', feedRefId],
    queryFn: () => fetchFeedDetail(feedRefId),
    staleTime: 60_000,
    enabled: !!feedRefId,
  });
