import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, SunMedium } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ApiError, api, jsonBody } from '../lib/api';
import { Button, Field } from '../components/ui';

const initialRegistration = { firstName: '', lastName: '', email: '', phone: '', alternatePhone: '', dateOfBirth: '', gender: 'prefer_not_to_say', cnic: '', address: '', city: '', department: 'Sales', designation: '', employeeId: '', emergencyContactName: '', emergencyContactPhone: '', role: 'employee', password: '', confirmPassword: '' };

function BrandPanel() { return <div className="auth-brand"><div className="auth-brand__content"><span className="brand-kicker"><SunMedium/> Skyland Energy</span><h1>Professional solar proposals, built with confidence.</h1><p>Configure products, installation, commercial terms and approvals from one secure workspace.</p><div className="auth-trust"><span><ShieldCheck/> Role-based security</span><span><LockKeyhole/> Protected customer data</span></div></div></div>; }

export default function AuthPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { token } = useParams();
  const { login } = useAuth();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [registration, setRegistration] = useState(initialRegistration);

  const mode = pathname.startsWith('/signup') ? 'signup' : pathname.startsWith('/forgot-password') ? 'forgot' : pathname.startsWith('/reset-password') ? 'reset' : pathname.startsWith('/verify-email') ? 'verify' : 'login';

  useEffect(() => {
    if (mode !== 'verify' || !token) return;
    setBusy(true);
    api<{ message: string }>('/auth/verify-email', { method: 'POST', ...jsonBody({ token }) }).then(result => setMessage(result.message)).catch(error => setMessage(error instanceof Error ? error.message : 'Verification failed')).finally(() => setBusy(false));
  }, [mode, token]);

  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    const data = new FormData(event.currentTarget);
    try { await login(String(data.get('email')), String(data.get('password')), String(data.get('mfaCode') || '')); navigate('/dashboard'); }
    catch (error) { if (error instanceof ApiError && error.code === 'MFA_REQUIRED') setMfaRequired(true); setMessage(error instanceof Error ? error.message : 'Sign in failed'); }
    finally { setBusy(false); }
  }

  async function submitEmail(event: React.FormEvent<HTMLFormElement>, reset = false) {
    event.preventDefault(); setBusy(true); setMessage(''); const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ message: string }>(reset ? '/auth/reset-password' : '/auth/forgot-password', { method: 'POST', ...jsonBody(reset ? { token, password: data.get('password') } : { email: data.get('email') }) });
      setMessage(result.message); if (reset) window.setTimeout(() => navigate('/login'), 1500);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed'); } finally { setBusy(false); }
  }

  async function submitSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      if (registration.password !== registration.confirmPassword) throw new Error('Passwords do not match');
      const file = new FormData(event.currentTarget).get('profilePicture') as File;
      if (!file?.size) throw new Error('Choose a profile picture');
      const upload = new FormData(); upload.append('image', file); upload.append('folder', 'profiles');
      const image = await api<{ url: string }>('/uploads/registration-profile', { method: 'POST', body: upload, timeout: 30_000 });
      const { confirmPassword: _, ...body } = registration;
      const result = await api<{ message: string }>('/auth/register', { method: 'POST', ...jsonBody({ ...body, profilePicture: image.url }) });
      setMessage(result.message); notify('Registration submitted successfully', 'success');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Registration failed'); } finally { setBusy(false); }
  }

  const passwordInput = (name = 'password', label = 'Password') => <Field label={label}><div className="password-field"><input className="input" name={name} type={showPassword ? 'text' : 'password'} autoComplete={name === 'password' && mode === 'login' ? 'current-password' : 'new-password'} required minLength={10}/><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff/> : <Eye/>}</button></div></Field>;

  return <div className="auth-layout"><BrandPanel/><main className="auth-main"><div className={`auth-card ${mode === 'signup' ? 'auth-card--wide' : ''}`}>
    {mode === 'login' && <><span className="auth-icon"><LockKeyhole/></span><h2>Welcome back</h2><p>Sign in to continue to the quotation workspace.</p><form onSubmit={submitLogin} className="form-stack"><Field label="Email address"><input className="input" type="email" name="email" autoComplete="email" required/></Field>{passwordInput()}{mfaRequired && <Field label="Authenticator code"><input className="input" name="mfaCode" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus required/></Field>}{message && <div className="form-message" role="alert">{message}</div>}<Button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</Button><Link className="auth-link" to="/forgot-password">Forgot password?</Link></form><div className="auth-footer">Need access? <Link to="/signup">Request an account</Link></div></>}
    {mode === 'forgot' && <><span className="auth-icon"><Mail/></span><h2>Reset your password</h2><p>We will send instructions if an active account exists.</p><form onSubmit={event => submitEmail(event)} className="form-stack"><Field label="Email address"><input className="input" name="email" type="email" required/></Field>{message && <div className="form-message" role="status">{message}</div>}<Button disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button><Link className="auth-link" to="/login">Back to sign in</Link></form></>}
    {mode === 'reset' && <><span className="auth-icon"><LockKeyhole/></span><h2>Choose a new password</h2><p>Use at least 10 characters with upper, lower and a number.</p><form onSubmit={event => submitEmail(event, true)} className="form-stack">{passwordInput('password', 'New password')}{message && <div className="form-message" role="alert">{message}</div>}<Button disabled={busy}>Update password</Button></form></>}
    {mode === 'verify' && <><span className="auth-icon"><ShieldCheck/></span><h2>Verify your email</h2><p>{busy ? 'Checking your verification link…' : message}</p>{!busy && <Button onClick={() => navigate('/login')}>Continue to sign in</Button>}</>}
    {mode === 'signup' && <><span className="auth-icon"><ShieldCheck/></span><h2>Request team access</h2><p>Managers and employees require verified email and Super Admin approval.</p><form onSubmit={submitSignup} className="form-grid">{Object.entries({ firstName: 'First name', lastName: 'Last name', email: 'Email address', phone: 'Phone', alternatePhone: 'Alternate phone', dateOfBirth: 'Date of birth', cnic: 'CNIC', city: 'City', department: 'Department', designation: 'Designation', employeeId: 'Employee ID', emergencyContactName: 'Emergency contact name', emergencyContactPhone: 'Emergency contact phone' }).map(([name, label]) => <Field key={name} label={label}><input className="input" name={name} type={name === 'email' ? 'email' : name === 'dateOfBirth' ? 'date' : 'text'} required={!['alternatePhone','employeeId'].includes(name)} value={registration[name as keyof typeof registration]} onChange={event => setRegistration(value => ({ ...value, [name]: event.target.value }))}/></Field>)}<Field label="Gender"><select className="select" value={registration.gender} onChange={event => setRegistration(value => ({ ...value, gender: event.target.value }))}><option value="prefer_not_to_say">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field><Field label="Requested role"><select className="select" value={registration.role} onChange={event => setRegistration(value => ({ ...value, role: event.target.value }))}><option value="employee">Employee</option><option value="manager">Manager</option></select></Field><Field label="Address"><textarea className="textarea" value={registration.address} onChange={event => setRegistration(value => ({ ...value, address: event.target.value }))} required/></Field><Field label="Profile picture"><input className="file-input" type="file" name="profilePicture" accept="image/jpeg,image/png,image/webp" required/></Field><Field label="Password"><input className="input" type="password" value={registration.password} onChange={event => setRegistration(value => ({ ...value, password: event.target.value }))} required minLength={10}/></Field><Field label="Confirm password"><input className="input" type="password" value={registration.confirmPassword} onChange={event => setRegistration(value => ({ ...value, confirmPassword: event.target.value }))} required minLength={10}/></Field>{message && <div className="form-message form-grid__full" role="alert">{message}</div>}<div className="form-grid__full form-actions"><Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit access request'}</Button><Link className="auth-link" to="/login">Back to sign in</Link></div></form></>}
  </div></main></div>;
}
