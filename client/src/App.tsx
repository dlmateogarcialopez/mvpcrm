import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BrandProvider } from "./contexts/BrandContext";
import Home from "./pages/Home";
import LeadsPage from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { PipelineSettingsPage } from "./pages/PipelineSettingsPage";
import { PipelinesManagerPage } from "./pages/PipelinesManagerPage";
import { PipelineMetricsPage } from "./pages/PipelineMetricsPage";
import { LabelsManagerPage } from "./pages/LabelsManagerPage";
import { ChannelsManagerPage } from "./pages/ChannelsManagerPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { AutomationRecipientsPage } from "./pages/AutomationRecipientsPage";
import { ImportExportPage } from "./pages/ImportExportPage";
import { EmailMarketingPage } from "./pages/EmailMarketingPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import SelectOrgPage from "./pages/SelectOrgPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import DialerPage from "./pages/DialerPage";
import PhoneListsPage from "./pages/PhoneListsPage";
import PhoneListDetailPage from "./pages/PhoneListDetailPage";
import PhoneListDialerPage from "./pages/PhoneListDialerPage";

function ProtectedDashboardRoutes() {
  return (
    <BrandProvider>
      <DashboardLayout>
        <Switch>
          <Route path={"/"} component={Home} />
          <Route path={"/leads"} component={LeadsPage} />
          <Route path={"/leads/:publicId"} component={LeadsPage} />
          <Route path={"/embudo"} component={PipelinePage} />
          <Route path={"/configuracion"} component={SettingsPage} />
          <Route path={"/embudos/metricas"} component={PipelineMetricsPage} />
          <Route path={"/embudos"} component={PipelinesManagerPage} />
          <Route
            path={"/embudos/:id/configurar"}
            component={PipelineSettingsPage}
          />
          <Route
            path={"/configuracion/embudo"}
            component={PipelineSettingsPage}
          />
          <Route
            path={"/configuracion/etiquetas"}
            component={LabelsManagerPage}
          />
          <Route
            path={"/configuracion/canales"}
            component={ChannelsManagerPage}
          />
          <Route path={"/automatizaciones"} component={AutomationsPage} />
          <Route
            path={"/automatizaciones/destinatarios"}
            component={AutomationRecipientsPage}
          />
          <Route path={"/email-marketing"} component={EmailMarketingPage} />
          <Route path={"/importar-exportar"} component={ImportExportPage} />
          <Route path={"/dialer"} component={DialerPage} />
          <Route path={"/phone-lists"} component={PhoneListsPage} />
          <Route path={"/phone-lists/:id"} component={PhoneListDetailPage} />
          <Route
            path={"/phone-lists/:id/dial"}
            component={PhoneListDialerPage}
          />
          <Route path={"/select-org"} component={SelectOrgPage} />
          <Route path={"/accept-invitation"} component={AcceptInvitationPage} />
          <Route path={"/404"} component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </BrandProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            {/* Rutas públicas (sin org) */}
            <Route path="/login" component={LoginPage} />
            <Route path="/accept-invitation" component={AcceptInvitationPage} />
            {/* Resto: con BrandProvider + DashboardLayout */}
            <Route>
              <ProtectedDashboardRoutes />
            </Route>
          </Switch>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
