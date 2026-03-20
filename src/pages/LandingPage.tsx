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
            <h1>Market intelligence</h1>
          </div>
        </Link>

        <nav className="marketing-nav">
          <Link to="/login" className="nav-inline">Sign in</Link>
          <Link to={isAuthenticated ? "/watchlist" : "/register"} className="btn btn-primary">
            {isAuthenticated ? "Open dashboard" : "Get started"}
          </Link>
        </nav>
      </header>

      <main className="marketing-main">
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Signal over noise</p>
            <h2>
              Don&apos;t tell me everything.{" "}
              <span className="accent-word">Tell me what matters.</span>
            </h2>
            <p className="hero-text">
              Invest Alert filters stock-specific news and price movement for only the companies
              you actually own. Built for Indian retail investors on NSE and BSE.
            </p>

            <div className="hero-actions">
              <Link to={isAuthenticated ? "/daily-context" : "/register"} className="btn btn-primary">
                {isAuthenticated ? "View daily context" : "Create free account"}
              </Link>
              <Link to="/login" className="btn btn-ghost">
                Sign in
              </Link>
            </div>

            <div className="feature-row">
              <div className="feature-chip">NSE + BSE</div>
              <div className="feature-chip">Up to 15 stocks</div>
              <div className="feature-chip">Daily context by date</div>
              <div className="feature-chip">Price + news in one view</div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-stat">
              <span>Covered exchanges</span>
              <strong>NSE + BSE</strong>
            </div>
            <div className="panel-card">
              <p className="panel-label">Example company card</p>
              <h3>Tata Motors Limited</h3>
              <p className="panel-meta">20 Mar 2026</p>
              <p className="panel-move negative">−3.22%</p>
              <p className="panel-copy">
                Price move, relevant headlines, and article links — all for your watchlist companies, one date at a time.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing-section">
          <div className="section-copy">
            <p className="eyebrow">How it works</p>
            <h3>Three surfaces, one decision flow.</h3>
          </div>
          <div className="card-grid">
            <article className="info-card">
              <h4>Build your watchlist</h4>
              <p>Add up to 15 companies by name or ticker. The backend resolves symbols and prevents duplicates automatically.</p>
            </article>
            <article className="info-card">
              <h4>Harvest daily context</h4>
              <p>Pick a date and fetch the latest prices and relevant news headlines for every stock in your watchlist.</p>
            </article>
            <article className="info-card">
              <h4>Read what matters</h4>
              <p>See each company&apos;s price move alongside the headlines that caused it. Click through to the full article.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
