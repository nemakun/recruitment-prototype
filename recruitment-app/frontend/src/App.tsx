import React, { useEffect, useMemo, useState } from 'react'

type Role = 'recruiter' | 'interviewer' | 'dept_manager' | 'tech_admin'
type Screen = 'dashboard' | 'candidates' | 'candidate-new' | 'candidate-edit' | 'admin'
type MetricPeriod = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly'
type FiscalYearStartMonth = 1 | 4 | 9
type MetricFilter = {
  month: number
  quarter: number
  half: 1 | 2
  fiscalYear: number
}

type RoleCount = {
  recruiter: number
  interviewer: number
  dept_manager: number
  tech_admin: number
}

type OrganizationStructure = {
  department: string
  sections: Array<{
    section: string
    groups: string[]
  }>
}

type User = {
  id: string
  name: string
  email: string
  role: Role
  title?: string
  department?: string
  section?: string
  group?: string
  active: boolean
  createdAt: string
  updatedAt: string
}

type Interview = {
  id: string
  round: number
  scheduledAt: string
  feedback?: {
    interviewerDecision: 'PASS' | 'FAIL'
    interviewerComment: string
    recruiterComment?: string
  }
}

type Application = {
  id: string
  department: string
  section: string
  group: string
  appliedDate: string
  firstInterviewDate?: string
  firstInterviewers: string[]
  firstInterviewResult?: 'PASS' | 'FAIL'
  firstInterviewerComment?: string
  firstRecruiterComment?: string
  firstResultNotifiedDate?: string
  finalInterviewDate?: string
  finalInterviewers: string[]
  finalInterviewResult?: 'PASS' | 'FAIL'
  finalInterviewerComment?: string
  finalRecruiterComment?: string
  finalResultNotifiedDate?: string
  status: string
  interviews: Interview[]
}

type Candidate = {
  id: string
  fullName: string
  email: string
  phone: string
  appliedRole: string
  documentUrls: string[]
  applications: Application[]
}

type BootstrapResponse = {
  mode: 'dummy'
  auth: { type: string; sso: { enabled: boolean; planned: boolean }; initialPassword: string }
  organization: { requiredHeadcount: RoleCount; currentAccounts: RoleCount; structure: OrganizationStructure[] }
  retentionPolicy: { candidateDataYears: number; auditLogYears: number; piiPolicy: string }
  settings: { fiscalYearStartMonth: FiscalYearStartMonth }
  metricFilter: MetricFilter
  metrics: {
    totalApplications: number
    passedInterviews: number
    decidedInterviews: number
    passRate: number
    medianDaysAppliedToFinalDecisionForHired: number | null
    medianDaysAppliedToFirstInterview: number | null
    medianDaysFirstInterviewToFirstResult: number | null
    medianDaysFirstResultToFinalInterview: number | null
    medianDaysFinalInterviewToFinalResult: number | null
    medianDaysAppliedToInterview: number | null
    medianDaysInterviewToNotification: number | null
    byGroup: Array<{
      department: string
      section: string
      group: string
      totalApplications: number
      passedInterviews: number
      decidedInterviews: number
      passRate: number
      medianDaysAppliedToFinalDecisionForHired: number | null
      medianDaysAppliedToFirstInterview: number | null
      medianDaysFirstInterviewToFirstResult: number | null
      medianDaysFirstResultToFinalInterview: number | null
      medianDaysFinalInterviewToFinalResult: number | null
      medianDaysAppliedToInterview: number | null
      medianDaysInterviewToNotification: number | null
    }>
    statusCounts: Record<'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED', number>
    comparison: {
      overall: {
        previousPeriod: { totalApplications: number; passRate: number }
        previousYearSamePeriod: { totalApplications: number; passRate: number }
        diff: {
          previousPeriod: { totalApplications: number; totalApplicationsRate: number | null; passRate: number }
          previousYearSamePeriod: { totalApplications: number; totalApplicationsRate: number | null; passRate: number }
        }
        trend: Array<{ label: string; totalApplications: number; passRate: number }>
      }
      byDepartment: Array<{
        department?: string
        current: { totalApplications: number; passRate: number }
        previousYearSamePeriod: { totalApplications: number; passRate: number }
        diff: { totalApplications: number; totalApplicationsRate: number | null; passRate: number }
        trend: Array<{ label: string; totalApplications: number; passRate: number }>
      }>
      bySection: Array<{
        department?: string
        section?: string
        current: { totalApplications: number; passRate: number }
        previousYearSamePeriod: { totalApplications: number; passRate: number }
        diff: { totalApplications: number; totalApplicationsRate: number | null; passRate: number }
        trend: Array<{ label: string; totalApplications: number; passRate: number }>
      }>
      byGroup: Array<{
        department?: string
        section?: string
        group?: string
        current: { totalApplications: number; passRate: number }
        previousYearSamePeriod: { totalApplications: number; passRate: number }
        diff: { totalApplications: number; totalApplicationsRate: number | null; passRate: number }
        trend: Array<{ label: string; totalApplications: number; passRate: number }>
      }>
    }
  }
  metricPeriod: MetricPeriod
  candidates: Candidate[]
}

const roleLabel: Record<Role, string> = {
  recruiter: '採用担当',
  interviewer: '面接官',
  dept_manager: '部門責任者',
  tech_admin: '技術担当'
}

const roleOptions: Role[] = ['recruiter', 'interviewer', 'dept_manager', 'tech_admin']

const inputStyle: React.CSSProperties = { width: '100%', padding: 10, border: '1px solid #c4cad6', borderRadius: 8 }
const cardStyle: React.CSSProperties = { border: '1px solid #d7dce7', borderRadius: 12, padding: 14, background: '#fff' }
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''
const apiUrl = (path: string) => `${API_BASE_URL}${path}`

function getCurrentFiscalYearStartYear(fiscalYearStartMonth: FiscalYearStartMonth) {
  const now = new Date()
  const month = now.getMonth() + 1
  return month >= fiscalYearStartMonth ? now.getFullYear() : now.getFullYear() - 1
}

function getCurrentQuarter(fiscalYearStartMonth: FiscalYearStartMonth) {
  const nowMonthIndex = new Date().getMonth()
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  const monthDiff = (nowMonthIndex - fiscalStartMonthIndex + 12) % 12
  return Math.floor(monthDiff / 3) + 1
}

