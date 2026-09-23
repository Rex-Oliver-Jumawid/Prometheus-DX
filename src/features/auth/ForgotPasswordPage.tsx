import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { getSupabaseClient } from '../../lib/supabase';

const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your company email.')
    .email('Enter a valid email address.'),
});

type ForgotPasswordValues = z.infer<typeof ForgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [globalError, setGlobalError] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>();

  const submit = handleSubmit(async (values) => {
    setGlobalError('');
    const parsed = ForgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError('email', { message: issue?.message ?? 'Enter a valid email address.' });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setGlobalError(
        'Password recovery is not configured. Contact your administrator.',
      );
      return;
    }

    try {
      await client.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setRequestSent(true);
    } catch {
      setGlobalError(
        'Password recovery could not be started. Check your connection and try again.',
      );
    }
  });

  return (
    <main className="login-page">
      <section className="auth-panel" aria-labelledby="forgot-password-heading">
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
            <h1 id="forgot-password-heading">Reset your password</h1>
            <p>
              Enter your company email and we will send you a secure reset link.
            </p>
          </header>

          {requestSent ? (
            <div>
              <div className="auth-success" role="status">
                If an account exists for that email, a password reset link has been sent.
                Check your inbox and spam folder.
              </div>
              <p className="auth-helper">
                Did not receive it? You can submit the form again after a short wait.
              </p>
              <p className="auth-helper">
                <Link to="/login">Back to sign in</Link>
              </p>
            </div>
          ) : (
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
                    Sending link…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>

              <p className="auth-helper">
                Remembered your password? <Link to="/login">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </section>
      <section className="auth-art" aria-label="Prometheus artwork">
        <div className="art-caption">
          <span>RECOVER / RETURN / CONTINUE</span>
          <strong>Get back to the work that matters.</strong>
        </div>
      </section>
    </main>
  );
}
