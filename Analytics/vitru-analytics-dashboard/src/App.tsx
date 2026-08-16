import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { KpiGrid } from './components/KpiGrid';
import { AssessmentGrid } from './components/AssessmentGrid';
import { FunnelChart } from './components/FunnelChart';

export default function App() {
  return (
    <ThemeProvider>
      <Layout>
        <KpiGrid />
        <AssessmentGrid />
        <FunnelChart />
      </Layout>
    </ThemeProvider>
  );
}
