import { useState } from 'react';
import { ExceptionBanner } from '../../components/ExceptionBanner';
import { LifecycleStateStrip } from './LifecycleStateStrip';
import { LifecyclePanel } from './LifecyclePanel';
import { CuFleetTable } from './CuFleetTable';
import { useLifecycleCounts } from '../../hooks/useProgramme';
import type { LifecycleState } from '../../types/programme';

export default function CuProgrammeView() {
  const [panelState, setPanelState] = useState<LifecycleState | null>(null);
  const { data: counts } = useLifecycleCounts();

  const staleCount =
    panelState === 'BAU'
      ? (counts?.overdueBau ?? 0)
      : (counts?.overdueReady ?? 0);

  return (
    <div className="p-6">
      {/* Exception banner — Section 6.1 */}
      <ExceptionBanner />

      {/* Lifecycle state strip — Section 6.2 */}
      <LifecycleStateStrip onStateClick={setPanelState} />

      {/* CU Fleet Table — Section 6.4 */}
      <CuFleetTable />

      {/* Slide-over drill-down panel — Section 6.3 */}
      <LifecyclePanel
        state={panelState}
        staleCount={staleCount}
        onClose={() => setPanelState(null)}
      />
    </div>
  );
}
