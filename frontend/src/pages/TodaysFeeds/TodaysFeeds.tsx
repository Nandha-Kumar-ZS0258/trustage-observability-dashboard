import { ExceptionBanner } from '../../components/ExceptionBanner';
import { FeedsSummaryStrip } from './FeedsSummaryStrip';
import { DeliveryGantt } from './DeliveryGantt';
import { LiveFeedTicker } from './LiveFeedTicker';
import { CuStatusGrid } from './CuStatusGrid';

export default function TodaysFeeds() {
  return (
    <div className="p-6">
      {/* Exception banner — Section 6.6 */}
      <ExceptionBanner />

      {/* Page heading */}
      <div className="mb-5">
        <h1 className="text-lg font-bold text-black mb-1">Today's Feeds</h1>
        <p className="text-sm text-gray-500">
          Live pipeline status and delivery overview for all CU partners.
        </p>
      </div>

      {/* Summary strip — four stat cards — Section 6.5 */}
      <FeedsSummaryStrip />

      {/* Delivery Schedule Gantt — Section 6.9 (stub — Task 6.2) */}
      <DeliveryGantt />

      {/* Live Feed Ticker — Section 6.7 */}
      <LiveFeedTicker />

      {/* CU Partner Status Grid — Section 6.8 */}
      <CuStatusGrid />
    </div>
  );
}