function getCurrentHalf(fiscalYearStartMonth: FiscalYearStartMonth): 1 | 2 {
  const nowMonthIndex = new Date().getMonth()
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  const monthDiff = (nowMonthIndex - fiscalStartMonthIndex + 12) % 12
  return monthDiff < 6 ? 1 : 2
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loginForm, setLoginForm] = useState({ email: 'recruiter1@example.com', password: 'rec12345' })
  const [loginError, setLoginError] = useState('')

  const [data, setData] = useState<BootstrapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [metricPeriod, setMetricPeriod] = useState<MetricPeriod>('monthly')
  const [metricFilter, setMetricFilter] = useState<MetricFilter>(() => ({
    month: new Date().getMonth() + 1,
    quarter: getCurrentQuarter(4),
    half: getCurrentHalf(4),
    fiscalYear: getCurrentFiscalYearStartYear(4)
  }))
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [flash, setFlash] = useState('')

  const [candidateForm, setCandidateForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    appliedRole: '',
    documentUrl: '',
    department: '',
    section: '',
    group: '',
    appliedDate: '',
    firstInterviewDate: '',
    firstInterviewer1: '',
    firstInterviewer2: '',
    firstInterviewResult: '',
    firstInterviewerComment: '',
    firstRecruiterComment: '',
    firstResultNotifiedDate: '',
    finalInterviewDate: '',
    finalInterviewer1: '',
    finalInterviewer2: '',
    finalInterviewResult: '',
    finalInterviewerComment: '',
    finalRecruiterComment: '',
    finalResultNotifiedDate: ''
  })
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<User[]>([])
  const [accountMsg, setAccountMsg] = useState('')
  const [newAccount, setNewAccount] = useState({ name: '', email: '', role: 'interviewer' as Role, password: 'rec12345' })
  const [fiscalYearStartMonthDraft, setFiscalYearStartMonthDraft] = useState<FiscalYearStartMonth>(4)

  const canAccessAdmin = useMemo(() => {
    if (!currentUser) return false
    return currentUser.role === 'recruiter' || currentUser.role === 'tech_admin'
  }, [currentUser])

  async function login() {
    setLoginError('')
    const r = await fetch(apiUrl('/api/recruitment/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm)
    })

    if (!r.ok) {
      setLoginError('ログインに失敗しました。メールアドレスまたはパスワードを確認してください。')
      return
    }

    const payload = await r.json()
    setCurrentUser(payload.user)
    setScreen('dashboard')
    setMenuOpen(false)
    setFlash('')
  }

  async function fetchBootstrap() {
    if (!currentUser) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: metricPeriod })
      if (metricPeriod === 'monthly') params.set('targetMonth', String(metricFilter.month))
      if (metricPeriod === 'quarterly') {
        params.set('targetQuarter', String(metricFilter.quarter))
        params.set('targetFiscalYear', String(metricFilter.fiscalYear))
      }
      if (metricPeriod === 'halfyearly') {
        params.set('targetHalf', String(metricFilter.half))
        params.set('targetFiscalYear', String(metricFilter.fiscalYear))
      }
      if (metricPeriod === 'yearly') params.set('targetFiscalYear', String(metricFilter.fiscalYear))

      const r = await fetch(apiUrl(`/api/recruitment/bootstrap?${params.toString()}`))
      const next = await r.json()
      setData(next)
      if (next?.settings?.fiscalYearStartMonth) {
        setFiscalYearStartMonthDraft(next.settings.fiscalYearStartMonth as FiscalYearStartMonth)
      }
      if (next?.metricFilter) {
        setMetricFilter(next.metricFilter as MetricFilter)
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchAccounts() {
    if (!currentUser || !canAccessAdmin) return
    const r = await fetch(apiUrl(`/api/recruitment/admin/accounts?actorId=${currentUser.id}`))
    if (!r.ok) {
      setAccountMsg('アカウント一覧の取得に失敗しました。')
      return
    }
    const payload = await r.json()
    setAccounts(payload.accounts || [])
  }

  useEffect(() => {
    fetchBootstrap()
  }, [currentUser, metricPeriod, metricFilter.month, metricFilter.quarter, metricFilter.half, metricFilter.fiscalYear])

  useEffect(() => {
    fetchAccounts()
  }, [currentUser, canAccessAdmin])

  useEffect(() => {
    if (screen === 'admin' && !canAccessAdmin) {
      setFlash('管理者画面は採用担当者または技術部門担当者のみアクセスできます。')
      setScreen('dashboard')
    }
  }, [screen, canAccessAdmin])

  function goTo(next: Screen) {
    if (next === 'admin' && !canAccessAdmin) {
      setFlash('管理者画面は採用担当者または技術部門担当者のみアクセスできます。')
      setScreen('dashboard')
      setMenuOpen(false)
      return
    }
    setFlash('')
    setScreen(next)
    setMenuOpen(false)
  }

  function openNewCandidate() {
    const firstDepartment = data?.organization.structure[0]
    const firstSection = firstDepartment?.sections[0]
    const firstGroup = firstSection?.groups[0]
    setCandidateForm({
      fullName: '',
      email: '',
      phone: '',
      appliedRole: '',
      documentUrl: '',
      department: firstDepartment?.department || '',
      section: firstSection?.section || '',
      group: firstGroup || '',
      appliedDate: new Date().toISOString().slice(0, 10),
      firstInterviewDate: '',
      firstInterviewer1: '',
      firstInterviewer2: '',
      firstInterviewResult: '',
      firstInterviewerComment: '',
      firstRecruiterComment: '',
      firstResultNotifiedDate: '',
      finalInterviewDate: '',
      finalInterviewer1: '',
      finalInterviewer2: '',
      finalInterviewResult: '',
      finalInterviewerComment: '',
      finalRecruiterComment: '',
      finalResultNotifiedDate: ''
    })
    setEditingCandidateId(null)
    setScreen('candidate-new')
  }

  function openEditCandidate(candidate: Candidate) {
    setCandidateForm({
      fullName: candidate.fullName,
      email: candidate.email,
      phone: candidate.phone,
      appliedRole: candidate.appliedRole,
      documentUrl: candidate.documentUrls[0] || '',
      department: candidate.applications[0]?.department || '',
      section: candidate.applications[0]?.section || '',
      group: candidate.applications[0]?.group || '',
      appliedDate: candidate.applications[0]?.appliedDate || '',
      firstInterviewDate: candidate.applications[0]?.firstInterviewDate || '',
      firstInterviewer1: candidate.applications[0]?.firstInterviewers?.[0] || '',
      firstInterviewer2: candidate.applications[0]?.firstInterviewers?.[1] || '',
      firstInterviewResult: candidate.applications[0]?.firstInterviewResult || '',
      firstInterviewerComment: candidate.applications[0]?.firstInterviewerComment || '',
      firstRecruiterComment: candidate.applications[0]?.firstRecruiterComment || '',
      firstResultNotifiedDate: candidate.applications[0]?.firstResultNotifiedDate || '',
      finalInterviewDate: candidate.applications[0]?.finalInterviewDate || '',
      finalInterviewer1: candidate.applications[0]?.finalInterviewers?.[0] || '',
      finalInterviewer2: candidate.applications[0]?.finalInterviewers?.[1] || '',
      finalInterviewResult: candidate.applications[0]?.finalInterviewResult || '',
      finalInterviewerComment: candidate.applications[0]?.finalInterviewerComment || '',
      finalRecruiterComment: candidate.applications[0]?.finalRecruiterComment || '',
      finalResultNotifiedDate: candidate.applications[0]?.finalResultNotifiedDate || ''
    })
    setEditingCandidateId(candidate.id)
    setScreen('candidate-edit')
  }

  async function submitCandidateForm() {
    if (!candidateForm.fullName || !candidateForm.email || !candidateForm.phone || !candidateForm.appliedRole) {
      alert('氏名、メール、電話、応募職種は必須です。')
      return
    }

    const body = {
      fullName: candidateForm.fullName,
      email: candidateForm.email,
      phone: candidateForm.phone,
      appliedRole: candidateForm.appliedRole,
      documentUrls: candidateForm.documentUrl ? [candidateForm.documentUrl] : [],
      applications: [{
        department: candidateForm.department || '未設定',
        section: candidateForm.section || '未設定',
        group: candidateForm.group || '未設定',
        appliedDate: candidateForm.appliedDate,
        firstInterviewDate: candidateForm.firstInterviewDate,
        firstInterviewers: [candidateForm.firstInterviewer1, candidateForm.firstInterviewer2].filter(v => !!v).slice(0, 2),
        firstInterviewResult: candidateForm.firstInterviewResult,
        firstInterviewerComment: candidateForm.firstInterviewerComment,
        firstRecruiterComment: candidateForm.firstRecruiterComment,
        firstResultNotifiedDate: candidateForm.firstResultNotifiedDate,
        finalInterviewDate: candidateForm.finalInterviewDate,
        finalInterviewers: [candidateForm.finalInterviewer1, candidateForm.finalInterviewer2].filter(v => !!v).slice(0, 2),
        finalInterviewResult: candidateForm.finalInterviewResult,
        finalInterviewerComment: candidateForm.finalInterviewerComment,
        finalRecruiterComment: candidateForm.finalRecruiterComment,
        finalResultNotifiedDate: candidateForm.finalResultNotifiedDate
      }]
    }

    const r = editingCandidateId
      ? await fetch(apiUrl(`/api/recruitment/candidates/${editingCandidateId}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch(apiUrl('/api/recruitment/candidates'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })

    if (!r.ok) {
      alert('保存に失敗しました。入力内容を確認してください。')
      return
    }

    await fetchBootstrap()
    setScreen('candidates')
  }

  function cancelCandidateForm() {
    setScreen('candidates')
  }

  async function createAccount() {
    if (!currentUser) return
    if (!newAccount.name || !newAccount.email || !newAccount.role) {
      setAccountMsg('追加には氏名、メール、ロールが必要です。')
      return
    }

    const r = await fetch(apiUrl('/api/recruitment/admin/accounts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: currentUser.id,
        name: newAccount.name,
        email: newAccount.email,
        role: newAccount.role,
        password: newAccount.password || 'rec12345'
      })
    })

    if (!r.ok) {
      const payload = await r.json().catch(() => ({ error: 'アカウント追加に失敗しました。' }))
      setAccountMsg(payload.error || 'アカウント追加に失敗しました。')
      return
    }

    setNewAccount({ name: '', email: '', role: 'interviewer', password: 'rec12345' })
    setAccountMsg('アカウントを追加しました。')
    fetchAccounts()
    fetchBootstrap()
  }

  async function saveAccount(account: User, password?: string) {
    if (!currentUser) return
    const r = await fetch(apiUrl(`/api/recruitment/admin/accounts/${account.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: currentUser.id,
        name: account.name,
        email: account.email,
        role: account.role,
        active: account.active,
        password: password || undefined
      })
    })

    if (!r.ok) {
      const payload = await r.json().catch(() => ({ error: '更新に失敗しました。' }))
      setAccountMsg(payload.error || '更新に失敗しました。')
      return
    }

    setAccountMsg('アカウントを更新しました。')
    fetchAccounts()
    fetchBootstrap()
  }

  async function saveFiscalYearSetting() {
    if (!currentUser) return
    const r = await fetch(apiUrl('/api/recruitment/admin/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actorId: currentUser.id,
        fiscalYearStartMonth: fiscalYearStartMonthDraft
      })
    })

    if (!r.ok) {
      const payload = await r.json().catch(() => ({ error: '年度設定の更新に失敗しました。' }))
      setAccountMsg(payload.error || '年度設定の更新に失敗しました。')
      return
    }

    setAccountMsg('年度設定を更新しました。')
    const nextFiscalStart = fiscalYearStartMonthDraft
    setMetricFilter((prev) => ({
      ...prev,
      quarter: getCurrentQuarter(nextFiscalStart),
      half: getCurrentHalf(nextFiscalStart),
      fiscalYear: getCurrentFiscalYearStartYear(nextFiscalStart)
    }))
    fetchBootstrap()
  }

  function handleMetricPeriodChange(nextPeriod: MetricPeriod) {
    setMetricPeriod(nextPeriod)
    const fiscalStart = data?.settings.fiscalYearStartMonth || fiscalYearStartMonthDraft
    setMetricFilter((prev) => ({
      ...prev,
      month: new Date().getMonth() + 1,
      quarter: getCurrentQuarter(fiscalStart),
      half: getCurrentHalf(fiscalStart),
      fiscalYear: getCurrentFiscalYearStartYear(fiscalStart)
    }))
  }

  if (!currentUser) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', background: '#eef3fb', minHeight: '100vh' }}>
        <h1 style={{ marginBottom: 6 }}>採用管理 WEBアプリ（プロトタイプ）</h1>
        <div style={{ color: '#555', marginBottom: 16 }}>初期パスワード: <code>rec12345</code></div>
        <div style={{ ...cardStyle, maxWidth: 420 }}>
          <h3>ログイン</h3>
          <input
            style={{ ...inputStyle, marginBottom: 8 }}
            placeholder="メールアドレス"
            value={loginForm.email}
            onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
          />
          <input
            style={{ ...inputStyle, marginBottom: 8 }}
            type="password"
            placeholder="パスワード"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
          />
          <button onClick={login}>ログイン</button>
          {loginError && <div style={{ color: '#b00020', marginTop: 8 }}>{loginError}</div>}
          <div style={{ marginTop: 12, fontSize: 13, color: '#555' }}>例: recruiter1@example.com / rec12345</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#eef3fb', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#17345f', color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => setMenuOpen(v => !v)} style={{ fontSize: 22, lineHeight: 1, background: '#fff', border: 0, borderRadius: 6, width: 38, height: 34 }}>
          ☰
        </button>
        <strong>採用管理</strong>
        <div style={{ marginLeft: 'auto' }}>{currentUser.name}（{roleLabel[currentUser.role]}）</div>
        <button onClick={() => setCurrentUser(null)}>ログアウト</button>
      </header>

      <div style={{ position: 'relative' }}>
        {menuOpen && (
          <>
            <div
              onClick={() => setMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.2)',
                zIndex: 20
              }}
            />
            <aside
              style={{
                position: 'fixed',
                top: 54,
                left: 0,
                width: 230,
                height: 'calc(100vh - 54px)',
                background: '#fff',
                borderRight: '1px solid #d7dce7',
                padding: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 30
              }}
            >
              <NavButton label="ダッシュボード" onClick={() => goTo('dashboard')} />
              <NavButton label="候補者" onClick={() => goTo('candidates')} />
              <NavButton label="管理者画面" onClick={() => goTo('admin')} />
            </aside>
          </>
        )}

        <main style={{ padding: 16 }}>
          {flash && <div style={{ ...cardStyle, marginBottom: 12, border: '1px solid #ff9f9f', background: '#fff3f3', color: '#b00020' }}>{flash}</div>}
          {loading && <div>読み込み中...</div>}

          {!loading && data && screen === 'dashboard' && (
            <DashboardView
              data={data}
              metricPeriod={metricPeriod}
              metricFilter={metricFilter}
              onChangeMetricPeriod={handleMetricPeriodChange}
              onChangeMetricFilter={setMetricFilter}
            />
          )}

          {!loading && data && screen === 'candidates' && (
            <CandidatesView data={data} onNew={openNewCandidate} onEdit={openEditCandidate} />
          )}

          {!loading && data && (screen === 'candidate-new' || screen === 'candidate-edit') && (
            <CandidateFormView
              mode={screen === 'candidate-new' ? 'new' : 'edit'}
              organizationStructure={data.organization.structure}
              form={candidateForm}
              setForm={setCandidateForm}
              onSubmit={submitCandidateForm}
              onCancel={cancelCandidateForm}
            />
          )}

          {!loading && data && screen === 'admin' && (
            <AdminView
              organization={data.organization}
              fiscalYearStartMonth={fiscalYearStartMonthDraft}
              setFiscalYearStartMonth={setFiscalYearStartMonthDraft}
              onSaveFiscalYearSetting={saveFiscalYearSetting}
              accounts={accounts}
              accountMsg={accountMsg}
              newAccount={newAccount}
              setNewAccount={setNewAccount}
              onCreate={createAccount}
              onSave={saveAccount}
            />
          )}
        </main>
      </div>
    </div>
  )
}

function NavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 8, borderRadius: 8, border: '1px solid #d7dce7', background: '#f8faff' }}
    >
      {label}
    </button>
  )
}

function DashboardView({
  data,
  metricPeriod,
  metricFilter,
  onChangeMetricPeriod,
  onChangeMetricFilter
}: {
  data: BootstrapResponse
  metricPeriod: MetricPeriod
  metricFilter: MetricFilter
  onChangeMetricPeriod: (period: MetricPeriod) => void
  onChangeMetricFilter: React.Dispatch<React.SetStateAction<MetricFilter>>
}) {
  const statusCounts = data.metrics.statusCounts
  const maxStatus = Math.max(1, ...Object.values(statusCounts))
  const byGroupSorted = [...data.metrics.byGroup].sort((a, b) => b.totalApplications - a.totalApplications)
  const topGroupMax = Math.max(1, ...(byGroupSorted.map(g => g.totalApplications)))

  type Slice = { label: string; value: number }

  function buildDepartmentSlices(mode: 'applications' | 'passRate'): Slice[] {
    const map = new Map<string, { total: number; passed: number; decided: number }>()
    for (const g of data.metrics.byGroup) {
      if (!map.has(g.department)) map.set(g.department, { total: 0, passed: 0, decided: 0 })
      const item = map.get(g.department)!
      item.total += g.totalApplications
      item.passed += g.passedInterviews
      item.decided += g.decidedInterviews
    }
    return Array.from(map.entries()).map(([label, v]) => ({
      label,
      value: mode === 'applications' ? v.total : (v.decided > 0 ? Number(((v.passed / v.decided) * 100).toFixed(1)) : 0)
    }))
  }

  function buildSectionSlicesByDepartment(mode: 'applications' | 'passRate') {
    const deptMap = new Map<string, Map<string, { total: number; passed: number; decided: number }>>()
    for (const g of data.metrics.byGroup) {
      if (!deptMap.has(g.department)) deptMap.set(g.department, new Map())
      const secMap = deptMap.get(g.department)!
      if (!secMap.has(g.section)) secMap.set(g.section, { total: 0, passed: 0, decided: 0 })
      const item = secMap.get(g.section)!
      item.total += g.totalApplications
      item.passed += g.passedInterviews
      item.decided += g.decidedInterviews
    }
    return Array.from(deptMap.entries()).map(([department, sections]) => ({
      department,
      overallValue:
        mode === 'applications'
          ? Array.from(sections.values()).reduce((acc, v) => acc + v.total, 0)
          : (() => {
              const passed = Array.from(sections.values()).reduce((acc, v) => acc + v.passed, 0)
              const decided = Array.from(sections.values()).reduce((acc, v) => acc + v.decided, 0)
              return decided > 0 ? Number(((passed / decided) * 100).toFixed(1)) : 0
            })(),
      slices: Array.from(sections.entries()).map(([label, v]) => ({
        label,
        value: mode === 'applications' ? v.total : (v.decided > 0 ? Number(((v.passed / v.decided) * 100).toFixed(1)) : 0)
      }))
    }))
  }

  function buildGroupSlicesBySection(mode: 'applications' | 'passRate') {
    const sectionMap = new Map<string, { department: string; section: string; passed: number; decided: number; total: number; items: Slice[] }>()
    for (const g of data.metrics.byGroup) {
      const key = `${g.department}::${g.section}`
      if (!sectionMap.has(key)) {
        sectionMap.set(key, { department: g.department, section: g.section, passed: 0, decided: 0, total: 0, items: [] })
      }
      const item = sectionMap.get(key)!
      item.total += g.totalApplications
      item.passed += g.passedInterviews
      item.decided += g.decidedInterviews
      item.items.push({
        label: g.group,
        value: mode === 'applications' ? g.totalApplications : g.passRate
      })
    }
    return Array.from(sectionMap.values()).map((v) => ({
      ...v,
      overallValue:
        mode === 'applications'
          ? v.total
          : (v.decided > 0 ? Number(((v.passed / v.decided) * 100).toFixed(1)) : 0)
    }))
  }

  const deptApplications = buildDepartmentSlices('applications')
  const deptPassRate = buildDepartmentSlices('passRate')
  const sectionApplications = buildSectionSlicesByDepartment('applications')
  const sectionPassRate = buildSectionSlicesByDepartment('passRate')
  const groupApplications = buildGroupSlicesBySection('applications')
  const groupPassRate = buildGroupSlicesBySection('passRate')
  const currentFiscalYear = getCurrentFiscalYearStartYear(data.settings.fiscalYearStartMonth)
  const fiscalYearOptions = [currentFiscalYear, currentFiscalYear - 1, currentFiscalYear - 2]
  const overallComparison = data.metrics.comparison.overall

  function formatSigned(value: number, suffix = '') {
    const sign = value > 0 ? '+' : ''
    return `${sign}${Number(value.toFixed(1))}${suffix}`
  }

  const byDepartmentComparison = [...data.metrics.comparison.byDepartment].sort((a, b) =>
    (a.department || '').localeCompare(b.department || '', 'ja')
  )
  const bySectionComparison = [...data.metrics.comparison.bySection].sort((a, b) =>
    `${a.department || ''}::${a.section || ''}`.localeCompare(`${b.department || ''}::${b.section || ''}`, 'ja')
  )
  const byGroupComparison = [...data.metrics.comparison.byGroup].sort((a, b) =>
    `${a.department || ''}::${a.section || ''}::${a.group || ''}`.localeCompare(`${b.department || ''}::${b.section || ''}::${b.group || ''}`, 'ja')
  )

  return (
    <>
      <div style={{ ...cardStyle, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700 }}>集計期間</div>
        <select style={{ ...inputStyle, maxWidth: 220 }} value={metricPeriod} onChange={(e) => onChangeMetricPeriod(e.target.value as MetricPeriod)}>
          <option value="monthly">月次</option>
          <option value="quarterly">四半期</option>
          <option value="halfyearly">半期</option>
          <option value="yearly">年次</option>
        </select>
        <div style={{ fontWeight: 700, marginLeft: 8 }}>絞り込み条件</div>
        {metricPeriod === 'monthly' && (
          <select
            style={{ ...inputStyle, maxWidth: 220 }}
            value={String(metricFilter.month)}
            onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, month: Number(e.target.value) }))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
        )}
        {metricPeriod === 'quarterly' && (
          <>
            <select
              style={{ ...inputStyle, maxWidth: 220 }}
              value={String(metricFilter.quarter)}
              onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, quarter: Number(e.target.value) }))}
            >
              <option value="1">第1クォーター</option>
              <option value="2">第2クォーター</option>
              <option value="3">第3クォーター</option>
              <option value="4">第4クォーター</option>
            </select>
            <select
              style={{ ...inputStyle, maxWidth: 220 }}
              value={String(metricFilter.fiscalYear)}
              onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, fiscalYear: Number(e.target.value) }))}
            >
              {fiscalYearOptions.map((y) => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </>
        )}
        {metricPeriod === 'halfyearly' && (
          <>
            <select
              style={{ ...inputStyle, maxWidth: 220 }}
              value={String(metricFilter.half)}
              onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, half: Number(e.target.value) as 1 | 2 }))}
            >
              <option value="1">上期</option>
              <option value="2">下期</option>
            </select>
            <select
              style={{ ...inputStyle, maxWidth: 220 }}
              value={String(metricFilter.fiscalYear)}
              onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, fiscalYear: Number(e.target.value) }))}
            >
              {fiscalYearOptions.map((y) => (
                <option key={y} value={y}>{y}年度</option>
              ))}
            </select>
          </>
        )}
        {metricPeriod === 'yearly' && (
          <select
            style={{ ...inputStyle, maxWidth: 220 }}
            value={String(metricFilter.fiscalYear)}
            onChange={(e) => onChangeMetricFilter((prev) => ({ ...prev, fiscalYear: Number(e.target.value) }))}
          >
            {fiscalYearOptions.map((y) => (
              <option key={y} value={y}>{y}年度</option>
            ))}
          </select>
        )}
        <div style={{ fontSize: 12, color: '#556', marginLeft: 'auto' }}>
          年度設定: {data.settings.fiscalYearStartMonth === 4 ? '4月始まり（3月締め）' : data.settings.fiscalYearStartMonth === 1 ? '1月始まり（12月締め）' : '9月始まり（8月締め）'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 14 }}>
        <MetricCard title="応募数" value={String(data.metrics.totalApplications)} />
        <MetricCard title="通過率（面接）" value={`${data.metrics.passRate}%`} />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: 14 }}>
        <div style={cardStyle}>
          <div style={{ color: '#4f5b70', marginBottom: 8 }}>応募数 比較</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{data.metrics.totalApplications}</div>
          <div style={{ fontSize: 13, color: overallComparison.diff.previousYearSamePeriod.totalApplications >= 0 ? '#0f9f62' : '#b00020' }}>
            前年同期比: {formatSigned(overallComparison.diff.previousYearSamePeriod.totalApplications)} 件
            {' '}({overallComparison.diff.previousYearSamePeriod.totalApplicationsRate === null ? '-' : `${formatSigned(overallComparison.diff.previousYearSamePeriod.totalApplicationsRate, '%')}`})
          </div>
          <div style={{ fontSize: 13, color: overallComparison.diff.previousPeriod.totalApplications >= 0 ? '#0f9f62' : '#b00020' }}>
            前期比: {formatSigned(overallComparison.diff.previousPeriod.totalApplications)} 件
            {' '}({overallComparison.diff.previousPeriod.totalApplicationsRate === null ? '-' : `${formatSigned(overallComparison.diff.previousPeriod.totalApplicationsRate, '%')}`})
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ color: '#4f5b70', marginBottom: 8 }}>通過率 比較</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{data.metrics.passRate}%</div>
          <div style={{ fontSize: 13, color: overallComparison.diff.previousYearSamePeriod.passRate >= 0 ? '#0f9f62' : '#b00020' }}>
            前年同期差: {formatSigned(overallComparison.diff.previousYearSamePeriod.passRate, 'pt')}
          </div>
          <div style={{ fontSize: 13, color: overallComparison.diff.previousPeriod.passRate >= 0 ? '#0f9f62' : '#b00020' }}>
            前期差: {formatSigned(overallComparison.diff.previousPeriod.passRate, 'pt')}
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>3年間推移（全体）</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {overallComparison.trend.map((t, idx) => (
            <div key={t.label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 100px 100px', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 700 }}>{t.label}</div>
              <div style={{ background: '#edf1f7', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(t.totalApplications / Math.max(1, ...overallComparison.trend.map(v => v.totalApplications))) * 100}%`,
                    height: '100%',
                    background: idx === overallComparison.trend.length - 1 ? '#2d7ff9' : '#88b7ff'
                  }}
                />
              </div>
              <div style={{ textAlign: 'right' }}>{t.totalApplications}件</div>
              <div style={{ textAlign: 'right' }}>{t.passRate}%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 14 }}>
        <h3 style={{ marginTop: 0 }}>所要日数（中央値）</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <MetricCard title="最終合格: 応募→最終回答" value={data.metrics.medianDaysAppliedToFinalDecisionForHired?.toString() || '-'} />
          <MetricCard title="応募→一次面接" value={data.metrics.medianDaysAppliedToFirstInterview?.toString() || '-'} />
          <MetricCard title="一次面接→一次回答" value={data.metrics.medianDaysFirstInterviewToFirstResult?.toString() || '-'} />
          <MetricCard title="一次回答→最終面接" value={data.metrics.medianDaysFirstResultToFinalInterview?.toString() || '-'} />
          <MetricCard title="最終面接→最終回答" value={data.metrics.medianDaysFinalInterviewToFinalResult?.toString() || '-'} />
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>応募数 分布（円グラフ）</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1fr) minmax(360px, 1fr)' }}>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>部別</div>
            <DonutPanel title="部別（応募数）" slices={deptApplications} valueSuffix="件" />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>部内課別</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {sectionApplications.map((v) => (
                <div key={`app-sec-${v.department}`}>
                  <DonutPanel title={`部内課別（応募数）: ${v.department}`} slices={v.slices} valueSuffix="件" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>課内グループ別</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {groupApplications.map((v) => (
                <div key={`app-grp-${v.department}-${v.section}`}>
                  <DonutPanel title={`課内グループ別（応募数）: ${v.department} / ${v.section}`} slices={v.items} valueSuffix="件" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>通過率 分布（円グラフ）</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1fr) minmax(360px, 1fr)' }}>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>部別</div>
            <DonutPanel title="部別（通過率）" slices={deptPassRate} valueSuffix="%" centerValue={data.metrics.passRate} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>部内課別</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {sectionPassRate.map((v) => (
                <div key={`rate-sec-${v.department}`}>
                  <DonutPanel title={`部内課別（通過率）: ${v.department}`} slices={v.slices} valueSuffix="%" centerValue={v.overallValue} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#556', marginBottom: 6 }}>課内グループ別</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {groupPassRate.map((v) => (
                <div key={`rate-grp-${v.department}-${v.section}`}>
                  <DonutPanel title={`課内グループ別（通過率）: ${v.department} / ${v.section}`} slices={v.items} valueSuffix="%" centerValue={v.overallValue} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>応募グループ別集計</h3>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>応募数（グループ別 棒グラフ）</div>
            {byGroupSorted.map((g) => (
              <div key={`bar-${g.department}-${g.section}-${g.group}`} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{g.department} / {g.section} / {g.group}</span>
                  <strong>{g.totalApplications}</strong>
                </div>
                <div style={{ background: '#edf1f7', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${(g.totalApplications / topGroupMax) * 100}%`, height: '100%', background: '#2d7ff9' }} />
                </div>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>通過率（グループ別）</div>
            {byGroupSorted.map((g) => (
              <div key={`rate-${g.department}-${g.section}-${g.group}`} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{g.department} / {g.section} / {g.group}</span>
                  <strong>{g.passRate}%</strong>
                </div>
                <div style={{ background: '#edf1f7', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, g.passRate))}%`, height: '100%', background: '#14a44d' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f5f7fb' }}>
                <th style={thStyle}>部</th>
                <th style={thStyle}>課</th>
                <th style={thStyle}>グループ</th>
                <th style={thStyle}>応募数</th>
                <th style={thStyle}>通過率</th>
                <th style={thStyle}>応募→面接 中央値(日)</th>
                <th style={thStyle}>面接→回答 中央値(日)</th>
              </tr>
            </thead>
            <tbody>
              {byGroupSorted.map((g) => (
                <tr key={`${g.department}-${g.section}-${g.group}`}>
                  <td style={tdStyle}>{g.department}</td>
                  <td style={tdStyle}>{g.section}</td>
                  <td style={tdStyle}>{g.group}</td>
                  <td style={tdStyle}>{g.totalApplications}</td>
                  <td style={tdStyle}>{g.passRate}%</td>
                  <td style={tdStyle}>{g.medianDaysAppliedToInterview ?? '-'}</td>
                  <td style={tdStyle}>{g.medianDaysInterviewToNotification ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>前年同期比較（部別）</h3>
        <ComparisonTable
          rows={byDepartmentComparison.map((r) => ({
            label: r.department || '未設定',
            currentApplications: r.current.totalApplications,
            previousApplications: r.previousYearSamePeriod.totalApplications,
            diffApplications: r.diff.totalApplications,
            diffApplicationsRate: r.diff.totalApplicationsRate,
            currentPassRate: r.current.passRate,
            previousPassRate: r.previousYearSamePeriod.passRate,
            diffPassRate: r.diff.passRate,
            trend: r.trend
          }))}
        />
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>前年同期比較（課別）</h3>
        <ComparisonTable
          rows={bySectionComparison.map((r) => ({
            label: `${r.department || '未設定'} / ${r.section || '未設定'}`,
            currentApplications: r.current.totalApplications,
            previousApplications: r.previousYearSamePeriod.totalApplications,
            diffApplications: r.diff.totalApplications,
            diffApplicationsRate: r.diff.totalApplicationsRate,
            currentPassRate: r.current.passRate,
            previousPassRate: r.previousYearSamePeriod.passRate,
            diffPassRate: r.diff.passRate,
            trend: r.trend
          }))}
        />
      </div>

      <div style={{ ...cardStyle, marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>前年同期比較（グループ別）</h3>
        <ComparisonTable
          rows={byGroupComparison.map((r) => ({
            label: `${r.department || '未設定'} / ${r.section || '未設定'} / ${r.group || '未設定'}`,
            currentApplications: r.current.totalApplications,
            previousApplications: r.previousYearSamePeriod.totalApplications,
            diffApplications: r.diff.totalApplications,
            diffApplicationsRate: r.diff.totalApplicationsRate,
            currentPassRate: r.current.passRate,
            previousPassRate: r.previousYearSamePeriod.passRate,
            diffPassRate: r.diff.passRate,
            trend: r.trend
          }))}
        />
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>選考ステータス分布</h3>
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
              <div style={{ background: '#edf1f7', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                <div style={{ width: `${(count / maxStatus) * 100}%`, height: '100%', background: '#2d7ff9' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function DonutPanel({
  title,
  slices,
  valueSuffix,
  centerValue
}: {
  title: string
  slices: Array<{ label: string; value: number }>
  valueSuffix: string
  centerValue?: number
}) {
  const palette = ['#2d7ff9', '#14a44d', '#f39c12', '#8e44ad', '#16a085', '#e74c3c', '#34495e', '#9b59b6']
  const total = slices.reduce((acc, s) => acc + s.value, 0)
  let degreeStart = 0
  const segments = slices.map((slice, i) => {
    const deg = total > 0 ? (slice.value / total) * 360 : 0
    const start = degreeStart
    const end = degreeStart + deg
    degreeStart = end
    return { ...slice, color: palette[i % palette.length], start, end }
  })
  const gradient = segments.length
    ? `conic-gradient(${segments.map(s => `${s.color} ${s.start}deg ${s.end}deg`).join(', ')})`
    : '#e5e8ef'

  return (
    <div style={{ ...cardStyle, background: '#fbfcff' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: gradient, position: 'relative', flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 22, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {Number((centerValue ?? total).toFixed(1))}{valueSuffix}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#445', display: 'grid', gap: 4 }}>
          {segments.map((s) => (
            <div key={s.label}>
              <span style={legendDot(s.color)} /> {s.label}: {Number(s.value.toFixed(1))}{valueSuffix}
            </div>
          ))}
          {segments.length === 0 && <div>データなし</div>}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={cardStyle}>
      <div style={{ color: '#4f5b70' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function ComparisonTable({
  rows
}: {
  rows: Array<{
    label: string
    currentApplications: number
    previousApplications: number
    diffApplications: number
    diffApplicationsRate: number | null
    currentPassRate: number
    previousPassRate: number
    diffPassRate: number
    trend: Array<{ label: string; totalApplications: number; passRate: number }>
  }>
}) {
  const maxApps = Math.max(1, ...rows.flatMap((r) => r.trend.map((t) => t.totalApplications)))

  const signed = (value: number, suffix = '') => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}${suffix}`

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f5f7fb' }}>
            <th style={thStyle}>組織</th>
            <th style={thStyle}>当期応募数</th>
            <th style={thStyle}>前年同期応募数</th>
            <th style={thStyle}>差分</th>
            <th style={thStyle}>増減率</th>
            <th style={thStyle}>当期通過率</th>
            <th style={thStyle}>前年同期通過率</th>
            <th style={thStyle}>差分(pt)</th>
            <th style={thStyle}>3年推移</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td style={tdStyle}>{r.label}</td>
              <td style={tdStyle}>{r.currentApplications}</td>
              <td style={tdStyle}>{r.previousApplications}</td>
              <td style={{ ...tdStyle, color: r.diffApplications >= 0 ? '#0f9f62' : '#b00020' }}>{signed(r.diffApplications)}</td>
              <td style={tdStyle}>{r.diffApplicationsRate === null ? '-' : `${signed(r.diffApplicationsRate, '%')}`}</td>
              <td style={tdStyle}>{r.currentPassRate}%</td>
              <td style={tdStyle}>{r.previousPassRate}%</td>
              <td style={{ ...tdStyle, color: r.diffPassRate >= 0 ? '#0f9f62' : '#b00020' }}>{signed(r.diffPassRate, 'pt')}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 180 }}>
                  {r.trend.map((t, idx) => (
                    <div key={`${r.label}-${t.label}`} title={`${t.label}: ${t.totalApplications}件 / ${t.passRate}%`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <div style={{ width: 12, height: Math.max(6, Math.round((t.totalApplications / maxApps) * 34)), borderRadius: 4, background: idx === r.trend.length - 1 ? '#2d7ff9' : '#b7d2ff' }} />
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td style={tdStyle} colSpan={9}>比較対象データがありません。</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function CandidatesView({ data, onNew, onEdit }: { data: BootstrapResponse; onNew: () => void; onEdit: (candidate: Candidate) => void }) {
  const [nameQuery, setNameQuery] = useState('')
  const [emailQuery, setEmailQuery] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortKey, setSortKey] = useState<'fullName' | 'email' | 'appliedDate' | 'department' | 'status'>('appliedDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const departments = useMemo(
    () => Array.from(new Set(data.candidates.map(c => c.applications[0]?.department || '未設定'))),
    [data.candidates]
  )
  const statuses = useMemo(
    () => Array.from(new Set(data.candidates.map(c => c.applications[0]?.status || '-'))),
    [data.candidates]
  )

  const filteredSorted = useMemo(() => {
    const filtered = data.candidates.filter((candidate) => {
      const department = candidate.applications[0]?.department || '未設定'
      const status = candidate.applications[0]?.status || '-'
      const nameOk = candidate.fullName.toLowerCase().includes(nameQuery.toLowerCase())
      const emailOk = candidate.email.toLowerCase().includes(emailQuery.toLowerCase())
      const deptOk = departmentFilter === 'ALL' || department === departmentFilter
      const statusOk = statusFilter === 'ALL' || status === statusFilter
      return nameOk && emailOk && deptOk && statusOk
    })

    const sorted = [...filtered].sort((a, b) => {
      const aDepartment = a.applications[0]?.department || '未設定'
      const bDepartment = b.applications[0]?.department || '未設定'
      const aStatus = a.applications[0]?.status || '-'
      const bStatus = b.applications[0]?.status || '-'

      const aAppliedDate = a.applications[0]?.appliedDate || ''
      const bAppliedDate = b.applications[0]?.appliedDate || ''

      const av =
        sortKey === 'fullName' ? a.fullName :
        sortKey === 'email' ? a.email :
        sortKey === 'appliedDate' ? aAppliedDate :
        sortKey === 'department' ? aDepartment :
        aStatus
      const bv =
        sortKey === 'fullName' ? b.fullName :
        sortKey === 'email' ? b.email :
        sortKey === 'appliedDate' ? bAppliedDate :
        sortKey === 'department' ? bDepartment :
        bStatus

      const cmp = av.localeCompare(bv, 'ja')
      return sortOrder === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [data.candidates, nameQuery, emailQuery, departmentFilter, statusFilter, sortKey, sortOrder])

  useEffect(() => {
    setPage(1)
  }, [nameQuery, emailQuery, departmentFilter, statusFilter, sortKey, sortOrder, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * pageSize
  const rows = filteredSorted.slice(pageStart, pageStart + pageSize)

  function sortBy(nextKey: 'fullName' | 'email' | 'appliedDate' | 'department' | 'status') {
    if (sortKey === nextKey) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(nextKey)
    setSortOrder('asc')
  }

  const firstLine = (v?: string) => (v || '').split('\n')[0] || '-'

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>候補者一覧</h3>
        <button onClick={onNew}>新規登録</button>
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', marginBottom: 12 }}>
        <input style={inputStyle} placeholder="氏名検索" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)} />
        <input style={inputStyle} placeholder="メール検索" value={emailQuery} onChange={(e) => setEmailQuery(e.target.value)} />
        <select style={inputStyle} value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
          <option value="ALL">部門: すべて</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select style={inputStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">ステータス: すべて</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={inputStyle} value={String(pageSize)} onChange={(e) => setPageSize(Number(e.target.value))}>
          <option value="10">10件表示</option>
          <option value="20">20件表示</option>
          <option value="50">50件表示</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f5f7fb' }}>
              <th style={thStyle}><button style={sortButtonStyle} onClick={() => sortBy('fullName')}>氏名</button></th>
              <th style={thStyle}><button style={sortButtonStyle} onClick={() => sortBy('email')}>メール</button></th>
              <th style={thStyle}>電話</th>
              <th style={thStyle}>応募職種</th>
              <th style={thStyle}><button style={sortButtonStyle} onClick={() => sortBy('appliedDate')}>応募日</button></th>
              <th style={thStyle}><button style={sortButtonStyle} onClick={() => sortBy('department')}>部門</button></th>
              <th style={thStyle}><button style={sortButtonStyle} onClick={() => sortBy('status')}>ステータス</button></th>
              <th style={thStyle}>課</th>
              <th style={thStyle}>応募先グループ</th>
              <th style={thStyle}>一次面接日</th>
              <th style={thStyle}>一次面接担当</th>
              <th style={thStyle}>一次結果</th>
              <th style={thStyle}>一次面接担当者コメント</th>
              <th style={thStyle}>一次採用担当コメント</th>
              <th style={thStyle}>一次結果回答日</th>
              <th style={thStyle}>最終面接日</th>
              <th style={thStyle}>最終面接担当</th>
              <th style={thStyle}>最終結果</th>
              <th style={thStyle}>最終面接担当者コメント</th>
              <th style={thStyle}>最終採用担当コメント</th>
              <th style={thStyle}>最終結果回答日</th>
              <th style={thStyle}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((candidate) => {
              const app = candidate.applications[0]
              return (
              <tr key={candidate.id}>
                <td style={tdStyle}>{candidate.fullName}</td>
                <td style={tdStyle}>{candidate.email}</td>
                <td style={tdStyle}>{candidate.phone}</td>
                <td style={tdStyle}>{candidate.appliedRole}</td>
                <td style={tdStyle}>{app?.appliedDate || '-'}</td>
                <td style={tdStyle}>{app?.department || '-'}</td>
                <td style={tdStyle}>{app?.status || '-'}</td>
                <td style={tdStyle}>{app?.section || '-'}</td>
                <td style={tdStyle}>{app?.group || '-'}</td>
                <td style={tdStyle}>{app?.firstInterviewDate || '-'}</td>
                <td style={tdStyle}>{app?.firstInterviewers?.join(' / ') || '-'}</td>
                <td style={tdStyle}>{app?.firstInterviewResult === 'PASS' ? '合格' : app?.firstInterviewResult === 'FAIL' ? '不合格' : '-'}</td>
                <td style={tdStyle}>{firstLine(app?.firstInterviewerComment)}</td>
                <td style={tdStyle}>{firstLine(app?.firstRecruiterComment)}</td>
                <td style={tdStyle}>{app?.firstResultNotifiedDate || '-'}</td>
                <td style={tdStyle}>{app?.finalInterviewDate || '-'}</td>
                <td style={tdStyle}>{app?.finalInterviewers?.join(' / ') || '-'}</td>
                <td style={tdStyle}>{app?.finalInterviewResult === 'PASS' ? '合格' : app?.finalInterviewResult === 'FAIL' ? '不合格' : '-'}</td>
                <td style={tdStyle}>{firstLine(app?.finalInterviewerComment)}</td>
                <td style={tdStyle}>{firstLine(app?.finalRecruiterComment)}</td>
                <td style={tdStyle}>{app?.finalResultNotifiedDate || '-'}</td>
                <td style={tdStyle}><button onClick={() => onEdit(candidate)}>編集</button></td>
              </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td style={tdStyle} colSpan={21}>該当データがありません。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>表示 {filteredSorted.length} 件中 {rows.length} 件（{currentPage}/{totalPages}ページ）</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setPage(1)} disabled={currentPage <= 1}>先頭</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>前へ</button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>次へ</button>
          <button onClick={() => setPage(totalPages)} disabled={currentPage >= totalPages}>末尾</button>
        </div>
      </div>
    </div>
  )
}

function CandidateFormView({
  mode,
  organizationStructure,
  form,
  setForm,
  onSubmit,
  onCancel
}: {
  mode: 'new' | 'edit'
  organizationStructure: OrganizationStructure[]
  form: {
    fullName: string
    email: string
    phone: string
    appliedRole: string
    documentUrl: string
    department: string
    section: string
    group: string
    appliedDate: string
    firstInterviewDate: string
    firstInterviewer1: string
    firstInterviewer2: string
    firstInterviewResult: string
    firstInterviewerComment: string
    firstRecruiterComment: string
    firstResultNotifiedDate: string
    finalInterviewDate: string
    finalInterviewer1: string
    finalInterviewer2: string
    finalInterviewResult: string
    finalInterviewerComment: string
    finalRecruiterComment: string
    finalResultNotifiedDate: string
  }
  setForm: React.Dispatch<React.SetStateAction<{
    fullName: string
    email: string
    phone: string
    appliedRole: string
    documentUrl: string
    department: string
    section: string
    group: string
    appliedDate: string
    firstInterviewDate: string
    firstInterviewer1: string
    firstInterviewer2: string
    firstInterviewResult: string
    firstInterviewerComment: string
    firstRecruiterComment: string
    firstResultNotifiedDate: string
    finalInterviewDate: string
    finalInterviewer1: string
    finalInterviewer2: string
    finalInterviewResult: string
    finalInterviewerComment: string
    finalRecruiterComment: string
    finalResultNotifiedDate: string
  }>>
  onSubmit: () => void
  onCancel: () => void
}) {
  const departments = organizationStructure.map(d => d.department)
  const selectedDepartment = organizationStructure.find(d => d.department === form.department) || organizationStructure[0]
  const sections = selectedDepartment?.sections || []
  const selectedSection = sections.find(s => s.section === form.section) || sections[0]
  const groups = selectedSection?.groups || []

  function onDepartmentChange(value: string) {
    const dept = organizationStructure.find(d => d.department === value)
    const section = dept?.sections[0]
    setForm({ ...form, department: value, section: section?.section || '', group: section?.groups[0] || '' })
  }

  function onSectionChange(value: string) {
    const section = sections.find(s => s.section === value)
    setForm({ ...form, section: value, group: section?.groups[0] || '' })
  }

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>{mode === 'new' ? '候補者新規登録' : '候補者編集'}</h3>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <div style={fieldLabelStyle}>氏名 *</div>
          <input placeholder="氏名" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>メールアドレス *</div>
          <input placeholder="メールアドレス" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>電話 *</div>
          <input placeholder="電話" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>応募職種 *</div>
          <input placeholder="応募職種" value={form.appliedRole} onChange={(e) => setForm({ ...form, appliedRole: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>履歴書URL（任意）</div>
          <input placeholder="履歴書URL" value={form.documentUrl} onChange={(e) => setForm({ ...form, documentUrl: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>応募先の部</div>
          <select style={inputStyle} value={form.department} onChange={(e) => onDepartmentChange(e.target.value)}>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>応募先の課</div>
          <select style={inputStyle} value={form.section} onChange={(e) => onSectionChange(e.target.value)}>
            {sections.map((s) => <option key={s.section} value={s.section}>{s.section}</option>)}
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>応募先のグループ</div>
          <select style={inputStyle} value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div>
          <div style={fieldLabelStyle}>応募日</div>
          <input type="date" value={form.appliedDate} onChange={(e) => setForm({ ...form, appliedDate: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e8edf5', paddingTop: 8, marginTop: 4, fontWeight: 700 }}>一次面接</div>

        <div>
          <div style={fieldLabelStyle}>一次面接実施日</div>
          <input type="date" value={form.firstInterviewDate} onChange={(e) => setForm({ ...form, firstInterviewDate: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>一次面接担当者1</div>
          <input value={form.firstInterviewer1} onChange={(e) => setForm({ ...form, firstInterviewer1: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>一次面接担当者2</div>
          <input value={form.firstInterviewer2} onChange={(e) => setForm({ ...form, firstInterviewer2: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>一次面接結果</div>
          <select style={inputStyle} value={form.firstInterviewResult} onChange={(e) => setForm({ ...form, firstInterviewResult: e.target.value })}>
            <option value="">未入力</option>
            <option value="PASS">合格</option>
            <option value="FAIL">不合格</option>
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>一次面接結果回答日</div>
          <input type="date" value={form.firstResultNotifiedDate} onChange={(e) => setForm({ ...form, firstResultNotifiedDate: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={fieldLabelStyle}>一次面接 面接担当者コメント</div>
          <textarea rows={3} value={form.firstInterviewerComment} onChange={(e) => setForm({ ...form, firstInterviewerComment: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={fieldLabelStyle}>一次面接 採用担当者コメント</div>
          <textarea rows={3} value={form.firstRecruiterComment} onChange={(e) => setForm({ ...form, firstRecruiterComment: e.target.value })} style={inputStyle} />
        </div>

        <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e8edf5', paddingTop: 8, marginTop: 4, fontWeight: 700 }}>最終面接</div>

        <div>
          <div style={fieldLabelStyle}>最終面接実施日</div>
          <input type="date" value={form.finalInterviewDate} onChange={(e) => setForm({ ...form, finalInterviewDate: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>最終面接担当者1</div>
          <input value={form.finalInterviewer1} onChange={(e) => setForm({ ...form, finalInterviewer1: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>最終面接担当者2</div>
          <input value={form.finalInterviewer2} onChange={(e) => setForm({ ...form, finalInterviewer2: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <div style={fieldLabelStyle}>最終面接結果</div>
          <select style={inputStyle} value={form.finalInterviewResult} onChange={(e) => setForm({ ...form, finalInterviewResult: e.target.value })}>
            <option value="">未入力</option>
            <option value="PASS">合格</option>
            <option value="FAIL">不合格</option>
          </select>
        </div>
        <div>
          <div style={fieldLabelStyle}>最終面接結果回答日</div>
          <input type="date" value={form.finalResultNotifiedDate} onChange={(e) => setForm({ ...form, finalResultNotifiedDate: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={fieldLabelStyle}>最終面接 面接担当者コメント</div>
          <textarea rows={3} value={form.finalInterviewerComment} onChange={(e) => setForm({ ...form, finalInterviewerComment: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <div style={fieldLabelStyle}>最終面接 採用担当者コメント</div>
          <textarea rows={3} value={form.finalRecruiterComment} onChange={(e) => setForm({ ...form, finalRecruiterComment: e.target.value })} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={onSubmit}>登録</button>
        <button onClick={onCancel}>キャンセル</button>
      </div>
    </div>
  )
}

function AdminView({
  organization,
  fiscalYearStartMonth,
  setFiscalYearStartMonth,
  onSaveFiscalYearSetting,
  accounts,
  accountMsg,
  newAccount,
  setNewAccount,
  onCreate,
  onSave
}: {
  organization: BootstrapResponse['organization']
  fiscalYearStartMonth: FiscalYearStartMonth
  setFiscalYearStartMonth: React.Dispatch<React.SetStateAction<FiscalYearStartMonth>>
  onSaveFiscalYearSetting: () => void
  accounts: User[]
  accountMsg: string
  newAccount: { name: string; email: string; role: Role; password: string }
  setNewAccount: React.Dispatch<React.SetStateAction<{ name: string; email: string; role: Role; password: string }>>
  onCreate: () => void
  onSave: (account: User, password?: string) => Promise<void>
}) {
  const roleCounts = [
    { key: 'recruiter', label: '採用担当', value: organization.currentAccounts.recruiter },
    { key: 'interviewer', label: '面接官', value: organization.currentAccounts.interviewer },
    { key: 'dept_manager', label: '部門責任者', value: organization.currentAccounts.dept_manager },
    { key: 'tech_admin', label: '技術担当', value: organization.currentAccounts.tech_admin }
  ]

  const departmentOrder = new Map(organization.structure.map((d, i) => [d.department, i]))
  const sectionOrder = new Map(
    organization.structure.flatMap((d) => d.sections.map((s, i) => [`${d.department}::${s.section}`, i] as const))
  )
  const groupOrder = new Map(
    organization.structure.flatMap((d) =>
      d.sections.flatMap((s) =>
        s.groups.map((g, i) => [`${d.department}::${s.section}::${g}`, i] as const)
      )
    )
  )

  function accountRank(a: User): [number, number, number, number, string] {
    if (a.role === 'recruiter') return [0, 0, 0, 0, a.name]

    if (a.department && departmentOrder.has(a.department)) {
      const deptIdx = departmentOrder.get(a.department) ?? 99
      if (a.role === 'dept_manager') return [1, deptIdx, 0, 0, a.name]

      if (a.role === 'interviewer' && a.title === '課長') {
        const secIdx = sectionOrder.get(`${a.department}::${a.section || ''}`) ?? 99
        return [1, deptIdx, 1, secIdx, a.name]
      }

      if (a.role === 'interviewer' && a.title === 'グループリーダー') {
        const secIdx = sectionOrder.get(`${a.department}::${a.section || ''}`) ?? 99
        const grpIdx = groupOrder.get(`${a.department}::${a.section || ''}::${a.group || ''}`) ?? 99
        return [1, deptIdx, 2, secIdx * 10 + grpIdx, a.name]
      }

      return [1, deptIdx, 9, 0, a.name]
    }

    if (a.role === 'tech_admin') return [2, 0, 0, 0, a.name]
    return [3, 0, 0, 0, a.name]
  }

  const sortedAccounts = [...accounts].sort((a, b) => {
    const ar = accountRank(a)
    const br = accountRank(b)
    for (let i = 0; i < ar.length; i += 1) {
      if (ar[i] < br[i]) return -1
      if (ar[i] > br[i]) return 1
    }
    return 0
  })

  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0 }}>管理者画面（アカウント管理）</h3>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
        初期パスワードは <code>rec12345</code> です。
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>年度設定</h4>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr auto', alignItems: 'center', maxWidth: 520 }}>
          <select
            style={inputStyle}
            value={String(fiscalYearStartMonth)}
            onChange={(e) => setFiscalYearStartMonth(Number(e.target.value) as FiscalYearStartMonth)}
          >
            <option value="4">4月始まり（3月締め）</option>
            <option value="1">1月始まり（12月締め）</option>
            <option value="9">9月始まり（8月締め）</option>
          </select>
          <button onClick={onSaveFiscalYearSetting}>保存</button>
        </div>
        <div style={{ fontSize: 12, color: '#556', marginTop: 8 }}>
          四半期・半期・年次の集計期間はこの年度設定に従います。
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 12 }}>
        <h4 style={{ marginTop: 0, marginBottom: 10 }}>ロール別アカウント状況</h4>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {roleCounts.map((item) => (
            <div key={item.key} style={{ border: '1px solid #d7dce7', borderRadius: 10, padding: 10, background: '#fff' }}>
              <div style={{ color: '#4f5b70', fontSize: 13 }}>{item.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr', marginBottom: 10 }}>
        <input placeholder="氏名" style={inputStyle} value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} />
        <input placeholder="メール" style={inputStyle} value={newAccount.email} onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })} />
        <select style={inputStyle} value={newAccount.role} onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value as Role })}>
          {roleOptions.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
        </select>
        <input placeholder="初期PW" style={inputStyle} value={newAccount.password} onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })} />
        <button onClick={onCreate}>追加</button>
      </div>

      {accountMsg && <div style={{ marginBottom: 8, color: '#0b5' }}>{accountMsg}</div>}

      <div style={{ display: 'grid', gap: 8 }}>
        {sortedAccounts.map((acc) => (
          <AccountRow key={acc.id} account={acc} onSave={onSave} />
        ))}
      </div>
    </div>
  )
}

function AccountRow({
  account,
  onSave
}: {
  account: User
  onSave: (account: User, password?: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<User>(account)
  const [password, setPassword] = useState('')

  useEffect(() => {
    setEditing(account)
  }, [account])

  return (
    <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '2fr 2fr 1fr 1fr 1fr 2fr', alignItems: 'center' }}>
      <input style={inputStyle} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
      <input style={inputStyle} value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
      <select style={inputStyle} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as Role })}>
        {roleOptions.map(r => <option key={r} value={r}>{roleLabel[r]}</option>)}
      </select>
      <label style={{ fontSize: 13 }}>
        <input
          type="checkbox"
          checked={editing.active}
          onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
          style={{ marginRight: 4 }}
        />
        有効
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          style={{ ...inputStyle, width: 100 }}
          placeholder="PW変更"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={() => onSave(editing, password || undefined)}>保存</button>
      </div>
      <div style={{ fontSize: 12, color: '#556' }}>
        {editing.title || '-'} / {[editing.department, editing.section, editing.group].filter(Boolean).join(' > ') || '所属未設定'}
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #d7dce7',
  whiteSpace: 'nowrap'
}
const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #eef2f7',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle'
}
const sortButtonStyle: React.CSSProperties = { border: 0, background: 'transparent', cursor: 'pointer', fontWeight: 700, padding: 0 }
const legendDot = (color: string): React.CSSProperties => ({ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 6 })
const fieldLabelStyle: React.CSSProperties = { fontSize: 12, color: '#4f5b70', marginBottom: 4, fontWeight: 700 }
