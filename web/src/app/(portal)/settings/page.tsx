'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  User, Shield, Link2, Eye, EyeOff, Loader2, CheckCircle2,
  AlertCircle, Trash2, RefreshCw, QrCode, X,
} from 'lucide-react';
import apiClient, { getErrorMessage } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id:          string;
  fullName:    string;
  email:       string;
  dateOfBirth: string | null;
  city:        string | null;
  riskProfile: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  riskScore:   number;
  avatarUrl:   string | null;
}

interface BrokerConnection {
  broker:      string;
  connectedAt: string;
  accountId:   string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_LABELS = {
  CONSERVATIVE: { label: 'Conservative', color: 'bg-green-100 text-green-700 border-green-200' },
  MODERATE:     { label: 'Moderate',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  AGGRESSIVE:   { label: 'Aggressive',   color: 'bg-red-100 text-red-700 border-red-200' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputClass =
  'block w-full px-3.5 py-2.5 border border-border rounded-xl text-sm text-foreground ' +
  'placeholder-gray-400 bg-background-card transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-[#3C3489]/20 focus:border-[#3C3489]';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-foreground-muted">{hint}</p>}
    </div>
  );
}

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium
      ${type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
      {type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {message}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="bg-background-card rounded-2xl border border-border p-6 max-w-sm mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-foreground font-medium mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground-muted hover:bg-border/50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Password Strength ────────────────────────────────────────────────────────

const strengthLevels = [
  { label: 'Very weak', color: 'bg-red-400' },
  { label: 'Weak',      color: 'bg-orange-400' },
  { label: 'Fair',      color: 'bg-yellow-400' },
  { label: 'Good',      color: 'bg-blue-400' },
  { label: 'Strong',    color: 'bg-green-500' },
];

function passwordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12)         score++;
  return score;
}

// ─── TAB 1 — Profile ─────────────────────────────────────────────────────────

function ProfileTab({ profile, onToast }: { profile: UserProfile; onToast: (msg: string, type: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const [fullName,     setFullName]     = useState(profile.fullName);
  const [city,         setCity]         = useState(profile.city ?? '');
  const [dateOfBirth,  setDateOfBirth]  = useState(
    profile.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().split('T')[0] : ''
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.patch('/api/settings/profile', {
        fullName: fullName.trim() || undefined,
        city:     city.trim()     || undefined,
        dateOfBirth: dateOfBirth  || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-profile'] });
      onToast('Profile saved successfully', 'success');
    },
    onError: (err) => onToast(getErrorMessage(err), 'error'),
  });

  const riskStyle = RISK_LABELS[profile.riskProfile] ?? RISK_LABELS.MODERATE;
  const initials  = profile.fullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-premium-gradient flex items-center justify-center text-white text-xl font-bold shadow-md">
          {profile.avatarUrl
            ? <img src={profile.avatarUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
            : initials}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{profile.fullName}</p>
          <p className="text-xs text-foreground-muted">{profile.email}</p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <Field label="Full Name">
          <input value={fullName} onChange={e => setFullName(e.target.value)}
            className={inputClass} placeholder="Your full name" />
        </Field>

        <Field label="Email Address" hint="Email cannot be changed for security reasons">
          <input value={profile.email} readOnly
            className={`${inputClass} opacity-60 cursor-not-allowed`} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of Birth">
            <input type="date" value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
              className={inputClass}
              max={new Date().toISOString().split('T')[0]} />
          </Field>
          <Field label="City">
            <input value={city} onChange={e => setCity(e.target.value)}
              className={inputClass} placeholder="e.g. Mumbai" />
          </Field>
        </div>
      </div>

      {/* Risk Profile */}
      <div className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Risk Profile</p>
          <p className="text-xs text-foreground-muted mt-0.5">Your investment risk tolerance</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${riskStyle.color}`}>
            {riskStyle.label} · {profile.riskScore}/100
          </span>
        </div>
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                   bg-[#3C3489] hover:bg-[#2d2871] disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all flex items-center justify-center gap-2"
      >
        {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Save Changes
      </button>
    </div>
  );
}

// ─── TAB 2 — Security ────────────────────────────────────────────────────────

function SecurityTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const { data: twoFaStatus } = useQuery({
    queryKey: ['2fa-status'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: { twoFaEnabled: boolean } }>('/api/settings/2fa/status')
        .then(r => r.data.data),
    staleTime: 60_000,
  });

  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showCurrent,setShowCurrent]= useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [pwError,    setPwError]    = useState('');
  const pwStrength = passwordStrength(newPw);
  const strength   = strengthLevels[pwStrength] ?? strengthLevels[0]!;

  const changePwMutation = useMutation({
    mutationFn: () =>
      apiClient.post('/api/settings/change-password', {
        currentPassword: currentPw,
        newPassword:     newPw,
      }),
    onSuccess: () => {
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      onToast('Password updated successfully', 'success');
    },
    onError: (err) => { setPwError(getErrorMessage(err)); },
  });

  const handleChangePw = () => {
    setPwError('');
    if (!currentPw) { setPwError('Enter your current password'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    changePwMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="bg-background-card rounded-2xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Change Password</h3>

        <Field label="Current Password">
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} value={currentPw}
              onChange={e => setCurrentPw(e.target.value)}
              className={`${inputClass} pr-10`} placeholder="Current password" />
            <button type="button" onClick={() => setShowCurrent(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>

        <Field label="New Password">
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} value={newPw}
              onChange={e => setNewPw(e.target.value)}
              className={`${inputClass} pr-10`} placeholder="New password (min. 8 characters)" />
            <button type="button" onClick={() => setShowNew(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {newPw.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {strengthLevels.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < pwStrength ? strength.color : 'bg-border'}`} />
                ))}
              </div>
              <p className="text-[10px] text-foreground-muted pl-1">{strength.label}</p>
            </div>
          )}
        </Field>

        <Field label="Confirm New Password">
          <input type="password" value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            className={inputClass} placeholder="Repeat new password" />
        </Field>

        {pwError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {pwError}
          </p>
        )}

        <button onClick={handleChangePw} disabled={changePwMutation.isPending}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-[#3C3489] hover:bg-[#2d2871]
                     disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
          {changePwMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Update Password
        </button>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-background-card rounded-2xl border border-border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Two-Factor Authentication</h3>
            <p className="text-xs text-foreground-muted mt-1">
              {twoFaStatus?.twoFaEnabled
                ? 'Your account is protected with 2FA'
                : 'Add an extra layer of security to your account'}
            </p>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
            twoFaStatus?.twoFaEnabled
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            {twoFaStatus?.twoFaEnabled ? '✅ Enabled' : '❌ Disabled'}
          </span>
        </div>

        <div className="mt-4 flex gap-3">
          {!twoFaStatus?.twoFaEnabled ? (
            <button
              onClick={() => onToast('2FA setup is available in Account Security — contact support', 'success')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3C3489]/10 text-[#3C3489] text-sm font-semibold hover:bg-[#3C3489]/20 transition-colors">
              <QrCode className="w-4 h-4" /> Enable 2FA
            </button>
          ) : (
            <button
              onClick={() => onToast('To disable 2FA, please verify your TOTP code first', 'error')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200">
              <Shield className="w-4 h-4" /> Disable 2FA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB 3 — Connected Brokers ────────────────────────────────────────────────

const BROKERS = [
  { id: 'ZERODHA', name: 'Zerodha Kite', emoji: '🟢', description: 'India\'s largest stock broker' },
  { id: 'UPSTOX',  name: 'Upstox',       emoji: '🔵', description: 'Zero brokerage platform' },
];

function BrokersTab({ onToast }: { onToast: (msg: string, type: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const [confirmBroker, setConfirmBroker] = useState<string | null>(null);

  const { data: connectionsData, isLoading } = useQuery({
    queryKey: ['broker-connections'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: { connections: BrokerConnection[] } }>('/api/settings/broker-connections')
        .then(r => r.data.data),
    staleTime: 60_000,
  });

  const disconnectMutation = useMutation({
    mutationFn: (broker: string) => apiClient.delete(`/api/settings/broker-connections/${broker}`),
    onSuccess: (_, broker) => {
      queryClient.invalidateQueries({ queryKey: ['broker-connections'] });
      onToast(`${broker} disconnected`, 'success');
    },
    onError: (err) => onToast(getErrorMessage(err), 'error'),
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/holdings/sync-broker'),
    onSuccess: () => onToast('Holdings synced successfully', 'success'),
    onError:   (err) => onToast(getErrorMessage(err), 'error'),
  });

  const connections = connectionsData?.connections ?? [];

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl bg-[#3C3489]/5 border border-[#3C3489]/20 px-4 py-3 text-sm text-[#3C3489]">
        <p className="font-semibold">Broker OAuth — Coming Soon</p>
        <p className="text-xs mt-0.5 opacity-80">
          Zerodha and Upstox direct integration is in progress. For now, use manual entry or CSV import.
        </p>
      </div>

      {BROKERS.map(broker => {
        const conn = connections.find(c => c.broker === broker.id);
        return (
          <div key={broker.id} className="bg-background-card rounded-2xl border border-border p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{broker.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{broker.name}</p>
                  <p className="text-xs text-foreground-muted">{broker.description}</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
                conn
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {conn ? 'Connected' : 'Not connected'}
              </span>
            </div>

            {conn && (
              <p className="text-xs text-foreground-muted mt-2 ml-[3.25rem]">
                Connected {new Date(conn.connectedAt).toLocaleDateString('en-IN')}
              </p>
            )}

            <div className="flex gap-2 mt-4">
              {conn ? (
                <>
                  <button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#3C3489] bg-[#3C3489]/10 hover:bg-[#3C3489]/20 transition-colors disabled:opacity-60">
                    <RefreshCw className={`w-3.5 h-3.5 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                    Sync Now
                  </button>
                  <button
                    onClick={() => setConfirmBroker(broker.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200">
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onToast(`${broker.name} OAuth integration coming soon`, 'success')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#3C3489] bg-[#3C3489]/10 hover:bg-[#3C3489]/20 transition-colors">
                  <Link2 className="w-3.5 h-3.5" />
                  Connect {broker.name}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#3C3489]" />
        </div>
      )}

      {confirmBroker && (
        <ConfirmDialog
          message={`Are you sure you want to disconnect ${confirmBroker}? Holdings will remain but will no longer sync.`}
          onConfirm={() => { disconnectMutation.mutate(confirmBroker); setConfirmBroker(null); }}
          onCancel={() => setConfirmBroker(null)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'security' | 'brokers';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',  label: 'Profile',            icon: User },
  { id: 'security', label: 'Security',           icon: Shield },
  { id: 'brokers',  label: 'Connected Brokers',  icon: Link2 },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { data: profileData, isLoading, error } = useQuery({
    queryKey: ['settings-profile'],
    queryFn:  () =>
      apiClient.get<{ success: boolean; data: UserProfile }>('/api/settings/profile')
        .then(r => r.data.data),
    staleTime: 5 * 60_000,
  });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-6 h-6 animate-spin text-[#3C3489]" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-foreground-muted">
        <AlertCircle className="w-10 h-10 mb-3 text-red-400" />
        <p className="text-sm font-medium">Failed to load settings</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-foreground-muted mt-0.5">Manage your profile, security, and connected accounts</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-border/40 rounded-2xl">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all
              ${activeTab === id
                ? 'bg-background-card text-[#3C3489] shadow-sm shadow-black/5'
                : 'text-foreground-muted hover:text-foreground'}`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-background-card rounded-2xl border border-border p-6">
        {activeTab === 'profile'  && <ProfileTab  profile={profileData} onToast={showToast} />}
        {activeTab === 'security' && <SecurityTab onToast={showToast} />}
        {activeTab === 'brokers'  && <BrokersTab  onToast={showToast} />}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
