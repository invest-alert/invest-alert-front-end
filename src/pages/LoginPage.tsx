import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../lib/http";
import { useAuth } from "../providers/AuthProvider";
import { useNotice } from "../providers/NoticeProvider";

type LocationState = {
  from?: string;
};

export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, status } = useAuth();
  const { showNotice } = useNotice();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/watchlist" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await login({
        email: email.trim(),
        password
      });

      const state = location.state as LocationState | null;
      navigate(state?.from ?? "/watchlist", { replace: true });
    } catch (error) {
      showNotice(getApiErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="auth-copy">
          <p className="eyebrow">Welcome back</p>
          <h1>Log in to your investor dashboard.</h1>
          <p className="muted">
            We&apos;ll restore your watchlist, token session, and stored daily context without triggering a fresh harvest.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="StrongPass123!"
            required
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting || status === "loading"}>
            {isSubmitting ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="auth-footnote">
          New here? <Link to="/register">Create your account</Link>
        </p>
      </section>
    </div>
  );
}
