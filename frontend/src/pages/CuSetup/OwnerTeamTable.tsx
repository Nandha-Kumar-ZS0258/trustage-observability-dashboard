import { useOwnerTeams } from '../../hooks/useCuSetup';

export function OwnerTeamTable() {
  const { data, isLoading } = useOwnerTeams();

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-white mb-4">Owner Team Load</h2>

      {isLoading ? (
        <p className="text-xs text-gray-500">Loading...</p>
      ) : !data?.length ? (
        <p className="text-xs text-gray-500">No team data available.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Team</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Total</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Active</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Onboarding</th>
              <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Avg Success</th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.ownerTeam} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 px-3 text-gray-200 font-medium">{row.ownerTeam}</td>
                <td className="py-2 px-3 text-gray-300 text-right tabular-nums">{row.totalCus}</td>
                <td className="py-2 px-3 text-emerald-400 text-right tabular-nums">{row.activeCount}</td>
                <td className="py-2 px-3 text-amber-400 text-right tabular-nums">{row.onboardingCount}</td>
                <td className="py-2 px-3 text-right tabular-nums text-gray-300">
                  {row.avgSuccessRate !== null ? `${row.avgSuccessRate.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
