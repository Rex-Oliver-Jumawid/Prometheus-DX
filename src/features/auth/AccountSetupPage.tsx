import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { apiFetch, ApiRequestError } from '../../lib/api';
import { CompleteAccountSetupResponseSchema } from '../../../shared/contracts/registry';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from './auth-context';
import { GoogleIcon } from './LoginPage';

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg className="password-visibility-icon" viewBox="0 0 24 24" aria-hidden="true">
      {visible ? (
        <>
          <path d="m3 3 18 18" />
          <path d="M10.6 6.2A11.3 11.3 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.8" />
          <path d="M6.2 6.2C3.4 8 2 12 2 12s3.5 6 10 6c1 0 2-.2 2.8-.5" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
    </svg>
  );
}

const InvitedEmailSchema = z
  .string()
  .trim()
  .email('Enter a valid invited email address.');

const PasswordAccountSetupSchema = z
  .object({
    email: InvitedEmailSchema,
    password: z.string().min(8, 'Use at least 8 characters for your password.'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords must match.',
  });

type AccountSetupValues = z.infer<typeof PasswordAccountSetupSchema>;

function isGmailAddress(email: string) {
  const parsed = InvitedEmailSchema.safeParse(email);
  if (!parsed.success) return false;
  return parsed.data.toLowerCase().endsWith('@gmail.com');
}

export function AccountSetupPage() {
  const auth = useAuth();
  const location = useLocation();
  const invitedEmail =
    new URLSearchParams(location.search).get('email')?.trim().toLowerCase() ??
    '';
  const [globalError, setGlobalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AccountSetupValues>({
    defaultValues: { email: invitedEmail, password: '', confirmPassword: '' },
  });
  const setupEmail = watch('email').trim().toLowerCase();
  const usesGoogleAccountSetup = isGmailAddress(setupEmail);

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

    if (isGmailAddress(values.email)) {
      setGlobalError(
        'Gmail invitations must continue with Google using the invited address.',
      );
      return;
    }

    const parsed = PasswordAccountSetupSchema.safeParse(values);
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

    try {
      await apiFetch(
        '/registry/account-setup',
        CompleteAccountSetupResponseSchema,
        {
          method: 'POST',
          body: {
            email: parsed.data.email,
            password: parsed.data.password,
          },
        },
      );
      navigate('/login', {
        replace: true,
        state: {
          message: 'Account created. Sign in with your new password.',
          email: parsed.data.email,
        },
      });
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : 'The account could not be created. Try again.',
      );
    }
  });

  async function continueWithGoogle() {
    if (oauthLoading || isSubmitting) return;
    setGlobalError('');

    if (!isGmailAddress(setupEmail)) {
      setGlobalError(
        'Google account setup is only available for invited Gmail addresses.',
      );
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      setGlobalError(
        'Google account setup is not configured. Contact your administrator.',
      );
      return;
    }
    setOauthLoading(true);
    const redirectTo = new URL('/account-setup', window.location.origin);
    redirectTo.searchParams.set('email', setupEmail);
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { login_hint: setupEmail },
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
              {usesGoogleAccountSetup
                ? 'This invitation uses Gmail. Continue with Google using the invited address. Prometheus links that authenticated identity to the Member record your administrator already created.'
                : 'Create a password for the invited email address. Prometheus links that authenticated identity to the Member record your administrator already created.'}
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

            {!usesGoogleAccountSetup && (
              <>
                <label className="auth-field">
                  <span>CREATE PASSWORD</span>
                  <div className="password-wrap">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.password)}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((visible) => !visible)}
                    >
                      <PasswordVisibilityIcon visible={showPassword} />
                    </button>
                  </div>
                  {errors.password && (
                    <small role="alert">{errors.password.message}</small>
                  )}
                </label>
                <label className="auth-field">
                  <span>CONFIRM PASSWORD</span>
                  <div className="password-wrap">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      aria-invalid={Boolean(errors.confirmPassword)}
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                      aria-pressed={showConfirmPassword}
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                    >
                      <PasswordVisibilityIcon visible={showConfirmPassword} />
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <small role="alert">{errors.confirmPassword.message}</small>
                  )}
                </label>
              </>
            )}

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

            {usesGoogleAccountSetup ? (
              <button
                className="oauth-button"
                type="button"
                disabled={oauthLoading || isSubmitting}
                onClick={() => void continueWithGoogle()}
              >
                <GoogleIcon />
                {oauthLoading ? 'Opening Google...' : 'Continue with Google'}
              </button>
            ) : (
              <button
                className="primary-button"
                type="submit"
                disabled={
                  isSubmitting || oauthLoading || Boolean(successMessage)
                }
              >
                {isSubmitting
                  ? 'Creating account...'
                  : 'Create password account'}
              </button>
            )}

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
