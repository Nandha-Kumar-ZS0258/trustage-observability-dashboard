import { useCuSetupKpis } from '../../hooks/useCuSetup';
import { KpiCard } from '../../components/KpiCard';

export function CuSetupKpiStrip() {
  const { data } = useCuSetupKpis();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard label="Total CUs"     value={data?.totalCus      ?? '—'} severity="neutral" />
      <KpiCard label="Active"        value={data?.activeCount    ?? '—'} severity="good"    />
      <KpiCard label="In Onboarding" value={data?.onboardingCount ?? '—'} severity="warning" />
      <KpiCard label="Inactive"      value={data?.inactiveCount  ?? '—'} severity="neutral" />
    </div>
  );
}
