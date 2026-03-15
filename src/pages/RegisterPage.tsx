import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../lib/http";
import { useAuth } from "../providers/AuthProvider";
import { useNotice } from "../providers/NoticeProvider";

export function RegisterPage(): JSX.Element {
  const navigate = useNavigate();
  const { isAuthenticated, register, status } = useAuth();
  const { showNotice } = useNotice();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/watchlist" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (password !== confirmPassword) {
      showNotice("Password and confirm password must match.", "error");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({
        email: email.trim(),
        password
      });
      navigate("/watchlist", { replace: true });
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
          <p className="eyebrow">Start simple</p>
          <h1>Create your Invest Alert account.</h1>
          <p className="muted">
            Register once and move straight into your watchlist. The app stores access and refresh tokens centrally and
            refreshes them automatically when protected requests expire.
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="user@example.com"
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="StrongPass123!"
            required
          />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="StrongPass123!"
            required
          />

          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting || status === "loading"}>
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="auth-footnote">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </section>
    </div>
  );
}
