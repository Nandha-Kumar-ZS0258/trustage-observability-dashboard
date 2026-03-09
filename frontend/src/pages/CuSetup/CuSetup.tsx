import { CuSetupKpiStrip }    from './CuSetupKpiStrip';
import { OnboardingTimeline }  from './OnboardingTimeline';
import { AdapterMappingCharts } from './AdapterMappingCharts';
import { CuDirectoryTable }    from './CuDirectoryTable';
import { ConfigDriftTable }    from './ConfigDriftTable';
import { FirstDeliveryGapChart } from './FirstDeliveryGapChart';
import { OwnerTeamTable }      from './OwnerTeamTable';

export default function CuSetup() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">CU Setup & Configuration</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Onboarding registry — configured intent vs observed reality across all Credit Unions
        </p>
      </div>

      <CuSetupKpiStrip />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <OnboardingTimeline />
        <AdapterMappingCharts />
      </div>

      <CuDirectoryTable />

      <ConfigDriftTable />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <FirstDeliveryGapChart />
        <OwnerTeamTable />
      </div>
    </div>
  );
}
