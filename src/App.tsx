import { CRM } from "@/components/crm/root/CRM";
import { AppErrorBoundary } from "@/components/crm/shared/errors/AppErrorBoundary";

const App = () => (
  <AppErrorBoundary>
    <CRM />
  </AppErrorBoundary>
);

export default App;
