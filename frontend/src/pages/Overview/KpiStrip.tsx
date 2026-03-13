import { Activity, AlertTriangle, CheckCircle2, Users } from 'lucide-react';
import { KpiCard } from '../../components/KpiCard';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useOverviewKpis } from '../../hooks/useOverviewKpis';

function getSlaBreachSeverity(count: number) {
  if (count === 0) return 'good' as const;
  if (count <= 2)  return 'warning' as const;
  return 'critical' as const;
}

function getSuccessRateSeverity(rate: number) {
  if (rate >= 98) return 'good' as const;
  if (rate >= 90) return 'warning' as const;
  return 'critical' as const;
}

export function KpiStrip() {
  const { data, isLoading } = useOverviewKpis();

  if (isLoading) return <LoadingSpinner />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="Feeds Received Today"
        value={data.totalRuns.toLocaleString()}
        icon={<Activity className="w-4 h-4" />}
      />
      <KpiCard
        label="Successful Delivery Rate"
        value={`${data.successRate.toFixed(1)}%`}
        severity={getSuccessRateSeverity(data.successRate)}
        icon={<CheckCircle2 className="w-4 h-4" />}
      />
      <KpiCard
        label="SLA Breaches Today"
        value={data.slaBreachesToday}
        severity={getSlaBreachSeverity(data.slaBreachesToday)}
        icon={<AlertTriangle className="w-4 h-4" />}
      />
      <KpiCard
        label="Active CUs Today"
        value={data.activeCus}
        icon={<Users className="w-4 h-4" />}
      />
    </div>
  );
}
