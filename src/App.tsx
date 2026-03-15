import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./providers/AuthProvider";
import { NoticeProvider } from "./providers/NoticeProvider";
import { DailyContextPage } from "./pages/DailyContextPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { WatchlistPage } from "./pages/WatchlistPage";

export default function App(): JSX.Element {
  return (
    <NoticeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/daily-context" element={<DailyContextPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </NoticeProvider>
  );
}
