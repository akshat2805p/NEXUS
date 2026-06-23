import { useState, useEffect } from 'react';
import { X, User, Shield, Puzzle, Trash2, Fingerprint, Check, LogOut, Bell } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';
import './SettingsModal.css';

interface SettingsModalProps {
  username: string;
  email: string;
  onClose: () => void;
  onLogout: () => void;
  onClearHistory: () => void;
  onStartWatchParty?: (platform: 'youtube' | 'spotify' | 'netflix' | 'prime' | 'discord') => void;
}

type Tab = 'account' | 'security' | 'notifications' | 'integrations' | 'advanced';

export default function SettingsModal({ username, email, onClose, onLogout, onClearHistory, onStartWatchParty }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const [biometricStatus, setBiometricStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [biometricMsg, setBiometricMsg] = useState('');

  const [linkedAccounts, setLinkedAccounts] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('nexus_linked_accounts');
    return saved ? JSON.parse(saved) : {};
  });

  const handleLinkAccount = (appId: string, appName: string) => {
    const id = prompt(`Enter your ${appName} ID or Email to link to Nexus:`);
    if (id) {
      const newLinks = { ...linkedAccounts, [appId]: id };
      setLinkedAccounts(newLinks);
      localStorage.setItem('nexus_linked_accounts', JSON.stringify(newLinks));
    }
  };

  const handleUnlinkAccount = (appId: string) => {
    const newLinks = { ...linkedAccounts };
    delete newLinks[appId];
    setLinkedAccounts(newLinks);
    localStorage.setItem('nexus_linked_accounts', JSON.stringify(newLinks));
  };
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const token = localStorage.getItem('nexus_token') || '';

  useEffect(() => {
    fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setSettings).catch(() => { });
  }, []);

  const updateSetting = async (key: string, value: any) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [key]: value }),
      });
    } finally { setSaving(false); }
  };

  const registerBiometric = async () => {
    setBiometricStatus('loading');
    try {
      if (!window.PublicKeyCredential) throw new Error('Biometrics not supported on this device/browser.');

      const isAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!isAvailable) throw new Error('No biometric scanner found on this device.');

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const uId = new Uint8Array(16);
      crypto.getRandomValues(uId);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: challenge,
          rp: { name: "Nexus App" },
          user: { id: uId, name: email, displayName: username },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
          attestation: "none"
        }
      });

      if (credential) {
        localStorage.setItem('nexus_biometric_enabled', 'true');
        setBiometricStatus('success');
        setBiometricMsg('Biometric registered successfully!');
      }
    } catch (err: any) {
      setBiometricStatus('error');
      setBiometricMsg(err.message || 'Setup failed. Please try again.');
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <User size={15} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'security', label: 'Security', icon: <Shield size={15} /> },
    { id: 'integrations', label: 'Integrations', icon: <Puzzle size={15} /> },
    { id: 'advanced', label: 'Advanced', icon: <Trash2 size={15} /> },
  ];

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div onClick={onChange} style={{
      width: 40, height: 22, borderRadius: 11, cursor: 'pointer', transition: 'all 0.2s',
      background: checked ? 'var(--accent-primary)' : 'var(--border-color)',
      position: 'relative', flexShrink: 0,
    }}>
      <div style={{
        position: 'absolute', top: 3, transition: 'left 0.2s',
        left: checked ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  return (
    <div className="settings-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="settings-modal">
        <div className="settings-sidebar">
          <div className="settings-title">Settings</div>
          {tabs.map(t => (
            <div key={t.id} className={`settings-nav-item ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.icon} {t.label}
            </div>
          ))}
          <div style={{ flex: 1 }} />
          <div className="settings-nav-item" onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X size={15} /> Close
          </div>
        </div>

        <div className="settings-content">
          {saving && <div style={{ position: 'absolute', top: 12, right: 20, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Saving...</div>}

          {activeTab === 'account' && (
            <div className="settings-section">
              <h2>Account</h2>
              <p className="settings-description">Your profile information.</p>
              <div className="settings-avatar-row">
                <div className="settings-avatar">{username.charAt(0).toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{username}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{email}</div>
                </div>
              </div>
              {[['Username', username], ['Email', email]].map(([l, v]) => (
                <div className="settings-field" key={l}>
                  <label>{l}</label>
                  <div className="settings-value">{v}</div>
                </div>
              ))}
              <div className="settings-field">
                <label>Account Status</label>
                <div className="settings-value"><span className="badge green">Active & Verified</span></div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && settings && (
            <div className="settings-section">
              <h2>Notifications</h2>
              <p className="settings-description">Control how and when you get notified.</p>
              {[
                { key: 'notifications_enabled', label: 'Enable Notifications', desc: 'Receive all app notifications' },
                { key: 'sound_enabled', label: 'Sound', desc: 'Play sounds for notifications' },
                { key: 'desktop_notifications', label: 'Desktop Notifications', desc: 'Show desktop alerts' },
                { key: 'new_message_notifications', label: 'New Message Alerts', desc: 'Notify on new messages' },
                { key: 'transaction_alerts', label: 'Transaction Alerts', desc: 'Alerts for payments & transfers' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="settings-toggle-row">
                  <div>
                    <div className="settings-toggle-label">{label}</div>
                    <div className="settings-toggle-desc">{desc}</div>
                  </div>
                  <Toggle checked={!!settings[key]} onChange={() => updateSetting(key, !settings[key])} />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-section">
              <h2>Security & Biometrics</h2>
              <p className="settings-description">Set up biometric login for this device.</p>
              <div className="biometric-card">
                <div className="biometric-icon"><Fingerprint size={36} color="var(--accent-primary)" /></div>
                <div className="biometric-info">
                  <div className="biometric-title">Biometric Login</div>
                  <div className="biometric-desc">Use fingerprint, FaceID, or Windows Hello to sign in.</div>
                </div>
                <button className={`primary ${biometricStatus === 'loading' ? 'loading' : ''}`}
                  onClick={registerBiometric} disabled={biometricStatus === 'loading'} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  {biometricStatus === 'success' ? <><Check size={14} /> Registered!</> : <><Fingerprint size={14} /> {biometricStatus === 'loading' ? 'Setting up...' : 'Register Biometric'}</>}
                </button>
              </div>
              {biometricMsg && (
                <div className={`settings-alert ${biometricStatus === 'success' ? 'success' : 'error'}`}>{biometricMsg}</div>
              )}
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="settings-section">
              <h2>App Integrations (Watch Parties)</h2>
              <p className="settings-description">Connect apps to experience content together with your friends in real-time.</p>
              {[
                { id: 'youtube', name: 'YouTube', iconUrl: 'https://logo.clearbit.com/youtube.com', desc: 'Watch synced videos in the chat.' },
                { id: 'spotify', name: 'Spotify', iconUrl: 'https://logo.clearbit.com/spotify.com', desc: 'Listen to music together.' },
                { id: 'netflix', name: 'Netflix', iconUrl: 'https://logo.clearbit.com/netflix.com', desc: 'Binge-watch shows together.' },
                { id: 'prime', name: 'Prime Video', iconUrl: 'https://logo.clearbit.com/primevideo.com', desc: 'Sync Prime movies.' },
                { id: 'discord', name: 'Discord', iconUrl: 'https://logo.clearbit.com/discord.com', desc: 'Voice chat integration.' },
              ].map(app => (
                <div key={app.id} className="integration-card">
                  <div className="integration-logo" style={{ background: 'transparent' }}>
                    <img src={app.iconUrl} alt={app.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                  </div>
                  <div className="integration-info">
                    <div className="integration-name">{app.name}</div>
                    <div className="integration-desc">
                      {linkedAccounts[app.id] ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                          Connected as {linkedAccounts[app.id]}
                        </span>
                      ) : (
                        app.desc
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {linkedAccounts[app.id] ? (
                      <>
                        <button
                          onClick={() => handleUnlinkAccount(app.id)}
                          className="integration-btn"
                          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                        >
                          Unlink
                        </button>
                        <button
                          onClick={() => {
                            if (onStartWatchParty) onStartWatchParty(app.id as any);
                          }}
                          className="integration-btn"
                          style={{ border: 'none', background: 'var(--accent-primary)', color: 'white', cursor: 'pointer' }}
                        >
                          Start Party
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleLinkAccount(app.id, app.name)}
                        className="integration-btn"
                        style={{ border: 'none', background: '#334155', color: 'white', cursor: 'pointer' }}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="settings-section">
              <h2>Advanced</h2>
              <p className="settings-description">Danger zone — be careful.</p>
              <div className="danger-card">
                <div>
                  <div className="danger-title">Clear Local Chat Cache</div>
                  <div className="danger-desc">Removes cached messages from your browser. Server messages are preserved.</div>
                </div>
                <button className="danger-btn" onClick={() => { onClearHistory(); onClose(); }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <Trash2 size={14} /> Clear
                </button>
              </div>
              <div className="danger-card" style={{ marginTop: 12 }}>
                <div>
                  <div className="danger-title">Sign Out</div>
                  <div className="danger-desc">Sign out of your Nexus account on this device.</div>
                </div>
                <button className="danger-btn" onClick={() => { onLogout(); onClose(); }} style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
