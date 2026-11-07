import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthShell } from '@/components/AuthShell';
import { IconCircleAlert } from '@/components/icons';
import { Button, InlineNotice, TextField } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { feedback } from '@/lib/feedback';
import { usePageTitle, useShake } from '@/lib/hooks';
import { navigate } from '@/lib/nav';
import { useAuth } from '@/providers/AuthProvider';

export default function RegisterPage() {
  usePageTitle('Create account');
  const { signUp, slowServer } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
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
    if (name.trim().length < 2) return fail('Enter your full name.');
    if (!/^\S+@\S+\.\S{2,}$/.test(email.trim())) return fail('Enter a valid email address.');
    if (password.length < 8) return fail('Use a password with at least 8 characters.');
    setError(null);
    setLoading(true);
    try {
      await signUp(name, email, password);
      feedback.success();
      navigate('/edit-profile?welcome=1', { replace: true });
    } catch (e) {
      fail(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join researchers sharing papers, data and ideas."
      footer={
        <p className="t-meta">
          Already have an account?{' '}
          <Link to="/login" replace className="text-link">
            Sign in
          </Link>
        </p>
      }
    >
      <form ref={shakeRef} className="col gap-14" onSubmit={submit} noValidate>
        <TextField
          label="Full name"
          name="name"
          value={name}
          onChange={setName}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Dr. Jane Rahman"
          enterKeyHint="next"
          onSubmit={() => emailRef.current?.focus()}
        />
        <TextField
          inputRef={emailRef}
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
          name="new-password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Use 8 or more characters."
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
        <p className="t-caption">
          LetResearch is for academic content only. By creating an account you agree to the{' '}
          <Link to="/guidelines" className="text-link">
            community guidelines
          </Link>
          .
        </p>
        <Button label="Create account" type="submit" size="lg" fullWidth loading={loading} silent style={{ marginTop: 2 }} />
      </form>
    </AuthShell>
  );
}
