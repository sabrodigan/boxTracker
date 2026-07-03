import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "./pages/not-found";
import AuthPage from "./pages/auth-page";
import HomePage from "./pages/home-page";
import BoxPage from "./pages/box-page";
import QrRedirectPage from "./pages/qr-redirect-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/qr/:token" component={QrRedirectPage} />
      <Route path="/" component={() => <ProtectedRoute path="/" component={HomePage} />} />
      <Route path="/box/:id" component={() => <ProtectedRoute path="/box/:id" component={BoxPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { SplashScreen } from "./components/splash-screen";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SplashScreen>
          <Router />
        </SplashScreen>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;