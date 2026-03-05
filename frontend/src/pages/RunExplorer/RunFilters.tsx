import { useForm } from 'react-hook-form';
import type { RunFilters } from '../../types/telemetry';

interface RunFiltersProps {
  onFilter: (filters: RunFilters) => void;
}

export function RunFiltersBar({ onFilter }: RunFiltersProps) {
  const { register, handleSubmit, reset } = useForm<RunFilters>();

  return (
    <form
      onSubmit={handleSubmit(onFilter)}
      className="card flex flex-wrap gap-3 items-end"
    >
      <div className="flex-1 min-w-[140px]">
        <label className="block text-xs text-gray-500 mb-1">CU ID</label>
        <input {...register('cuId')} placeholder="e.g. CU_Gamma" className="input" />
      </div>
      <div className="flex-1 min-w-[130px]">
        <label className="block text-xs text-gray-500 mb-1">File Type</label>
        <input {...register('fileType')} placeholder="e.g. members" className="input" />
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="block text-xs text-gray-500 mb-1">From</label>
        <input type="datetime-local" {...register('from')} className="input" />
      </div>
      <div className="flex-1 min-w-[150px]">
        <label className="block text-xs text-gray-500 mb-1">To</label>
        <input type="datetime-local" {...register('to')} className="input" />
      </div>
      <div className="flex-1 min-w-[120px]">
        <label className="block text-xs text-gray-500 mb-1">Status</label>
        <select {...register('status')} className="select">
          <option value="">All</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="partial">Partial</option>
        </select>
      </div>
      <div className="flex-1 min-w-[110px]">
        <label className="block text-xs text-gray-500 mb-1">SLA Breach</label>
        <select {...register('slaBreach', { setValueAs: v => v === '' ? undefined : v === 'true' })} className="select">
          <option value="">All</option>
          <option value="true">Breached</option>
          <option value="false">Met</option>
        </select>
      </div>
      <div className="flex gap-2 shrink-0">
        <button type="submit" className="btn-primary">Filter</button>
        <button type="button" className="btn-ghost" onClick={() => { reset(); onFilter({}); }}>
          Clear
        </button>
      </div>
    </form>
  );
}
