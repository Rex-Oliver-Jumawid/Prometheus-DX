import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { ApiRequestError } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from './auth-context';
import { safeReturnPath } from './auth-routing';

const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your company email.')
    .email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type LoginValues = z.infer<typeof LoginSchema>;

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.875 2.684-6.614Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.181l-2.91-2.258c-.805.54-1.834.859-3.046.859-2.344 0-4.329-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.706A5.42 5.42 0 0 1 3.682 9c0-.592.102-1.167.281-1.706V4.962H.956A9 9 0 0 0 0 9c0 1.45.347 2.823.956 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.322 0 2.508.454 3.441 1.345l2.581-2.582C13.463.892 11.426 0 9 0A9 9 0 0 0 .956 4.962l3.007 2.332C4.671 5.165 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const [globalError, setGlobalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>();
  const returnTo = safeReturnPath(
    (location.state as { returnTo?: unknown } | null)?.returnTo ??
      sessionStorage.getItem('prometheus:return-to'),
  );

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const oauthError = query.get('error_description') || query.get('error');
    if (oauthError)
      setGlobalError(
        'Google sign-in could not be completed. Please try again.',
      );
  }, [location.search]);

  if (auth.member) {
    sessionStorage.removeItem('prometheus:return-to');
    return <Navigate replace to={returnTo === '/login' ? '/' : returnTo} />;
  }
  if (
    auth.session &&
    auth.memberError instanceof ApiRequestError &&
    auth.memberError.statusCode === 403
  ) {
    return <Navigate replace to="/access-denied" />;
  }

  const submit = handleSubmit(async (values) => {
    setGlobalError('');
    const parsed = LoginSchema.safeParse(values);
    if (!parsed.success) {
      const fieldsWithErrors = new Set<keyof LoginValues>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof LoginValues;
        if (!fieldsWithErrors.has(field)) {
          fieldsWithErrors.add(field);
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setGlobalError('Sign-in is not configured. Contact your administrator.');
      return;
    }
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (error)
      setGlobalError(
        'Sign-in failed. Check your email and password and try again.',
      );
  });

  async function signInWithGoogle() {
    if (oauthLoading || isSubmitting) return;
    setGlobalError('');
    const client = getSupabaseClient();
    if (!client) {
      setGlobalError(
        'Google sign-in is not configured. Contact your administrator.',
      );
      return;
    }
    setOauthLoading(true);
    sessionStorage.setItem('prometheus:return-to', returnTo);
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setOauthLoading(false);
      setGlobalError('Google sign-in could not be started. Please try again.');
    }
  }

  return (
    <main className="login-page">
      <section className="auth-panel" aria-labelledby="login-heading">
        <div className="auth-inner">
          <div className="auth-brand">
            <img src="/auth/prometheus-mark.png" alt="" />
            <div>
              <strong>Prometheus</strong>
              <span>VIRTUAL OFFICE</span>
            </div>
          </div>
          <header className="login-header">
            <p className="auth-eyebrow">WELCOME BACK</p>
            <h1 id="login-heading">Sign in</h1>
            <p>Access your workspace and continue building what matters.</p>
          </header>
          <form
            className="login-form"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <label className="auth-field">
              <span>COMPANY EMAIL</span>
              <input
                type="email"
                autoComplete="email"
                autoFocus
                aria-invalid={Boolean(errors.email)}
                placeholder="name@company.com"
                {...register('email')}
              />
              {errors.email && (
                <small role="alert">{errors.email.message}</small>
              )}
            </label>
            <label className="auth-field">
              <span>PASSWORD</span>
              <div className="password-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  placeholder="Enter your password"
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && (
                <small role="alert">{errors.password.message}</small>
              )}
            </label>
            {globalError && (
              <div className="auth-error" role="alert">
                {globalError}
              </div>
            )}
            {auth.session &&
              auth.memberError &&
              !(
                auth.memberError instanceof ApiRequestError &&
                auth.memberError.statusCode === 403
              ) && (
                <div className="auth-error" role="alert">
                  Workspace verification is unavailable.{' '}
                  <button type="button" onClick={auth.retryAuthorization}>
                    Try again
                  </button>
                </div>
              )}
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting || oauthLoading}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
            <div className="auth-divider">or</div>
            <button
              className="oauth-button"
              type="button"
              disabled={oauthLoading || isSubmitting}
              onClick={() => void signInWithGoogle()}
            >
              <GoogleIcon />
              {oauthLoading ? 'Opening Google…' : 'Continue with Google'}
            </button>
            <p className="auth-helper">
              Your access is managed by your organization. Contact your
              administrator for login assistance.
            </p>
          </form>
        </div>
      </section>
      <section className="auth-art" aria-label="Prometheus artwork">
        <div className="art-caption">
          <span>PEOPLE / WORK / PROGRESS</span>
          <strong>Bring the work into the light.</strong>
        </div>
      </section>
    </main>
  );
}
