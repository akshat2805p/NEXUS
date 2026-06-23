import { useState } from 'react';
import { Hexagon, ArrowLeft, Mail, Phone, User } from 'lucide-react';
import Loader from './Loader';
import './Auth.css';

interface AuthProps {
  onLogin: (username: string, userId: number, nexusId: string, phoneVerified: boolean) => void;
}

type Step = 'credentials' | 'email-otp' | 'phone';
type Mode = 'login' | 'signup';

const COUNTRY_CODES = [
  { code: '+91', flag: '🇮🇳', name: 'India' },
  { code: '+1',  flag: '🇺🇸', name: 'USA' },
  { code: '+44', flag: '🇬🇧', name: 'UK' },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: '+971',flag: '🇦🇪', name: 'UAE' },
  { code: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: '+49', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', flag: '🇫🇷', name: 'France' },
  { code: '+81', flag: '🇯🇵', name: 'Japan' },
  { code: '+86', flag: '🇨🇳', name: 'China' },
];

export default function Auth({ onLogin }: AuthProps) {
  const [step, setStep] = useState<Step>('credentials');
  const [mode, setMode] = useState<Mode>('login');

  // Credentials
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');

  // Phone step
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  // const [showPhoneOtp, setShowPhoneOtp] = useState(false);

  // Session (set after email OTP verify)
  const [sessionToken, setSessionToken] = useState('');
  const [sessionUserId, setSessionUserId] = useState<number>(0);
  const [sessionUsername, setSessionUsername] = useState('');
  const [sessionNexusId, setSessionNexusId] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const clearMessages = () => { setError(''); setSuccess(''); };

  // ─── Step 1: Send email OTP ───────────────────────────────────
  const requestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (mode === 'signup' && !username.trim()) {
      setError('Please choose a username');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setSuccess('OTP sent! Check your email inbox.');
      setStep('email-otp');
    } catch (err: any) {
      setError(err.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 2: Verify email OTP ────────────────────────────────
  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!code.trim() || code.trim().length < 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          username: username.trim(),
          mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP');

      // Store in localStorage
      localStorage.setItem('nexus_token', data.token);
      localStorage.setItem('nexus_user', data.username);
      localStorage.setItem('nexus_user_id', data.user_id.toString());
      localStorage.setItem('nexus_id', data.nexus_id);
      localStorage.setItem('nexus_email', email.trim().toLowerCase());

      // Save session state for phone step
      setSessionToken(data.token);
      setSessionUserId(data.user_id);
      setSessionUsername(data.username);
      setSessionNexusId(data.nexus_id);

      if (mode === 'signup' && !data.phone_verified) {
        // New user → phone verification step
        setStep('phone');
      } else {
        onLogin(data.username, data.user_id, data.nexus_id, data.phone_verified);
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3a: Send phone OTP ─────────────────────────────────
  const sendPhoneOTP = async () => {
    clearMessages();
    if (!phoneNumber.trim()) {
      setError('Enter your phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/phone/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ phone: phoneNumber.trim(), country_code: countryCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send SMS');
      setPhoneSent(true);
      setSuccess(`OTP sent to ${countryCode}${phoneNumber.trim()}`);
    } catch (err: any) {
      setError(err.message || 'SMS error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 3b: Verify phone OTP ───────────────────────────────
  const verifyPhoneOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!phoneOtp.trim() || phoneOtp.trim().length < 6) {
      setError('Enter the 6-digit SMS code');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = countryCode + phoneNumber.trim();
      const res = await fetch('/api/phone/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ phone: fullPhone, code: phoneOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid code');
      onLogin(sessionUsername, sessionUserId, sessionNexusId, true);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const skipPhone = () => {
    onLogin(sessionUsername, sessionUserId, sessionNexusId, false);
  };

  return (
    <div className="auth-container">
      {/* ── Left Brand Panel ── */}
      <div className="auth-brand-panel">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon"><Hexagon size={24} /></div>
          <span className="auth-brand-name">NEXUS</span>
        </div>
        <h1 className="auth-brand-tagline">
          Your finance.<br />Your conversations.<br />One platform.
        </h1>
        <p className="auth-brand-sub">
          Connect with people worldwide, manage your money, and collaborate — all in one secure, beautiful app.
        </p>
        <div className="auth-brand-features">
          {['Real-time global chat & voice calls', 'Peer-to-peer payments & transfers', 'Bank-grade security & biometrics', 'Works as a mobile app (APK)'].map(f => (
            <div className="auth-brand-feature" key={f}>
              <div className="auth-brand-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">

          {/* Logo (mobile) */}
          <div className="auth-logo-mobile">
            <div className="auth-logo-icon"><Hexagon size={20} /></div>
            <span className="auth-logo-text">NEXUS</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '40px 0' }}>
              <Loader />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {step === 'credentials' ? 'Sending OTP...' : step === 'email-otp' ? 'Verifying...' : 'Sending SMS...'}
              </p>
            </div>
          ) : step === 'credentials' ? (
            <>
              {/* Mode tabs */}
              <div className="auth-tabs">
                <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); clearMessages(); }}>
                  Sign In
                </button>
                <button className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); clearMessages(); }}>
                  Sign Up
                </button>
              </div>

              <div className="auth-header">
                <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                <p>{mode === 'login' ? 'Sign in to your Nexus account' : 'Join Nexus — it takes 30 seconds'}</p>
              </div>

              {error && <div className="error-message">{error}</div>}

              <form className="auth-form" onSubmit={requestOTP}>
                {mode === 'signup' && (
                  <div className="auth-field">
                    <label>Username</label>
                    <div style={{ position: 'relative' }}>
                      <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Choose a username"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        style={{ paddingLeft: 36 }}
                        autoFocus
                      />
                    </div>
                  </div>
                )}
                <div className="auth-field">
                  <label>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={{ paddingLeft: 36 }}
                      autoFocus={mode === 'login'}
                    />
                  </div>
                </div>
                <button type="submit" className="auth-submit" disabled={loading}>
                  {mode === 'login' ? 'Continue with Email' : 'Create Account'}
                </button>
              </form>

              <div className="auth-footer">
                Nexus uses secure passwordless authentication via email OTP.
              </div>
            </>

          ) : step === 'email-otp' ? (
            <>
              <div className="back-link" onClick={() => { setStep('credentials'); clearMessages(); setCode(''); }}>
                <ArrowLeft size={16} /> Back
              </div>

              <div className="auth-header">
                <h2>Check your inbox</h2>
                <p className="otp-hint">
                  We sent a 6-digit code to <span className="otp-highlight">{email}</span>
                </p>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              <form className="auth-form" onSubmit={verifyOTP}>
                <div className="auth-field">
                  <label>Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    autoFocus
                    style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.2rem', fontWeight: 700 }}
                  />
                </div>
                <button type="submit" className="auth-submit" disabled={loading}>
                  Verify & Sign In
                </button>
                <button type="button" className="ghost" onClick={requestOTP} style={{ fontSize: '0.85rem', padding: '8px' }}>
                  Resend code
                </button>
              </form>
            </>

          ) : (
            /* Phone verification step */
            <>
              <div className="auth-header" style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--accent-primary)' }}>
                  <Phone size={24} />
                </div>
                <h2>Verify your phone</h2>
                <p>Add a phone number to secure your account and enable SMS features</p>
              </div>

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              {!phoneSent ? (
                <form className="auth-form" onSubmit={e => { e.preventDefault(); sendPhoneOTP(); }}>
                  <div className="auth-field">
                    <label>Phone Number</label>
                    <div className="phone-row">
                      <select
                        className="country-code-select"
                        value={countryCode}
                        onChange={e => setCountryCode(e.target.value)}
                      >
                        {COUNTRY_CODES.map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                        ))}
                      </select>
                      <input
                        type="tel"
                        placeholder="9876543210"
                        value={phoneNumber}
                        onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        autoFocus
                      />
                    </div>
                  </div>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    <Phone size={16} /> Send SMS Code
                  </button>
                  <div className="auth-divider">or</div>
                  <button type="button" className="auth-skip" onClick={skipPhone}>
                    Skip for now
                  </button>
                </form>
              ) : (
                <form className="auth-form" onSubmit={verifyPhoneOTP}>
                  <div className="auth-field">
                    <label>SMS Verification Code</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                      Sent to {countryCode}{phoneNumber}
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={phoneOtp}
                      onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                      style={{ textAlign: 'center', letterSpacing: '0.4em', fontSize: '1.2rem', fontWeight: 700 }}
                    />
                  </div>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    Verify Phone
                  </button>
                  <button type="button" className="ghost" onClick={() => { setPhoneSent(false); setPhoneOtp(''); }} style={{ fontSize: '0.85rem', padding: '8px' }}>
                    Change number
                  </button>
                  <div className="auth-divider">or</div>
                  <button type="button" className="auth-skip" onClick={skipPhone}>
                    Skip for now
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
