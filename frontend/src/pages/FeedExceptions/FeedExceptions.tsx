import { ExceptionSummaryStrip } from './ExceptionSummaryStrip';
import { ExceptionList } from './ExceptionList';

export default function FeedExceptions() {
  return (
    <div className="p-6 space-y-0">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-black mb-1">Feed Exceptions</h1>
        <p className="text-sm text-gray-500">
          All pipeline exceptions across all CU partners — with owner assignment and resolution tracking.
        </p>
      </div>

      <ExceptionSummaryStrip />
      <ExceptionList />
    </div>
  );
}
