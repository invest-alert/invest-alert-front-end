import { Link } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

export function LandingPage(): JSX.Element {
  const { isAuthenticated } = useAuth();

  return (
    <div className="marketing-page">
      <header className="marketing-header">
        <Link to="/" className="brand-link brand-link-public">
          <span className="brand-mark">IA</span>
          <div>
            <p className="eyebrow">Invest Alert</p>
            <h1>Don&apos;t tell me everything.</h1>
          </div>
        </Link>

        <nav className="marketing-nav">
          <Link to="/login" className="nav-inline">
            Login
          </Link>
          <Link to={isAuthenticated ? "/watchlist" : "/register"} className="btn btn-primary">
            {isAuthenticated ? "Open dashboard" : "Get started"}
          </Link>
        </nav>
      </header>

      <main className="marketing-main">
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Signal over noise</p>
            <h2>Tell retail investors what matters to their money, not the whole market.</h2>
            <p className="hero-text">
              Invest Alert filters stock-specific movement, context, and headlines for the companies a user actually owns.
              Built for Indian market investors across NSE and BSE.
            </p>

            <div className="hero-actions">
              <Link to={isAuthenticated ? "/daily-context" : "/register"} className="btn btn-primary">
                {isAuthenticated ? "View daily context" : "Create account"}
              </Link>
              <Link to="/watchlist" className="btn btn-ghost">
                Explore product
              </Link>
            </div>

            <div className="feature-row">
              <div className="feature-chip">JWT auth with refresh</div>
              <div className="feature-chip">Watchlist capped at 15 stocks</div>
              <div className="feature-chip">Daily context by date</div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-stat">
              <span>For Indian retail investors</span>
              <strong>NSE + BSE</strong>
            </div>
            <div className="panel-card">
              <p className="panel-label">What users see</p>
              <h3>Tata Motors Limited</h3>
              <p className="panel-meta">Price date: 2026-03-13</p>
              <p className="panel-move negative">-3.22%</p>
              <p className="panel-copy">
                Relevant headlines, backend-generated summaries, and context status all in one place.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="section-copy">
            <p className="eyebrow">Why it works</p>
            <h3>Three product surfaces, one decision flow.</h3>
          </div>
          <div className="card-grid">
            <article className="info-card">
              <h4>Landing</h4>
              <p>Sets expectations fast and explains the product clearly before asking for signup.</p>
            </article>
            <article className="info-card">
              <h4>Watchlist</h4>
              <p>Add holdings by company name or ticker, choose exchange, and keep the portfolio focused.</p>
            </article>
            <article className="info-card">
              <h4>Daily Context</h4>
              <p>Pick a date, fetch stored context, refresh manually, and monitor queued summaries without guesswork.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
