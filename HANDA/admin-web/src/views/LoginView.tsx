import { FormEvent, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function LoginView() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-identity">
        <div className="login-brand"><span className="brand-emblem brand-emblem-light"><ShieldCheck size={23} /></span><span><strong>HANDA</strong><small>COMMAND CENTER</small></span></div>
        <div className="login-intro">
          <div className="eyebrow eyebrow-light"><span className="eyebrow-rule" /> COMMUNITY RESPONSE SYSTEM</div>
          <h1>Ready when<br /><em>it matters.</em></h1>
          <p>One clear view of community readiness, evacuation capacity, and response operations.</p>
          <div className="login-assurance"><span><Check size={14} /> Verified administrator access</span><span><Check size={14} /> Secure HANDA server connection</span></div>
        </div>
        <div className="login-footer"><span>BIÑAN CITY, LAGUNA</span><span>HANDA · RESPONSE NETWORK</span></div>
      </section>

      <section className="login-form-side">
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          <div className="login-form-mark"><LockKeyhole size={19} /></div>
          <p className="eyebrow">ADMINISTRATOR ACCESS</p>
          <h2>Sign in</h2>
          <p className="login-helper">Use your authorized HANDA administrator account.</p>

          <label className="field-label" htmlFor="admin-email">Email address</label>
          <input id="admin-email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@organization.gov.ph" required />
          <label className="field-label" htmlFor="admin-password">Password</label>
          <div className="login-password-wrap">
            <input id="admin-password" className="login-password-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
            <button className="login-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="button-primary login-submit" disabled={pending} type="submit">{pending ? <><span className="button-spinner" /> Verifying access</> : <>Continue to Command Center <ArrowRight size={17} /></>}</button>
          <div className="login-security"><LockKeyhole size={13} /> Administrator access is verified by the HANDA server.</div>
        </form>
        <footer className="login-copyright">HANDA COMMUNITY DISASTER RESPONSE <span>·</span> SECURE ACCESS</footer>
      </section>
    </main>
  );
}