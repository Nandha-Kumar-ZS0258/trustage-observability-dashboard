import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LoadingSpinner } from './components/LoadingSpinner';

const Overview     = lazy(() => import('./pages/Overview/Overview'));
const RunExplorer  = lazy(() => import('./pages/RunExplorer/RunExplorer'));
const RunDetail    = lazy(() => import('./pages/RunExplorer/RunDetail/RunDetail'));
const CuDetail     = lazy(() => import('./pages/CuDetail/CuDetail'));
const Performance  = lazy(() => import('./pages/Performance/Performance'));
const SchemaHealth = lazy(() => import('./pages/SchemaHealth/SchemaHealth'));
const Alerts       = lazy(() => import('./pages/Alerts/Alerts'));
const CuSetup      = lazy(() => import('./pages/CuSetup/CuSetup'));

function PageLoader() {
  return <div className="p-6"><LoadingSpinner /></div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Overview /></Suspense>} />
          <Route path="runs" element={<Suspense fallback={<PageLoader />}><RunExplorer /></Suspense>} />
          <Route path="runs/:correlationId" element={<Suspense fallback={<PageLoader />}><RunDetail /></Suspense>} />
          <Route path="cu/:cuId" element={<Suspense fallback={<PageLoader />}><CuDetail /></Suspense>} />
          <Route path="performance" element={<Suspense fallback={<PageLoader />}><Performance /></Suspense>} />
          <Route path="schema-health" element={<Suspense fallback={<PageLoader />}><SchemaHealth /></Suspense>} />
          <Route path="alerts"    element={<Suspense fallback={<PageLoader />}><Alerts /></Suspense>} />
          <Route path="cu-setup"  element={<Suspense fallback={<PageLoader />}><CuSetup /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
