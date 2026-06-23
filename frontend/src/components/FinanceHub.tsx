import { useState, useEffect } from 'react';
import { CreditCard, TrendingUp, Wallet, Send, Plus, Eye, EyeOff, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react';
import './FinanceHub.css';

interface Account { id: number; account_name: string; account_type: string; balance: number; currency: string; is_verified: boolean; }
interface Transaction { id: number; transaction_type: string; amount: number; currency: string; description: string; category: string; status: string; created_at: string; }

type Modal = null | 'add-account' | 'send-money' | 'add-money';

export default function FinanceHub() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showBalance, setShowBalance] = useState(true);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const token = localStorage.getItem('nexus_token') || '';

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const load = async () => {
    setLoading(true);
    try {
      const [ar, tr] = await Promise.all([
        fetch('/api/accounts', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/transactions?limit=20', { headers }).then(r => r.ok ? r.json() : []),
      ]);
      setAccounts(ar || []);
      setTransactions(tr || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const currency = accounts[0]?.currency || 'INR';

  const fmt = (n: number, cur = currency) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(n);

  const openModal = (m: Modal) => { setModal(m); setForm({}); setFormError(''); };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.account_name) { setFormError('Account name required'); return; }
    setFormLoading(true);
    try {
      const res = await fetch('/api/accounts', { method: 'POST', headers, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setModal(null); load();
    } catch (err: any) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.to_identifier || !form.amount || !form.from_account_id) { setFormError('All fields required'); return; }
    setFormLoading(true);
    try {
      const res = await fetch('/api/transfer', { method: 'POST', headers, body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Transfer failed');
      setModal(null); load();
    } catch (err: any) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  const typeIcon = (type: string) => type === 'deposit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />;
  const typeColor = (type: string) => type === 'deposit' ? 'var(--success)' : 'var(--danger)';
  const typeSign = (type: string) => type === 'deposit' ? '+' : '-';

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.account_id || !form.amount || !form.card_number || !form.expiry || !form.cvv) { 
      setFormError('All payment fields are required'); return; 
    }
    // Simulate real payment gateway delay
    setFormLoading(true);
    try {
      await new Promise(r => setTimeout(r, 1500)); // Simulating Stripe API

      const res = await fetch('/api/transactions', { 
        method: 'POST', 
        headers, 
        body: JSON.stringify({ 
          account_id: parseInt(form.account_id), 
          transaction_type: 'deposit', 
          amount: parseFloat(form.amount), 
          description: 'Added funds via Card ending in ' + form.card_number.slice(-4), 
          category: 'topup' 
        }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Payment failed');
      setModal(null); load();
    } catch (err: any) { setFormError(err.message); }
    finally { setFormLoading(false); }
  };

  return (
    <div className="finance-hub">
      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {modal === 'add-account' ? 'Add Account' : 'Send Money'}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            {formError && <div className="form-error">{formError}</div>}
            {modal === 'add-account' && (
              <form onSubmit={handleAddAccount} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-field"><label>Account Name</label>
                  <input placeholder="e.g. Savings Account" value={form.account_name || ''} onChange={e => setForm({...form, account_name: e.target.value})} /></div>
                <div className="form-field"><label>Type</label>
                  <select value={form.account_type || 'checking'} onChange={e => setForm({...form, account_type: e.target.value})}>
                    {['checking','savings','investment','crypto'].map(t => <option key={t}>{t}</option>)}
                  </select></div>
                <div className="form-field"><label>Opening Balance</label>
                  <input type="number" placeholder="0.00" value={form.balance || ''} onChange={e => setForm({...form, balance: e.target.value})} /></div>
                <div className="form-field"><label>Currency</label>
                  <select value={form.currency || 'INR'} onChange={e => setForm({...form, currency: e.target.value})}>
                    {['INR','USD','GBP','EUR','AED'].map(c => <option key={c}>{c}</option>)}
                  </select></div>
                <button type="submit" className="fin-btn-primary" disabled={formLoading}>{formLoading ? 'Adding...' : 'Add Account'}</button>
              </form>
            )}
            {modal === 'send-money' && (
              <form onSubmit={handleSendMoney} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-field"><label>From Account</label>
                  <select value={form.from_account_id || ''} onChange={e => setForm({...form, from_account_id: parseInt(e.target.value)})} disabled={accounts.length === 0}>
                    <option value="">{accounts.length === 0 ? "No accounts available (Create one first!)" : "Select account"}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name} ({fmt(a.balance)})</option>)}
                  </select></div>
                <div className="form-field"><label>Recipient (email / phone / NexusID)</label>
                  <input placeholder="e.g. user@email.com" value={form.to_identifier || ''} onChange={e => setForm({...form, to_identifier: e.target.value})} /></div>
                <div className="form-field"><label>Amount</label>
                  <input type="number" placeholder="0.00" step="0.01" value={form.amount || ''} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <div className="form-field"><label>Note (optional)</label>
                  <input placeholder="What's it for?" value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} /></div>
                <button type="submit" className="fin-btn-primary" disabled={formLoading || accounts.length === 0}>{formLoading ? 'Sending...' : 'Send Money'}</button>
              </form>
            )}
            {modal === 'add-money' && (
              <form onSubmit={handleAddMoney} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Secure Payment (Simulated)</span>
                    <CreditCard size={16} color="#64748b" />
                  </div>
                  <div className="form-field"><label>Card Number</label>
                    <input placeholder="0000 0000 0000 0000" maxLength={19} value={form.card_number || ''} onChange={e => setForm({...form, card_number: e.target.value.replace(/\D/g, '')})} /></div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div className="form-field" style={{ flex: 1 }}><label>Expiry</label>
                      <input placeholder="MM/YY" maxLength={5} value={form.expiry || ''} onChange={e => setForm({...form, expiry: e.target.value})} /></div>
                    <div className="form-field" style={{ flex: 1 }}><label>CVV</label>
                      <input type="password" placeholder="123" maxLength={4} value={form.cvv || ''} onChange={e => setForm({...form, cvv: e.target.value.replace(/\D/g, '')})} /></div>
                  </div>
                </div>
                <div className="form-field"><label>To Account</label>
                  <select value={form.account_id || ''} onChange={e => setForm({...form, account_id: e.target.value})} disabled={accounts.length === 0}>
                    <option value="">{accounts.length === 0 ? "No accounts available (Create one first!)" : "Select account"}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                  </select></div>
                <div className="form-field"><label>Amount to Add</label>
                  <input type="number" placeholder="0.00" step="0.01" value={form.amount || ''} onChange={e => setForm({...form, amount: e.target.value})} /></div>
                <button type="submit" className="fin-btn-primary" disabled={formLoading || accounts.length === 0} style={{ background: accounts.length === 0 ? 'var(--bg-secondary)' : '#10b981', borderColor: accounts.length === 0 ? 'transparent' : '#059669', color: accounts.length === 0 ? 'var(--text-muted)' : 'white' }}>
                  {formLoading ? 'Processing...' : 'Pay Securely'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="finance-scroll">
        {/* Header */}
        <div className="finance-header">
          <div>
            <h1 className="finance-title">Finance Hub</h1>
            <p className="finance-subtitle">Manage accounts, transfers & transactions</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="fin-btn-outline" onClick={() => openModal('add-money')}><CreditCard size={15} /> Add Money</button>
            <button className="fin-btn-primary" onClick={() => openModal('send-money')}><Send size={15} /> Send Money</button>
          </div>
        </div>

        {/* Balance Card */}
        <div className="balance-card">
          <div className="balance-bg" />
          <div className="balance-inner">
            <div>
              <div className="balance-label">Total Balance</div>
              <div className="balance-amount">
                {showBalance ? fmt(totalBalance) : '••••••'}
                <button className="balance-eye" onClick={() => setShowBalance(!showBalance)}>
                  {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
              <div className="balance-meta">{accounts.length} account{accounts.length !== 1 ? 's' : ''} linked</div>
            </div>
            <div className="balance-stats">
              <div className="balance-stat">
                <ArrowDownLeft size={18} color="rgba(255,255,255,0.7)" />
                <div><div className="bs-label">Income</div><div className="bs-val">+{fmt(transactions.filter(t=>t.transaction_type==='deposit').reduce((s,t)=>s+t.amount,0))}</div></div>
              </div>
              <div className="balance-stat">
                <ArrowUpRight size={18} color="rgba(255,255,255,0.7)" />
                <div><div className="bs-label">Spent</div><div className="bs-val">-{fmt(transactions.filter(t=>t.transaction_type!=='deposit').reduce((s,t)=>s+t.amount,0))}</div></div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          {[
            { icon: <Send size={22} />, label: 'Send', action: () => openModal('send-money') },
            { icon: <Plus size={22} />, label: 'Add Account', action: () => openModal('add-account') },
            { icon: <TrendingUp size={22} />, label: 'Analytics', action: () => {} },
            { icon: <CreditCard size={22} />, label: 'Cards', action: () => {} },
          ].map(q => (
            <button key={q.label} className="quick-action-btn" onClick={q.action}>
              <div className="qa-icon">{q.icon}</div>
              <span>{q.label}</span>
            </button>
          ))}
        </div>

        {/* Accounts */}
        <div className="fin-section">
          <div className="fin-section-header"><h3>Your Accounts</h3></div>
          {loading ? <div className="fin-loading">Loading...</div> :
           accounts.length === 0 ? (
            <div className="fin-empty" onClick={() => openModal('add-account')}>
              <Wallet size={36} opacity={0.3} />
              <p>No accounts yet. <strong>Add one →</strong></p>
            </div>
          ) : (
            <div className="accounts-grid">
              {accounts.map(a => (
                <div key={a.id} className="account-card">
                  <div className="account-type-badge">{a.account_type}</div>
                  <div className="account-name">{a.account_name}</div>
                  <div className="account-balance">{showBalance ? fmt(a.balance, a.currency) : '••••••'}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)' }}>{a.currency}</span>
                    {a.is_verified && <span className="account-verified">✓ Verified</span>}
                  </div>
                </div>
              ))}
              <div className="account-card add-card" onClick={() => openModal('add-account')}>
                <Plus size={28} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: '0.85rem', marginTop: 8, opacity: 0.6 }}>Add Account</span>
              </div>
            </div>
          )}
        </div>

        {/* Transactions */}
        <div className="fin-section">
          <div className="fin-section-header"><h3>Recent Transactions</h3></div>
          {transactions.length === 0 ? (
            <div className="fin-empty"><TrendingUp size={36} opacity={0.3} /><p>No transactions yet</p></div>
          ) : (
            <div className="transactions-list">
              {transactions.map(tx => (
                <div key={tx.id} className="tx-row">
                  <div className="tx-icon" style={{ color: typeColor(tx.transaction_type), background: tx.transaction_type === 'deposit' ? 'rgba(45,158,92,0.1)' : 'rgba(217,48,37,0.1)' }}>
                    {typeIcon(tx.transaction_type)}
                  </div>
                  <div className="tx-info">
                    <div className="tx-desc">{tx.description || tx.transaction_type}</div>
                    <div className="tx-meta">{tx.category} · {new Date(tx.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="tx-right">
                    <div className="tx-amount" style={{ color: typeColor(tx.transaction_type) }}>
                      {typeSign(tx.transaction_type)}{fmt(tx.amount, tx.currency)}
                    </div>
                    <div className={`tx-status ${tx.status}`}>{tx.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
