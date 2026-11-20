import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError } from '../../api/client';
import { authApi } from '../../api/endpoints';
import { session, useSession } from '../../auth/session';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const current = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (current) return <Navigate to={from} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const found = {
      username: username.trim() ? undefined : 'Enter your username.',
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(found);
    if (found.username || found.password) {
      requestAnimationFrame(() => document.getElementById(found.username ? 'username' : 'password')?.focus());
      return;
    }

    setSubmitting(true);
    try {
      const { token, expiresAt } = await authApi.login(username.trim(), password);
      session.set({ token, expiresAt });
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitting(false);
      setFormError(
        err instanceof ApiError && err.status === 429
          ? 'Too many attempts. Wait a few minutes and try again.'
          : err instanceof ApiError && err.status === 401
            ? 'Wrong username or password.'
            : err instanceof Error
              ? err.message
              : 'Sign in failed.',
      );
      requestAnimationFrame(() => alertRef.current?.focus());
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-ink text-on-ink">
            <Icon name="webhook" className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold tracking-tight">Scheduler</p>
            <p className="text-sm text-muted">Discord webhooks on a schedule</p>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="card flex flex-col gap-5 p-6" aria-labelledby="login-title">
          <h1 id="login-title" className="text-xl font-semibold">
            Sign in
          </h1>

          {formError && (
            <div
              ref={alertRef}
              tabIndex={-1}
              role="alert"
              className="rounded-lg border border-danger bg-danger-soft p-3 text-sm text-danger"
            >
              <span aria-hidden="true">⚠ </span>
              {formError}
            </div>
          )}

          <Field id="username" label="Username" required error={errors.username}>
            {(control) => (
              <input
                {...control}
                type="text"
                required
                autoComplete="username"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username && e.target.value.trim()) setErrors((c) => ({ ...c, username: undefined }));
                }}
              />
            )}
          </Field>

          <Field id="password" label="Password" required error={errors.password}>
            {(control) => (
              <input
                {...control}
                type="password"
                required
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password && e.target.value) setErrors((c) => ({ ...c, password: undefined }));
                }}
              />
            )}
          </Field>

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
