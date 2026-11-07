import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { IconCircleAlert, IconLogIn } from '@/components/icons';
import { Button, InlineNotice, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { usePageTitle, useShake } from '@/lib/hooks';
import { useAuth } from '@/providers/AuthProvider';

export default function LoginPage() {
  usePageTitle('Sign in');
  const { signIn, slowServer } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const { shakeRef, shake } = useShake<HTMLFormElement>();

  const fail = (message: string) => {
    setError(message);
    shake();
    feedback.error();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) return fail('Enter your email and password.');
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      feedback.success();
    } catch (e) {
      fail(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your research network."
      footer={
        <p className="t-meta">
          New to LetResearch?{' '}
          <Link to="/register" replace className="text-link">
            Create an account
          </Link>
        </p>
      }
    >
      <form ref={shakeRef} className="col gap-14" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@university.edu"
          enterKeyHint="next"
          onSubmit={() => passwordRef.current?.focus()}
        />
        <TextField
          inputRef={passwordRef}
          label="Password"
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Your password"
          enterKeyHint="go"
        />
        {error ? (
          <InlineNotice tone="danger" icon={IconCircleAlert}>
            {error}
          </InlineNotice>
        ) : null}
        {slowServer && loading ? (
          <InlineNotice tone="info">The server is waking up. This can take up to a minute on the first visit.</InlineNotice>
        ) : null}
        <Button label="Sign in" type="submit" icon={IconLogIn} size="lg" fullWidth loading={loading} silent style={{ marginTop: 4 }} />
      </form>
    </AuthShell>
  );
}
