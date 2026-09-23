import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { getSupabaseClient } from '../../lib/supabase';

const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters for your password.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  });

type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;
type RecoveryState = 'loading' | 'ready' | 'invalid' | 'unconfigured';

export function ResetPasswordPage() {
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('loading');
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>();

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setRecoveryState('unconfigured');
      return;
    }

    let active = true;
    const markReady = () => {
      if (!active) return;
      setRecoveryState('ready');
      if (window.location.hash || window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    };

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        if (event === 'PASSWORD_RECOVERY' && session) markReady();
      },
    );

    void client.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session) markReady();
      else setRecoveryState('invalid');
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const submit = handleSubmit(async (values) => {
    setGlobalError('');
    const parsed = ResetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      const fieldsWithErrors = new Set<keyof ResetPasswordValues>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof ResetPasswordValues;
        if (!fieldsWithErrors.has(field)) {
          fieldsWithErrors.add(field);
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setGlobalError(
        'Password recovery is not configured. Contact your administrator.',
      );
      return;
    }

    const { error } = await client.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      setGlobalError(
        'Your password could not be updated. Request a new reset link and try again.',
      );
      return;
    }

    setSuccessMessage('Your password has been updated. You can sign in with it now.');
    await client.auth.signOut({ scope: 'local' });
  });

  if (recoveryState === 'loading') {
    return (
      <main className="auth-status-page" role="status">
        <img src="/auth/prometheus-mark.png" alt="" />
        <h1>Opening password recovery…</h1>
        <p>Verifying your reset link securely.</p>
      </main>
    );
  }

  if (recoveryState !== 'ready') {
    const unconfigured = recoveryState === 'unconfigured';
    return (
      <main className="login-page">
        <section className="auth-panel" aria-labelledby="reset-unavailable-heading">
          <div className="auth-inner">
            <div className="auth-brand">
              <img src="/auth/prometheus-mark.png" alt="" />
              <div>
                <strong>Prometheus</strong>
                <span>VIRTUAL OFFICE</span>
              </div>
            </div>
            <header className="login-header">
              <p className="auth-eyebrow">PASSWORD RECOVERY</p>
              <h1 id="reset-unavailable-heading">
                {unconfigured ? 'Password recovery unavailable' : 'Reset link unavailable'}
              </h1>
              <p>
                {unconfigured
                  ? 'Password recovery is not configured for this environment.'
                  : 'This reset link is invalid, expired, or has already been used.'}
              </p>
            </header>
            <p className="auth-helper">
              <Link to="/forgot-password">Request a new reset link</Link>
            </p>
            <p className="auth-helper">
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        </section>
        <section className="auth-art" aria-label="Prometheus artwork">
          <div className="art-caption">
            <span>SECURE / VERIFIED / DELIBERATE</span>
            <strong>Start again with a fresh recovery link.</strong>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="auth-panel" aria-labelledby="reset-password-heading">
        <div className="auth-inner">
          <div className="auth-brand">
            <img src="/auth/prometheus-mark.png" alt="" />
            <div>
              <strong>Prometheus</strong>
              <span>VIRTUAL OFFICE</span>
            </div>
          </div>
          <header className="login-header">
            <p className="auth-eyebrow">PASSWORD RECOVERY</p>
            <h1 id="reset-password-heading">Choose a new password</h1>
            <p>Use a new password with at least 8 characters.</p>
          </header>

          {successMessage ? (
            <div>
              <div className="auth-success" role="status">
                {successMessage}
              </div>
              <p className="auth-helper">
                <Link to="/login">Return to sign in</Link>
              </p>
            </div>
          ) : (
            <form
              className="login-form"
              noValidate
              onSubmit={(event) => void submit(event)}
            >
              <label className="auth-field">
                <span>NEW PASSWORD</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                {errors.password && (
                  <small role="alert">{errors.password.message}</small>
                )}
              </label>
              <label className="auth-field">
                <span>CONFIRM PASSWORD</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <small role="alert">{errors.confirmPassword.message}</small>
                )}
              </label>

              {globalError && (
                <div className="auth-error" role="alert">
                  {globalError}
                </div>
              )}

              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" />
                    Updating password…
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </form>
          )}
        </div>
      </section>
      <section className="auth-art" aria-label="Prometheus artwork">
        <div className="art-caption">
          <span>RESET / SECURE / RETURN</span>
          <strong>A fresh key for the same workspace.</strong>
        </div>
      </section>
    </main>
  );
}
