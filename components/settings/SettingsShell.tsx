'use client'

import { useState, useRef }         from 'react'
import { useRouter }                from 'next/navigation'
import {
  User, Briefcase, Shield, Share2, Lock,
  Camera, CheckCircle, AlertCircle, Info,
  Eye, EyeOff,
} from 'lucide-react'
import {
  saveProfile,
  requestEmailChange,
  saveProfessionalPrefs,
  savePrivacySettings,
  saveSharingSettings,
  changePassword,
} from '@/app/actions/settings'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ['Profile', 'Preferences', 'Privacy', 'Sharing', 'Password'] as const
type Tab = typeof TABS[number]

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  'Profile':     <User size={14} />,
  'Preferences': <Briefcase size={14} />,
  'Privacy':     <Shield size={14} />,
  'Sharing':     <Share2 size={14} />,
  'Password':    <Lock size={14} />,
}

const SUBJECTS = [
  'Art & Design', 'Computing', 'Design & Technology', 'Drama',
  'English', 'Geography', 'History', 'Mathematics', 'Modern Languages',
  'Music', 'Physical Education', 'Psychology', 'Religious Studies', 'Science',
]

const ROLE_LABELS: Record<string, string> = {
  TEACHER:        'Teacher',
  HEAD_OF_DEPT:   'Head of Department',
  HEAD_OF_YEAR:   'Head of Year',
  SENCO:          'SENCo',
  SCHOOL_ADMIN:   'School Admin',
  SLT:            'Senior Leadership',
  COVER_MANAGER:  'Cover Manager',
  STUDENT:        'Student',
  PARENT:         'Parent',
  SUPER_ADMIN:    'Super Admin',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsUser = {
  id:         string
  firstName:  string
  lastName:   string
  email:      string
  role:       string
  department: string | null
  school:     { name: string }
}

type SettingsData = {
  id:                         string
  phone:                      string | null
  profilePictureUrl:          string | null
  bio:                        string | null
  defaultSubject:             string | null
  allowEmailNotifications:    boolean
  allowSmsNotifications:      boolean
  allowAnalyticsInsights:     boolean
  profileVisibleToColleagues: boolean
  profileVisibleToAdmins:     boolean
  lessonSharing:              'SCHOOL' | 'SELECTED' | 'PRIVATE'
  allowAiImprovement:         boolean
  pendingEmail:               string | null
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg
      ${ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
      {ok ? <CheckCircle size={15} className="text-green-600 shrink-0" /> : <AlertCircle size={15} className="text-red-600 shrink-0" />}
      {msg}
    </div>
  )
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${value ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function FieldError({ msg }: { msg: string }) {
  return <p className="mt-1 text-xs text-red-600 flex items-center gap-1"><AlertCircle size={11} />{msg}</p>
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function inputClass(error?: string) {
  return `block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors
    ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'}`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsShell({
  user,
  settings: initialSettings,
}: {
  user:     SettingsUser
  settings: SettingsData
}) {
  const router = useRouter()
  const [activeTab, setActiveTab]       = useState<Tab>('Profile')
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving, setSaving]             = useState(false)
  const [settings, setSettings]         = useState<SettingsData>(initialSettings)

  // ── Profile tab state ──────────────────────────────────────────────────────
  const [firstName, setFirstName]       = useState(user.firstName)
  const [lastName,  setLastName]        = useState(user.lastName)
  const [phone,     setPhone]           = useState(initialSettings.phone ?? '')
  const [bio,       setBio]             = useState(initialSettings.bio   ?? '')
  const [avatarUrl, setAvatarUrl]       = useState(initialSettings.profilePictureUrl ?? '')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [newEmail,  setNewEmail]        = useState('')
  const [showEmailForm, setShowEmailForm]     = useState(false)
  const [profileErrors, setProfileErrors]     = useState<Partial<Record<'firstName' | 'lastName' | 'phone' | 'email', string>>>({})
  const fileInputRef                    = useRef<HTMLInputElement>(null)

  // ── Professional tab state ─────────────────────────────────────────────────
  const [defaultSubject, setDefaultSubject] = useState(initialSettings.defaultSubject ?? '')

  // ── Privacy tab state ──────────────────────────────────────────────────────
  const [allowEmail,     setAllowEmail]     = useState(initialSettings.allowEmailNotifications)
  const [allowSms,       setAllowSms]       = useState(initialSettings.allowSmsNotifications)
  const [allowAnalytics, setAllowAnalytics] = useState(initialSettings.allowAnalyticsInsights)
  const [visColleagues,  setVisColleagues]  = useState(initialSettings.profileVisibleToColleagues)
  const [visAdmins,      setVisAdmins]      = useState(initialSettings.profileVisibleToAdmins)

  // ── Sharing tab state ──────────────────────────────────────────────────────
  const [sharing,    setSharing]    = useState<'SCHOOL' | 'SELECTED' | 'PRIVATE'>(initialSettings.lessonSharing)
  const [aiOptIn,    setAiOptIn]    = useState(initialSettings.allowAiImprovement)
  const [showTooltip, setShowTooltip] = useState(false)

  // ── Security tab state ────────────────────────────────────────────────────
  const [currentPw,  setCurrentPw]  = useState('')
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [pwError,    setPwError]    = useState('')
  const [pwSuccess,  setPwSuccess]  = useState(false)

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  async function wrap(fn: () => Promise<void>) {
    setSaving(true)
    try {
      await fn()
    } catch (e: any) {
      flash(e.message ?? 'Something went wrong.', false)
    } finally {
      setSaving(false)
    }
  }

  // ─── Avatar upload ───────────────────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      flash('Only JPG and PNG images are allowed.', false); return
    }
    if (file.size > 5 * 1024 * 1024) {
      flash('File must be smaller than 5 MB.', false); return
    }
    setAvatarUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/settings/avatar', { method: 'POST', body: fd })
    const json = await res.json()
    setAvatarUploading(false)
    if (!res.ok) { flash(json.error ?? 'Upload failed.', false); return }
    setAvatarUrl(json.url)
    flash('Profile picture updated.', true)
  }

  // ─── Save handlers ───────────────────────────────────────────────────────

  async function handleSaveProfile() {
    const errs: typeof profileErrors = {}
    if (!firstName.trim()) errs.firstName = 'Required'
    if (!lastName.trim())  errs.lastName  = 'Required'
    if (phone && !/^\+?[0-9\s\-(). ]{7,20}$/.test(phone.trim())) errs.phone = 'Invalid format (e.g. +44 7700 900123)'
    setProfileErrors(errs)
    if (Object.keys(errs).length) return
    await wrap(async () => {
      await saveProfile({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(), bio: bio.trim() })
      flash('Profile saved.', true)
      router.refresh()
    })
  }

  async function handleEmailChange() {
    if (!newEmail.trim()) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setProfileErrors(p => ({ ...p, email: 'Invalid email address' })); return
    }
    setProfileErrors(p => ({ ...p, email: undefined }))
    await wrap(async () => {
      await requestEmailChange(newEmail.trim())
      setSettings(s => ({ ...s, pendingEmail: newEmail.trim() }))
      setShowEmailForm(false)
      setNewEmail('')
      flash('Email change requested. Check your inbox to verify.', true)
    })
  }

  async function handleSaveProfessional() {
    await wrap(async () => {
      await saveProfessionalPrefs({ defaultSubject })
      flash('Professional preferences saved.', true)
    })
  }

  async function handleSavePrivacy() {
    await wrap(async () => {
      await savePrivacySettings({
        allowEmailNotifications: allowEmail, allowSmsNotifications: allowSms,
        allowAnalyticsInsights: allowAnalytics, profileVisibleToColleagues: visColleagues,
        profileVisibleToAdmins: visAdmins,
      })
      flash('Privacy settings saved.', true)
    })
  }

  async function handleSaveSharing() {
    await wrap(async () => {
      await saveSharingSettings({ lessonSharing: sharing, allowAiImprovement: aiOptIn })
      flash('Sharing settings saved.', true)
    })
  }

  async function handleChangePassword() {
    setPwError(''); setPwSuccess(false)
    if (!currentPw || !newPw || !confirmPw) { setPwError('All fields are required.'); return }
    await wrap(async () => {
      await changePassword({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw })
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setPwSuccess(true)
      flash('Password changed successfully.', true)
    }).catch((e: any) => {
      setPwError(e.message ?? 'Failed to change password.')
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

  return (
    <div className="max-w-3xl mx-auto py-4 sm:py-10 px-4 sm:px-6">

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Account Settings</h1>
        <p className="mt-1 text-sm text-gray-500">{user.school.name} · {ROLE_LABELS[user.role] ?? user.role}</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50">
          <Toast msg={toast.msg} ok={toast.ok} />
        </div>
      )}

      {/* Tab Bar — icon-only on mobile, icon+label on sm+ */}
      <div className="border-b border-gray-200 mb-6 sm:mb-8">
        <div className="flex gap-0 overflow-x-auto -mb-px scrollbar-none">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-[12px] font-medium border-b-2 transition-colors shrink-0
                ${activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {TAB_ICONS[tab]}
              <span className="hidden sm:inline whitespace-nowrap">{tab}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — PROFILE
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Profile' && (
        <div className="space-y-8">

          {/* Avatar */}
          <Section title="Profile Picture">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200">
                    <span className="text-blue-700 font-bold text-xl">{initials}</span>
                  </div>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 rounded-full bg-white/70 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Camera size={14} />
                  {avatarUrl ? 'Replace photo' : 'Upload photo'}
                </button>
                <p className="text-xs text-gray-400">JPG or PNG, max 5 MB</p>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleAvatarChange} />
              </div>
            </div>
          </Section>

          {/* Identity */}
          <Section title="Personal Information">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">First name *</label>
                <input
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  className={inputClass(profileErrors.firstName)}
                  placeholder="First name"
                />
                {profileErrors.firstName && <FieldError msg={profileErrors.firstName} />}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Last name *</label>
                <input
                  value={lastName} onChange={e => setLastName(e.target.value)}
                  className={inputClass(profileErrors.lastName)}
                  placeholder="Last name"
                />
                {profileErrors.lastName && <FieldError msg={profileErrors.lastName} />}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Telephone</label>
              <input
                value={phone} onChange={e => setPhone(e.target.value)}
                className={inputClass(profileErrors.phone)}
                placeholder="+44 7700 900123"
              />
              {profileErrors.phone && <FieldError msg={profileErrors.phone} />}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                value={bio} onChange={e => setBio(e.target.value)}
                rows={3}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors resize-none"
                placeholder="A short professional bio visible to colleagues..."
              />
            </div>
          </Section>

          {/* Email */}
          <Section title="Email Address" description="Changes require re-verification before taking effect.">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  {user.email}
                </div>
                <button
                  onClick={() => setShowEmailForm(!showEmailForm)}
                  className="px-4 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  Request change
                </button>
              </div>
              {settings.pendingEmail && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  <AlertCircle size={12} className="text-amber-500 shrink-0" />
                  Email change to <strong>{settings.pendingEmail}</strong> is pending verification.
                </div>
              )}
              {showEmailForm && (
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className={inputClass(profileErrors.email)}
                    placeholder="new.email@school.ac.uk"
                  />
                  {profileErrors.email && <FieldError msg={profileErrors.email} />}
                  <div className="flex gap-2">
                    <button
                      onClick={handleEmailChange}
                      disabled={saving}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      Send verification
                    </button>
                    <button
                      onClick={() => { setShowEmailForm(false); setNewEmail('') }}
                      className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Read-only fields */}
          <Section title="Account Details" description="These fields are managed by your school administrator.">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">School</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                  {user.school.name}
                </div>
              </div>
            </div>
          </Section>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — PROFESSIONAL
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Preferences' && (
        <div className="space-y-8">
          <Section title="Teaching Preferences" description="These preferences help personalise your experience on the platform.">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default subject</label>
              <select
                value={defaultSubject}
                onChange={e => setDefaultSubject(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-colors"
              >
                <option value="">— None selected —</option>
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">Used to pre-fill lesson and resource filters.</p>
            </div>
          </Section>

          <Section title="School" description="Your school assignment is managed by your administrator.">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current school</label>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                {user.school.name}
              </div>
            </div>
            {user.department && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-600">
                  {user.department}
                </div>
              </div>
            )}
          </Section>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleSaveProfessional}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — PRIVACY & NOTIFICATIONS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Privacy' && (
        <div className="space-y-8">
          <Section title="Notifications" description="Control how and when Omnis contacts you.">
            {([
              {
                label: 'Email notifications',
                desc:  'Receive email alerts for homework deadlines, grades, and messages.',
                value: allowEmail, set: setAllowEmail,
              },
              {
                label: 'SMS notifications',
                desc:  'Receive text message alerts for urgent school updates.',
                value: allowSms, set: setAllowSms,
              },
            ] as const).map(item => (
              <div key={item.label} className="flex items-start justify-between gap-6 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.desc}</p>
                </div>
                <Toggle value={item.value} onChange={item.set} />
              </div>
            ))}
          </Section>

          <Section title="Privacy" description="Manage how your profile and data are shared.">
            {([
              {
                label: 'Performance analytics',
                desc:  'Allow your anonymised teaching data to contribute to school-level insights. (GDPR: no personally identifiable information is shared.)',
                value: allowAnalytics, set: setAllowAnalytics,
              },
              {
                label: 'Visible to colleagues',
                desc:  'Allow staff within your school to see your name and profile picture.',
                value: visColleagues, set: setVisColleagues,
              },
              {
                label: 'Visible to platform administrators',
                desc:  'Allow Omnis platform administrators to access your profile for support and compliance purposes.',
                value: visAdmins, set: setVisAdmins,
              },
            ] as const).map(item => (
              <div key={item.label} className="flex items-start justify-between gap-6 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{item.desc}</p>
                </div>
                <Toggle value={item.value} onChange={item.set} />
              </div>
            ))}
          </Section>

          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 flex items-start gap-2.5">
            <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Your data is processed in accordance with UK GDPR. You can withdraw consent at any time. For queries, contact your school Data Protection Officer.</p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleSavePrivacy}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save privacy settings'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4 — LESSON SHARING & AI
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Sharing' && (
        <div className="space-y-8">
          <Section title="Lesson Sharing" description="Control who can view the lessons and resources you create.">
            <div className="space-y-3">
              {([
                { value: 'PRIVATE',  label: 'Private',          desc: 'Only you can view your lesson content.' },
                { value: 'SCHOOL',   label: 'Same school',      desc: 'All teachers in your school can view your lessons.' },
                { value: 'SELECTED', label: 'Selected users',   desc: 'Only colleagues you specifically invite can view your lessons.' },
              ] as const).map(opt => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors
                    ${sharing === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                >
                  <input
                    type="radio" name="lessonSharing" value={opt.value}
                    checked={sharing === opt.value} onChange={() => setSharing(opt.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
                  </div>
                  {opt.value === 'PRIVATE' && (
                    <span className="ml-auto text-[10px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Default</span>
                  )}
                </label>
              ))}
            </div>
          </Section>

          <Section title="AI & Data">
            <div className="flex items-start justify-between gap-6 p-4 bg-purple-50 border border-purple-100 rounded-xl">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900">AI improvement opt-in</p>
                  <div className="relative">
                    <button
                      onMouseEnter={() => setShowTooltip(true)}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Info size={13} />
                    </button>
                    {showTooltip && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 px-3 py-2.5 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-10">
                        Your lesson content is fully anonymised before use — names, classes, and school details are removed. You can withdraw consent at any time by unchecking this box.
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-gray-600">Allow anonymised lesson data to improve AI-generated suggestions for all teachers. Off by default — requires explicit consent.</p>
              </div>
              <Toggle value={aiOptIn} onChange={setAiOptIn} />
            </div>
          </Section>

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 flex items-start gap-2.5">
            <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">AI improvement data is aggregated and anonymised in compliance with UK GDPR. No lesson content, student data, or personal information is ever shared. Opt-out takes effect immediately.</p>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleSaveSharing}
              disabled={saving}
              className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save sharing settings'}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 5 — SECURITY
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'Password' && (
        <div className="space-y-8">

          {/* Change Password */}
          <Section title="Change Password" description="Use a strong password with at least 8 characters, including a letter and a number.">
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Current password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    className={inputClass(pwError ? ' ' : undefined)}
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={newPw} onChange={e => setNewPw(e.target.value)}
                  className={inputClass(pwError ? ' ' : undefined)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Confirm new password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  className={inputClass(pwError ? ' ' : undefined)}
                  placeholder="Repeat new password"
                />
              </div>

              {pwError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
                  <CheckCircle size={12} className="text-green-500 shrink-0" />
                  Password changed successfully. Use your new password next time you log in.
                </div>
              )}

              <button
                onClick={handleChangePassword}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </Section>

          {/* 2FA */}
          <Section title="Two-Factor Authentication">
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">Authenticator app (TOTP)</p>
                <p className="mt-0.5 text-xs text-gray-500">Add a second layer of security to your account.</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-400 bg-gray-200 px-2.5 py-1 rounded-full">Coming soon</span>
                <Toggle value={false} onChange={() => {}} disabled />
              </div>
            </div>
          </Section>

          {/* Active Sessions */}
          <Section title="Active Sessions">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
              <div className="flex items-start gap-2.5">
                <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                  Active session management requires server-side session storage and is planned for a future release.
                  You can sign out of all devices at any time using the &ldquo;Sign out&rdquo; option in the sidebar.
                </p>
              </div>
            </div>
          </Section>

        </div>
      )}
    </div>
  )
}
