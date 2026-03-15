import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../lib/http";
import { useAuth } from "../providers/AuthProvider";

export function AppShell(): JSX.Element {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  async function handleLogout(): Promise<void> {
    await logout();
    navigate("/", { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <header className="app-header">
        <div className="app-header-main">
          <NavLink to="/" className="brand-link brand-link-app">
            <span className="brand-mark">IA</span>
            <div>
              <p className="eyebrow">Invest Alert</p>
              <h1>Investor signal desk</h1>
            </div>
          </NavLink>

          <nav className="app-tabs" aria-label="Primary">
            <NavLink to="/watchlist" className={({ isActive }) => `app-tab ${isActive ? "active" : ""}`}>
              Watchlist
            </NavLink>
            <NavLink to="/daily-context" className={({ isActive }) => `app-tab ${isActive ? "active" : ""}`}>
              Daily Context
            </NavLink>
          </nav>
        </div>

        <div className="app-header-tools">
          <div className="user-chip">
            <span>{user?.email ?? "Unknown user"}</span>
            <small>{API_BASE_URL}</small>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => void handleLogout()}>
            Logout
          </button>
        </div>
      </header>

      <main className="content-shell">
        <div className="page-frame">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
