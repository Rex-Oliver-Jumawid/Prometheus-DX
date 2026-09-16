import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { ApiRequestError } from '../../lib/api';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from './auth-context';
import { GoogleIcon } from './LoginPage';

const AccountSetupSchema = z
  .object({
    email: z.string().trim().email('Enter a valid invited email address.'),
    password: z.string().min(8, 'Use at least 8 characters for your password.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  });

type AccountSetupValues = z.infer<typeof AccountSetupSchema>;

export function AccountSetupPage() {
  const auth = useAuth();
  const location = useLocation();
  const invitedEmail =
    new URLSearchParams(location.search).get('email')?.trim().toLowerCase() ??
    '';
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountSetupValues>({
    defaultValues: { email: invitedEmail, password: '', confirmPassword: '' },
  });

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get('error') || query.get('error_description')) {
      setGlobalError('Account setup could not be completed. Please try again.');
    }
  }, [location.search]);

  if (auth.member) return <Navigate replace to="/" />;
  if (
    auth.session &&
    auth.memberError instanceof ApiRequestError &&
    auth.memberError.statusCode === 403
  ) {
    return <Navigate replace to="/access-denied" />;
  }

  const submit = handleSubmit(async (values) => {
    setGlobalError('');
    setSuccessMessage('');
    const parsed = AccountSetupSchema.safeParse(values);
    if (!parsed.success) {
      const fieldsWithErrors = new Set<keyof AccountSetupValues>();
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof AccountSetupValues;
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
        'Account setup is not configured. Contact your administrator.',
      );
      return;
    }

    const { data, error } = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    if (error) {
      setGlobalError(
        'Account setup could not be completed. Sign in if you already have an account, or contact your administrator.',
      );
      return;
    }

    if (!data.session) {
      setSuccessMessage(
        'Check your email to confirm the account, then sign in to finish linking your Prometheus membership.',
      );
    }
  });

  async function continueWithGoogle() {
    if (oauthLoading || isSubmitting) return;
    setGlobalError('');
    const client = getSupabaseClient();
    if (!client) {
      setGlobalError(
        'Google account setup is not configured. Contact your administrator.',
      );
      return;
    }
    setOauthLoading(true);
    const redirectTo = new URL('/account-setup', window.location.origin);
    if (invitedEmail) redirectTo.searchParams.set('email', invitedEmail);
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: invitedEmail ? { login_hint: invitedEmail } : undefined,
      },
    });
    if (error) {
      setOauthLoading(false);
      setGlobalError('Google account setup could not be started. Try again.');
    }
  }

  return (
    <main className="login-page">
      <section className="auth-panel" aria-labelledby="setup-heading">
        <div className="auth-inner">
          <div className="auth-brand">
            <img src="/auth/prometheus-mark.png" alt="" />
            <div>
              <strong>Prometheus</strong>
              <span>VIRTUAL OFFICE</span>
            </div>
          </div>
          <header className="login-header">
            <p className="auth-eyebrow">MEMBER INVITATION</p>
            <h1 id="setup-heading">Set up account</h1>
            <p>
              Use the invited email with Google or create a password. Prometheus
              links authentication to the Member record your administrator
              already created.
            </p>
          </header>
          <form
            className="login-form"
            noValidate
            onSubmit={(event) => void submit(event)}
          >
            <label className="auth-field">
              <span>INVITED EMAIL</span>
              <input
                type="email"
                autoComplete="email"
                readOnly={Boolean(invitedEmail)}
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && (
                <small role="alert">{errors.email.message}</small>
              )}
            </label>
            <label className="auth-field">
              <span>CREATE PASSWORD</span>
              <input
                type="password"
                autoComplete="new-password"
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
            {successMessage && (
              <div className="auth-success" role="status">
                {successMessage}
              </div>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={isSubmitting || oauthLoading || Boolean(successMessage)}
            >
              {isSubmitting ? 'Creating account...' : 'Create password account'}
            </button>
            <div className="auth-divider">or</div>
            <button
              className="oauth-button"
              type="button"
              disabled={oauthLoading || isSubmitting}
              onClick={() => void continueWithGoogle()}
            >
              <GoogleIcon />
              {oauthLoading ? 'Opening Google...' : 'Continue with Google'}
            </button>
            <p className="auth-helper">
              Already set up? <Link to="/login">Sign in</Link>. Only an active
              authorized Prometheus Member can enter the workspace.
            </p>
          </form>
        </div>
      </section>
      <section className="auth-art" aria-label="Prometheus artwork">
        <div className="art-caption">
          <span>AUTHORIZED / LINKED / ACTIVE</span>
          <strong>Your account, connected deliberately.</strong>
        </div>
      </section>
    </main>
  );
}
