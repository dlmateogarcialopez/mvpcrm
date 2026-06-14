import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LeadsPage from "./pages/LeadsPage";
import { PipelinePage } from "./pages/PipelinePage";
import { PipelineSettingsPage } from "./pages/PipelineSettingsPage";
import { LabelsManagerPage } from "./pages/LabelsManagerPage";
import { ChannelsManagerPage } from "./pages/ChannelsManagerPage";
import { AutomationsPage } from "./pages/AutomationsPage";
import { AutomationRecipientsPage } from "./pages/AutomationRecipientsPage";
import { EmailMarketingPage } from "./pages/EmailMarketingPage";
import SettingsPage from "./pages/SettingsPage";

function ProtectedDashboardRoutes() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/leads"} component={LeadsPage} />
        <Route path={"/embudo"} component={PipelinePage} />
        <Route path={"/configuracion"} component={SettingsPage} />
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
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

import LoginPage from "./pages/LoginPage";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/login" component={LoginPage} />
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
