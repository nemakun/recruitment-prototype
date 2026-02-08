import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

type Role = 'recruiter' | 'interviewer' | 'dept_manager' | 'tech_admin'
type Decision = 'PASS' | 'FAIL'
type Status = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED'
type MetricPeriod = 'monthly' | 'quarterly' | 'halfyearly' | 'yearly'
type FiscalYearStartMonth = 1 | 4 | 9
type MetricFilter = {
  month: number
  quarter: number
  half: 1 | 2
  fiscalYear: number
}

const INITIAL_PASSWORD = 'rec12345'
const ALLOWED_FISCAL_START_MONTHS: FiscalYearStartMonth[] = [1, 4, 9]

const systemSettings: {
  fiscalYearStartMonth: FiscalYearStartMonth
} = {
  fiscalYearStartMonth: 4
}

const ALL_ROLES: Role[] = ['recruiter', 'interviewer', 'dept_manager', 'tech_admin']

type OrgGroup = {
  department: string
  section: string
  group: string
}

const ORG_STRUCTURE = [
  {
    department: '第一開発部',
    sections: [
      { section: '第一課', groups: ['Aグループ', 'Bグループ', 'Cグループ'] },
      { section: '第二課', groups: ['Aグループ', 'Bグループ', 'Cグループ'] }
    ]
  },
  {
    department: '第二開発部',
    sections: [
      { section: '第一課', groups: ['Aグループ', 'Bグループ', 'Cグループ'] },
      { section: '第二課', groups: ['Aグループ', 'Bグループ', 'Cグループ'] }
    ]
  }
]

const ORG_GROUPS: OrgGroup[] = ORG_STRUCTURE.flatMap((dept) =>
  dept.sections.flatMap((sec) =>
    sec.groups.map((grp) => ({ department: dept.department, section: sec.section, group: grp }))
  )
)

type UserAccount = {
  id: string
  name: string
  email: string
  role: Role
  title: string
  department?: string
  section?: string
  group?: string
  active: boolean
  password: string
  createdAt: string
  updatedAt: string
}

type PublicUserAccount = Omit<UserAccount, 'password'>

type InterviewFeedback = {
  interviewerDecision: Decision
  interviewerComment: string
  recruiterComment?: string
}

type InterviewRecord = {
  id: string
  round: number
  interviewerId: string
  scheduledAt: string
  resultNotifiedAt?: string
  feedback?: InterviewFeedback
}

type ApplicationRecord = {
  id: string
  department: string
  section: string
  group: string
  appliedDate: string
  firstInterviewDate?: string
  firstInterviewers: string[]
  firstInterviewResult?: Decision
  firstInterviewerComment?: string
  firstRecruiterComment?: string
  firstResultNotifiedDate?: string
  finalInterviewDate?: string
  finalInterviewers: string[]
  finalInterviewResult?: Decision
  finalInterviewerComment?: string
  finalRecruiterComment?: string
  finalResultNotifiedDate?: string
  status: Status
  appliedAt: string
  interviews: InterviewRecord[]
  statusHistory: Array<{
    from: Status | null
    to: Status
    changedAt: string
    changedByRole: Role
  }>
}

type CandidateRecord = {
  id: string
  fullName: string
  email: string
  phone: string
  appliedRole: string
  documentUrls: string[]
  applications: ApplicationRecord[]
  createdAt: string
}

let idCounter = 1
function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function getCurrentFiscalYearStartYear(now: Date, fiscalYearStartMonth: FiscalYearStartMonth) {
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  const currentMonth = now.getMonth()
  return currentMonth >= fiscalStartMonthIndex ? now.getFullYear() : now.getFullYear() - 1
}

function getCurrentQuarter(now: Date, fiscalYearStartMonth: FiscalYearStartMonth) {
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  const monthDiff = (now.getMonth() - fiscalStartMonthIndex + 12) % 12
  return Math.floor(monthDiff / 3) + 1
}

function getCurrentHalf(now: Date, fiscalYearStartMonth: FiscalYearStartMonth): 1 | 2 {
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  const monthDiff = (now.getMonth() - fiscalStartMonthIndex + 12) % 12
  return monthDiff < 6 ? 1 : 2
}

function sanitizeUser(user: UserAccount): PublicUserAccount {
  const { password: _password, ...safe } = user
  return safe
}

function isAdminRole(role: Role): boolean {
  return role === 'recruiter' || role === 'tech_admin'
}

function resolveActor(actorId: string | undefined): UserAccount | null {
  if (!actorId) return null
  const actor = users.find(u => u.id === actorId && u.active)
  return actor || null
}

function requireAdmin(actorId: string | undefined): { ok: true; actor: UserAccount } | { ok: false } {
  const actor = resolveActor(actorId)
  if (!actor || !isAdminRole(actor.role)) return { ok: false }
  return { ok: true, actor }
}

const groupLeaderUsers: UserAccount[] = ORG_GROUPS.map((g, i) => ({
  id: `interviewer_gl_${i + 1}`,
  name: `${g.department} ${g.section} ${g.group} リーダー`,
  email: `gl${i + 1}@example.com`,
  role: 'interviewer',
  title: 'グループリーダー',
  department: g.department,
  section: g.section,
  group: g.group,
  active: true,
  password: INITIAL_PASSWORD,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}))

const sectionChiefUsers: UserAccount[] = ORG_STRUCTURE.flatMap((dept, deptIdx) =>
  dept.sections.map((sec, secIdx) => ({
    id: `interviewer_sc_${deptIdx + 1}_${secIdx + 1}`,
    name: `${dept.department} ${sec.section} 課長`,
    email: `sc${deptIdx + 1}${secIdx + 1}@example.com`,
    role: 'interviewer' as const,
    title: '課長',
    department: dept.department,
    section: sec.section,
    active: true,
    password: INITIAL_PASSWORD,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }))
)

const divisionHeadUsers: UserAccount[] = ORG_STRUCTURE.map((dept, i) => ({
  id: `manager_${i + 1}`,
  name: `${dept.department} 部長`,
  email: `manager${i + 1}@example.com`,
  role: 'dept_manager',
  title: '部長',
  department: dept.department,
  active: true,
  password: INITIAL_PASSWORD,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
}))

const users: UserAccount[] = [
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `recruiter_${i + 1}`,
    name: `採用担当${i + 1}`,
    email: `recruiter${i + 1}@example.com`,
    role: 'recruiter' as const,
    title: '採用担当',
    active: true,
    password: INITIAL_PASSWORD,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  })),
  ...groupLeaderUsers,
  ...sectionChiefUsers,
  ...divisionHeadUsers,
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `tech_${i + 1}`,
    name: `技術担当${i + 1}`,
    email: `tech${i + 1}@example.com`,
    role: 'tech_admin' as const,
    title: '技術部門担当者',
    active: true,
    password: INITIAL_PASSWORD,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }))
]

const candidates: CandidateRecord[] = (() => {
  const firstNames = ['太郎', '花子', '健太', '美咲', '大輔', '彩', '翔', '奈々', '蓮', '葵']
  const lastNames = ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤']
  const roles = ['バックエンドエンジニア', 'フロントエンドエンジニア', 'モバイルエンジニア', 'QAエンジニア', 'SRE']
  const interviewerUsers = users.filter(u => u.role === 'interviewer')
  const totalCandidates = 2000
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const threeYearsAgo = now - 365 * 3 * dayMs
  const oneMonthAgo = now - 30 * dayMs

  function toDateString(ms: number) {
    return new Date(ms).toISOString().slice(0, 10)
  }

  function toDateTime(ms: number) {
    return new Date(ms).toISOString()
  }

  const rows: CandidateRecord[] = []
  for (let i = 1; i <= totalCandidates; i += 1) {
    const first = firstNames[i % firstNames.length]
    const last = lastNames[i % lastNames.length]
    const fullName = `${last} ${first}${i}`
    const ratio = (i - 1) / Math.max(1, totalCandidates - 1)
    const appliedAtMs = Math.round(threeYearsAgo + (now - threeYearsAgo) * ratio)
    const appliedAt = toDateTime(appliedAtMs)
    const appliedDate = toDateString(appliedAtMs)
    const targetGroup = ORG_GROUPS[i % ORG_GROUPS.length]
    const appliedRole = roles[i % roles.length]

    const isOlderThanOneMonth = appliedAtMs <= oneMonthAgo
    const selectionBucket = i % 10
    let status: Status = 'SCREENING'

    let firstInterviewDate: string | undefined
    let firstResultNotifiedDate: string | undefined
    let firstInterviewResult: Decision | undefined
    let firstInterviewerComment: string | undefined
    let firstRecruiterComment: string | undefined
    let firstInterviewers: string[] = []

    let finalInterviewDate: string | undefined
    let finalResultNotifiedDate: string | undefined
    let finalInterviewResult: Decision | undefined
    let finalInterviewerComment: string | undefined
    let finalRecruiterComment: string | undefined
    let finalInterviewers: string[] = []

    const firstInterviewerA = interviewerUsers[i % interviewerUsers.length]
    const firstInterviewerB = interviewerUsers[(i + 1) % interviewerUsers.length]
    const finalInterviewerA = interviewerUsers[(i + 2) % interviewerUsers.length]
    const finalInterviewerB = interviewerUsers[(i + 3) % interviewerUsers.length]

    const interviews: InterviewRecord[] = []

    if (isOlderThanOneMonth) {
      // Older than 1 month: all records must be finally decided.
      const firstFail = selectionBucket < 4
      const firstInterviewMs = appliedAtMs + (3 + (i % 7)) * dayMs
      const firstResultMs = firstInterviewMs + (i % 3) * dayMs
      firstInterviewDate = toDateString(firstInterviewMs)
      firstResultNotifiedDate = toDateString(firstResultMs)
      firstInterviewers = [firstInterviewerA?.name, firstInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)

      if (firstFail) {
        firstInterviewResult = 'FAIL'
        firstInterviewerComment = '一次面接時点で要件とのギャップが大きく、不合格。'
        firstRecruiterComment = '一次面接で見送り判断。'
        status = 'REJECTED'
      } else {
        firstInterviewResult = 'PASS'
        firstInterviewerComment = '一次面接は合格。最終面接へ進行。'
        firstRecruiterComment = '一次面接合格。最終面接を設定。'
        const finalInterviewMs = firstResultMs + (2 + (i % 6)) * dayMs
        const finalResultMs = finalInterviewMs + (i % 3) * dayMs
        finalInterviewDate = toDateString(finalInterviewMs)
        finalResultNotifiedDate = toDateString(finalResultMs)
        finalInterviewers = [finalInterviewerA?.name, finalInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)
        finalInterviewResult = i % 2 === 0 ? 'PASS' : 'FAIL'
        finalInterviewerComment = finalInterviewResult === 'PASS' ? '最終面接でも評価良好。採用可。' : '最終面接で懸念点が解消せず不合格。'
        finalRecruiterComment = finalInterviewResult === 'PASS' ? '最終合格。条件提示を実施。' : '最終面接で不合格。'
        status = finalInterviewResult === 'PASS' ? 'HIRED' : 'REJECTED'
      }
    } else {
      // Within 1 month: mixed state (decided + in-progress).
      if (selectionBucket <= 2) {
        // First interview fail (decided)
        const firstInterviewMs = appliedAtMs + (2 + (i % 5)) * dayMs
        const firstResultMs = firstInterviewMs + (i % 2) * dayMs
        firstInterviewDate = toDateString(firstInterviewMs)
        firstResultNotifiedDate = toDateString(firstResultMs)
        firstInterviewers = [firstInterviewerA?.name, firstInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)
        firstInterviewResult = 'FAIL'
        firstInterviewerComment = '一次面接で不合格。'
        firstRecruiterComment = '一次面接結果を連絡済み。'
        status = 'REJECTED'
      } else if (selectionBucket <= 4) {
        // Final decided
        const firstInterviewMs = appliedAtMs + (2 + (i % 4)) * dayMs
        const firstResultMs = firstInterviewMs + (i % 2) * dayMs
        const finalInterviewMs = firstResultMs + (2 + (i % 5)) * dayMs
        const finalResultMs = finalInterviewMs + (i % 2) * dayMs
        firstInterviewDate = toDateString(firstInterviewMs)
        firstResultNotifiedDate = toDateString(firstResultMs)
        firstInterviewers = [firstInterviewerA?.name, firstInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)
        firstInterviewResult = 'PASS'
        firstInterviewerComment = '一次面接合格。'
        firstRecruiterComment = '最終面接へ進行。'
        finalInterviewDate = toDateString(finalInterviewMs)
        finalResultNotifiedDate = toDateString(finalResultMs)
        finalInterviewers = [finalInterviewerA?.name, finalInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)
        finalInterviewResult = i % 2 === 0 ? 'PASS' : 'FAIL'
        finalInterviewerComment = finalInterviewResult === 'PASS' ? '最終合格。' : '最終不合格。'
        finalRecruiterComment = finalInterviewResult === 'PASS' ? '採用決定。' : '不採用決定。'
        status = finalInterviewResult === 'PASS' ? 'HIRED' : 'REJECTED'
      } else if (selectionBucket <= 6) {
        // In progress before first interview
        status = selectionBucket === 5 ? 'APPLIED' : 'SCREENING'
      } else {
        // In progress after first pass, before final decision
        const firstInterviewMs = appliedAtMs + (2 + (i % 4)) * dayMs
        const firstResultMs = firstInterviewMs + (i % 2) * dayMs
        firstInterviewDate = toDateString(firstInterviewMs)
        firstResultNotifiedDate = toDateString(firstResultMs)
        firstInterviewers = [firstInterviewerA?.name, firstInterviewerB?.name].filter((v): v is string => !!v).slice(0, 2)
        firstInterviewResult = 'PASS'
        firstInterviewerComment = '一次面接合格、最終面接調整中。'
        firstRecruiterComment = '最終面接の日程調整中。'
        status = 'INTERVIEW'
      }
    }

    if (firstInterviewDate && firstInterviewResult) {
      interviews.push({
        id: `int_${i}_1`,
        round: 1,
        interviewerId: firstInterviewerA?.id || 'interviewer_gl_1',
        scheduledAt: `${firstInterviewDate}T09:00:00.000Z`,
        resultNotifiedAt: firstResultNotifiedDate ? `${firstResultNotifiedDate}T09:00:00.000Z` : undefined,
        feedback: {
          interviewerDecision: firstInterviewResult,
          interviewerComment: firstInterviewerComment || '',
          recruiterComment: firstRecruiterComment
        }
      })
    }
    if (finalInterviewDate && finalInterviewResult) {
      interviews.push({
        id: `int_${i}_2`,
        round: 2,
        interviewerId: finalInterviewerA?.id || 'interviewer_gl_1',
        scheduledAt: `${finalInterviewDate}T09:00:00.000Z`,
        resultNotifiedAt: finalResultNotifiedDate ? `${finalResultNotifiedDate}T09:00:00.000Z` : undefined,
        feedback: {
          interviewerDecision: finalInterviewResult,
          interviewerComment: finalInterviewerComment || '',
          recruiterComment: finalRecruiterComment
        }
      })
    }

    rows.push({
      id: `cand_${i}`,
      fullName,
      email: `candidate${i}@example.com`,
      phone: `090-${String(1000 + i).padStart(4, '0')}-${String(2000 + i).padStart(4, '0')}`,
      appliedRole,
      documentUrls: [`https://storage.example.com/docs/cand_${i}_resume.pdf`],
      createdAt: appliedAt,
      applications: [
        {
          id: `app_${i}`,
          department: targetGroup.department,
          section: targetGroup.section,
          group: targetGroup.group,
          appliedDate,
          firstInterviewDate,
          firstInterviewers,
          firstInterviewResult,
          firstInterviewerComment,
          firstRecruiterComment,
          firstResultNotifiedDate,
          finalInterviewDate,
          finalInterviewers,
          finalInterviewResult,
          finalInterviewerComment,
          finalRecruiterComment,
          finalResultNotifiedDate,
          status,
          appliedAt,
          statusHistory: [
            { from: null, to: 'APPLIED', changedAt: appliedAt, changedByRole: 'recruiter' },
            ...(status !== 'APPLIED'
              ? [{
                  from: 'APPLIED' as Status,
                  to: status,
                  changedAt: toDateTime(appliedAtMs + (1 + (i % 3)) * dayMs),
                  changedByRole: i % 2 === 0 ? 'recruiter' as Role : 'dept_manager' as Role
                }]
              : [])
          ],
          interviews
        }
      ]
    })
  }
  return rows
})()

function normalizeMetricFilter(raw: Partial<MetricFilter>, fiscalYearStartMonth: FiscalYearStartMonth): MetricFilter {
  const now = new Date()
  const currentFiscalYear = getCurrentFiscalYearStartYear(now, fiscalYearStartMonth)
  const currentQuarter = getCurrentQuarter(now, fiscalYearStartMonth)
  const currentHalf = getCurrentHalf(now, fiscalYearStartMonth)
  const month = Number(raw.month)
  const quarter = Number(raw.quarter)
  const half = Number(raw.half)
  const fiscalYear = Number(raw.fiscalYear)

  return {
    month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : now.getMonth() + 1,
    quarter: Number.isInteger(quarter) && quarter >= 1 && quarter <= 4 ? quarter : currentQuarter,
    half: (half === 1 || half === 2 ? half : currentHalf) as 1 | 2,
    fiscalYear: Number.isInteger(fiscalYear) && fiscalYear >= currentFiscalYear - 2 && fiscalYear <= currentFiscalYear ? fiscalYear : currentFiscalYear
  }
}

function getPeriodRange(period: MetricPeriod, fiscalYearStartMonth: FiscalYearStartMonth, filter: MetricFilter) {
  const fiscalStartMonthIndex = fiscalYearStartMonth - 1
  let start: Date
  let endExclusive: Date

  if (period === 'monthly') {
    const year = new Date().getFullYear()
    start = new Date(Date.UTC(year, filter.month - 1, 1, 0, 0, 0, 0))
    endExclusive = new Date(Date.UTC(year, filter.month, 1, 0, 0, 0, 0))
  } else if (period === 'quarterly') {
    const quarterOffsetMonths = (filter.quarter - 1) * 3
    start = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex + quarterOffsetMonths, 1, 0, 0, 0, 0))
    endExclusive = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex + quarterOffsetMonths + 3, 1, 0, 0, 0, 0))
  } else if (period === 'halfyearly') {
    const halfOffsetMonths = filter.half === 1 ? 0 : 6
    start = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex + halfOffsetMonths, 1, 0, 0, 0, 0))
    endExclusive = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex + halfOffsetMonths + 6, 1, 0, 0, 0, 0))
  } else {
    start = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex, 1, 0, 0, 0, 0))
    endExclusive = new Date(Date.UTC(filter.fiscalYear, fiscalStartMonthIndex + 12, 1, 0, 0, 0, 0))
  }

  return { start, endExclusive }
}

function calcRecruitingMetrics(period: MetricPeriod, fiscalYearStartMonth: FiscalYearStartMonth, filter: MetricFilter) {
  const applications = candidates.flatMap(c => c.applications.map(appItem => ({ app: appItem })))
  const { start, endExclusive } = getPeriodRange(period, fiscalYearStartMonth, filter)
  const filteredApplications = applications.filter(({ app }) => {
    const ts = Date.parse(app.appliedAt)
    return ts >= start.getTime() && ts < endExclusive.getTime()
  })

  function median(values: number[]): number | null {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    if (sorted.length % 2 === 1) return sorted[mid]
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1))
  }

  function summarize(appItems: ApplicationRecord[]) {
    const totalApplications = appItems.length
    const decisionItems = appItems.map((app) => app.finalInterviewResult || app.firstInterviewResult).filter((v): v is Decision => !!v)
    const passed = decisionItems.filter(v => v === 'PASS').length
    const decided = decisionItems.length
    const passRate = decided > 0 ? Number(((passed / decided) * 100).toFixed(1)) : 0

    const toInterviewDays = appItems
      .map((app) => {
        if (!app.firstInterviewDate) return null
        return Math.round((Date.parse(`${app.firstInterviewDate}T00:00:00.000Z`) - Date.parse(app.appliedAt)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const toNotifyDays = appItems
      .map((app) => {
        if (!app.firstInterviewDate || !app.firstResultNotifiedDate) return null
        return Math.round((Date.parse(`${app.firstResultNotifiedDate}T00:00:00.000Z`) - Date.parse(`${app.firstInterviewDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const appliedToFinalDecisionForHiredDays = appItems
      .map((app) => {
        if (app.finalInterviewResult !== 'PASS' || !app.appliedDate || !app.finalResultNotifiedDate) return null
        return Math.round((Date.parse(`${app.finalResultNotifiedDate}T00:00:00.000Z`) - Date.parse(`${app.appliedDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const appliedToFirstInterviewDays = appItems
      .map((app) => {
        if (!app.appliedDate || !app.firstInterviewDate) return null
        return Math.round((Date.parse(`${app.firstInterviewDate}T00:00:00.000Z`) - Date.parse(`${app.appliedDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const firstInterviewToFirstResultDays = appItems
      .map((app) => {
        if (!app.firstInterviewDate || !app.firstResultNotifiedDate) return null
        return Math.round((Date.parse(`${app.firstResultNotifiedDate}T00:00:00.000Z`) - Date.parse(`${app.firstInterviewDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const firstResultToFinalInterviewDays = appItems
      .map((app) => {
        if (!app.firstResultNotifiedDate || !app.finalInterviewDate) return null
        return Math.round((Date.parse(`${app.finalInterviewDate}T00:00:00.000Z`) - Date.parse(`${app.firstResultNotifiedDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    const finalInterviewToFinalResultDays = appItems
      .map((app) => {
        if (!app.finalInterviewDate || !app.finalResultNotifiedDate) return null
        return Math.round((Date.parse(`${app.finalResultNotifiedDate}T00:00:00.000Z`) - Date.parse(`${app.finalInterviewDate}T00:00:00.000Z`)) / (1000 * 60 * 60 * 24))
      })
      .filter((v): v is number => v !== null)

    return {
      totalApplications,
      passedInterviews: passed,
      decidedInterviews: decided,
      passRate,
      medianDaysAppliedToFinalDecisionForHired: median(appliedToFinalDecisionForHiredDays),
      medianDaysAppliedToFirstInterview: median(appliedToFirstInterviewDays),
      medianDaysFirstInterviewToFirstResult: median(firstInterviewToFirstResultDays),
      medianDaysFirstResultToFinalInterview: median(firstResultToFinalInterviewDays),
      medianDaysFinalInterviewToFinalResult: median(finalInterviewToFinalResultDays),
      medianDaysAppliedToInterview: median(toInterviewDays),
      medianDaysInterviewToNotification: median(toNotifyDays)
    }
  }

  const overall = summarize(filteredApplications.map(v => v.app))
  const statusCounts: Record<Status, number> = {
    APPLIED: 0,
    SCREENING: 0,
    INTERVIEW: 0,
    OFFER: 0,
    HIRED: 0,
    REJECTED: 0
  }
  filteredApplications.forEach(({ app }) => {
    statusCounts[app.status] += 1
  })

  const byGroupMap = new Map<string, { department: string; section: string; group: string; apps: ApplicationRecord[] }>()
  for (const { app } of filteredApplications) {
    const key = `${app.department}::${app.section}::${app.group}`
    if (!byGroupMap.has(key)) {
      byGroupMap.set(key, { department: app.department, section: app.section, group: app.group, apps: [] })
    }
    byGroupMap.get(key)!.apps.push(app)
  }

  const byGroup = Array.from(byGroupMap.values()).map((item) => ({
    department: item.department,
    section: item.section,
    group: item.group,
    ...summarize(item.apps)
  }))

  const periodDurationMs = endExclusive.getTime() - start.getTime()
  const previousPeriodRange = {
    start: new Date(start.getTime() - periodDurationMs),
    endExclusive: new Date(endExclusive.getTime() - periodDurationMs)
  }
  const samePeriodLastYearRange = {
    start: new Date(Date.UTC(start.getUTCFullYear() - 1, start.getUTCMonth(), start.getUTCDate(), 0, 0, 0, 0)),
    endExclusive: new Date(Date.UTC(endExclusive.getUTCFullYear() - 1, endExclusive.getUTCMonth(), endExclusive.getUTCDate(), 0, 0, 0, 0))
  }

  function filterAppsByRange(range: { start: Date; endExclusive: Date }) {
    return applications
      .map(v => v.app)
      .filter((app) => {
        const ts = Date.parse(app.appliedAt)
        return ts >= range.start.getTime() && ts < range.endExclusive.getTime()
      })
  }

  function summarizeLite(appItems: ApplicationRecord[]) {
    const s = summarize(appItems)
    return { totalApplications: s.totalApplications, passRate: s.passRate }
  }

  function summarizeByDimension(
    appItems: ApplicationRecord[],
    keyFn: (app: ApplicationRecord) => string,
    metaFn: (app: ApplicationRecord) => Record<string, string>
  ) {
    const m = new Map<string, { meta: Record<string, string>; apps: ApplicationRecord[] }>()
    for (const app of appItems) {
      const key = keyFn(app)
      if (!m.has(key)) m.set(key, { meta: metaFn(app), apps: [] })
      m.get(key)!.apps.push(app)
    }
    const out = new Map<string, { meta: Record<string, string>; totalApplications: number; passRate: number }>()
    for (const [key, value] of m.entries()) {
      out.set(key, { meta: value.meta, ...summarizeLite(value.apps) })
    }
    return out
  }

  function diffRate(current: number, prev: number) {
    if (prev === 0) return null
    return Number((((current - prev) / prev) * 100).toFixed(1))
  }

  function buildTrendYears() {
    if (period === 'monthly') {
      const baseYear = start.getUTCFullYear()
      return [baseYear - 2, baseYear - 1, baseYear]
    }
    return [filter.fiscalYear - 2, filter.fiscalYear - 1, filter.fiscalYear]
  }

  function buildRangeForTrendYear(year: number) {
    if (period === 'monthly') {
      return {
        start: new Date(Date.UTC(year, filter.month - 1, 1, 0, 0, 0, 0)),
        endExclusive: new Date(Date.UTC(year, filter.month, 1, 0, 0, 0, 0))
      }
    }
    return getPeriodRange(period, fiscalYearStartMonth, { ...filter, fiscalYear: year })
  }

  function trendLabel(year: number) {
    if (period === 'monthly') return `${year}年${filter.month}月`
    if (period === 'quarterly') return `${year}年度Q${filter.quarter}`
    if (period === 'halfyearly') return `${year}年度${filter.half === 1 ? '上期' : '下期'}`
    return `${year}年度`
  }

  const previousPeriodSummary = summarizeLite(filterAppsByRange(previousPeriodRange))
  const samePeriodLastYearSummary = summarizeLite(filterAppsByRange(samePeriodLastYearRange))

  const trendYears = buildTrendYears()
  const trendSeries = trendYears.map((year) => {
    const range = buildRangeForTrendYear(year)
    const appsInRange = filterAppsByRange(range)
    return {
      year,
      label: trendLabel(year),
      overall: summarizeLite(appsInRange),
      byDepartment: summarizeByDimension(appsInRange, (app) => app.department, (app) => ({ department: app.department })),
      bySection: summarizeByDimension(appsInRange, (app) => `${app.department}::${app.section}`, (app) => ({ department: app.department, section: app.section })),
      byGroupTrend: summarizeByDimension(
        appsInRange,
        (app) => `${app.department}::${app.section}::${app.group}`,
        (app) => ({ department: app.department, section: app.section, group: app.group })
      )
    }
  })

  const currentApps = filteredApplications.map(v => v.app)
  const previousYearApps = filterAppsByRange(samePeriodLastYearRange)

  function buildRows(
    currentMap: Map<string, { meta: Record<string, string>; totalApplications: number; passRate: number }>,
    previousYearMap: Map<string, { meta: Record<string, string>; totalApplications: number; passRate: number }>,
    trendGetter: (series: typeof trendSeries[number]) => Map<string, { meta: Record<string, string>; totalApplications: number; passRate: number }>
  ) {
    const keys = new Set<string>([
      ...currentMap.keys(),
      ...previousYearMap.keys(),
      ...trendSeries.flatMap((s) => Array.from(trendGetter(s).keys()))
    ])
    const rows = Array.from(keys).map((key) => {
      const currentValue = currentMap.get(key) || { meta: {}, totalApplications: 0, passRate: 0 }
      const prevValue = previousYearMap.get(key) || { meta: currentValue.meta, totalApplications: 0, passRate: 0 }
      const trend = trendSeries.map((series) => {
        const v = trendGetter(series).get(key) || { totalApplications: 0, passRate: 0 }
        return {
          label: series.label,
          totalApplications: v.totalApplications,
          passRate: v.passRate
        }
      })
      return {
        ...currentValue.meta,
        current: { totalApplications: currentValue.totalApplications, passRate: currentValue.passRate },
        previousYearSamePeriod: { totalApplications: prevValue.totalApplications, passRate: prevValue.passRate },
        diff: {
          totalApplications: currentValue.totalApplications - prevValue.totalApplications,
          totalApplicationsRate: diffRate(currentValue.totalApplications, prevValue.totalApplications),
          passRate: Number((currentValue.passRate - prevValue.passRate).toFixed(1))
        },
        trend
      }
    })
    return rows
  }

  const currentByDepartment = summarizeByDimension(currentApps, (app) => app.department, (app) => ({ department: app.department }))
  const previousYearByDepartment = summarizeByDimension(previousYearApps, (app) => app.department, (app) => ({ department: app.department }))
  const currentBySection = summarizeByDimension(currentApps, (app) => `${app.department}::${app.section}`, (app) => ({ department: app.department, section: app.section }))
  const previousYearBySection = summarizeByDimension(previousYearApps, (app) => `${app.department}::${app.section}`, (app) => ({ department: app.department, section: app.section }))
  const currentByGroup = summarizeByDimension(
    currentApps,
    (app) => `${app.department}::${app.section}::${app.group}`,
    (app) => ({ department: app.department, section: app.section, group: app.group })
  )
  const previousYearByGroup = summarizeByDimension(
    previousYearApps,
    (app) => `${app.department}::${app.section}::${app.group}`,
    (app) => ({ department: app.department, section: app.section, group: app.group })
  )

  return {
    ...overall,
    byGroup,
    statusCounts,
    comparison: {
      overall: {
        previousPeriod: previousPeriodSummary,
        previousYearSamePeriod: samePeriodLastYearSummary,
        diff: {
          previousPeriod: {
            totalApplications: overall.totalApplications - previousPeriodSummary.totalApplications,
            totalApplicationsRate: diffRate(overall.totalApplications, previousPeriodSummary.totalApplications),
            passRate: Number((overall.passRate - previousPeriodSummary.passRate).toFixed(1))
          },
          previousYearSamePeriod: {
            totalApplications: overall.totalApplications - samePeriodLastYearSummary.totalApplications,
            totalApplicationsRate: diffRate(overall.totalApplications, samePeriodLastYearSummary.totalApplications),
            passRate: Number((overall.passRate - samePeriodLastYearSummary.passRate).toFixed(1))
          }
        },
        trend: trendSeries.map((series) => ({
          label: series.label,
          totalApplications: series.overall.totalApplications,
          passRate: series.overall.passRate
        }))
      },
      byDepartment: buildRows(currentByDepartment, previousYearByDepartment, (series) => series.byDepartment),
      bySection: buildRows(currentBySection, previousYearBySection, (series) => series.bySection),
      byGroup: buildRows(currentByGroup, previousYearByGroup, (series) => series.byGroupTrend)
    }
  }
}

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, app: 'recruitment-webapp', time: Date.now() })
})

app.post('/api/recruitment/auth/login', (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  const normalized = email.trim().toLowerCase()
  const user = users.find(u => u.email.toLowerCase() === normalized)
  if (!user || !user.active || user.password !== password) {
    return res.status(401).json({ error: 'invalid credentials' })
  }

  return res.json({
    user: sanitizeUser(user),
    canAccessAdmin: isAdminRole(user.role)
  })
})

app.get('/api/recruitment/bootstrap', (_req, res) => {
  const period = ((_req.query.period as string) || 'monthly') as MetricPeriod
  const normalizedPeriod: MetricPeriod =
    period === 'quarterly' || period === 'halfyearly' || period === 'yearly' ? period : 'monthly'
  const filter = normalizeMetricFilter({
    month: Number(_req.query.targetMonth),
    quarter: Number(_req.query.targetQuarter),
    half: Number(_req.query.targetHalf),
    fiscalYear: Number(_req.query.targetFiscalYear)
  }, systemSettings.fiscalYearStartMonth)
  const metrics = calcRecruitingMetrics(normalizedPeriod, systemSettings.fiscalYearStartMonth, filter)
  const recruiterCount = users.filter(u => u.role === 'recruiter').length
  const interviewerCount = users.filter(u => u.role === 'interviewer').length
  const deptManagerCount = users.filter(u => u.role === 'dept_manager').length
  const techAdminCount = users.filter(u => u.role === 'tech_admin').length
  res.json({
    mode: 'dummy',
    auth: { type: 'email_password', sso: { enabled: false, planned: true }, initialPassword: INITIAL_PASSWORD },
    organization: {
      requiredHeadcount: { recruiter: recruiterCount, interviewer: interviewerCount, dept_manager: deptManagerCount, tech_admin: techAdminCount },
      currentAccounts: {
        recruiter: recruiterCount,
        interviewer: interviewerCount,
        dept_manager: deptManagerCount,
        tech_admin: techAdminCount
      },
      structure: ORG_STRUCTURE
    },
    retentionPolicy: {
      candidateDataYears: 10,
      auditLogYears: 15,
      piiPolicy: 'logical_delete_then_anonymize_after_10y'
    },
    settings: {
      fiscalYearStartMonth: systemSettings.fiscalYearStartMonth
    },
    metricPeriod: normalizedPeriod,
    metricFilter: filter,
    metrics,
    candidates
  })
})

app.get('/api/recruitment/admin/accounts', (req, res) => {
  const actorId = req.query.actorId as string | undefined
  const authz = requireAdmin(actorId)
  if (!authz.ok) return res.status(403).json({ error: 'admin access is restricted to recruiter/tech_admin' })
  return res.json({ accounts: users.map(sanitizeUser) })
})

app.post('/api/recruitment/admin/accounts', (req, res) => {
  const { actorId, name, email, role, title, department, section, group, active, password } = req.body as {
    actorId?: string
    name?: string
    email?: string
    role?: Role
    title?: string
    department?: string
    section?: string
    group?: string
    active?: boolean
    password?: string
  }

  const authz = requireAdmin(actorId)
  if (!authz.ok) return res.status(403).json({ error: 'admin access is restricted to recruiter/tech_admin' })

  if (!name || !email || !role || !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: 'name, email, role are required' })
  }

  const normalized = email.trim().toLowerCase()
  if (users.some(u => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({ error: 'email already exists' })
  }

  const now = new Date().toISOString()
  const defaultTitle =
    role === 'recruiter' ? '採用担当' :
    role === 'interviewer' ? '面接官' :
    role === 'dept_manager' ? '部長' :
    '技術部門担当者'
  const created: UserAccount = {
    id: nextId('user'),
    name,
    email: normalized,
    role,
    title: title || defaultTitle,
    department,
    section,
    group,
    active: active !== false,
    password: password || INITIAL_PASSWORD,
    createdAt: now,
    updatedAt: now
  }

  users.push(created)
  return res.status(201).json(sanitizeUser(created))
})

app.patch('/api/recruitment/admin/accounts/:id', (req, res) => {
  const { id } = req.params
  const { actorId, name, email, role, title, department, section, group, active, password } = req.body as {
    actorId?: string
    name?: string
    email?: string
    role?: Role
    title?: string
    department?: string
    section?: string
    group?: string
    active?: boolean
    password?: string
  }

  const authz = requireAdmin(actorId)
  if (!authz.ok) return res.status(403).json({ error: 'admin access is restricted to recruiter/tech_admin' })

  const target = users.find(u => u.id === id)
  if (!target) return res.status(404).json({ error: 'account not found' })

  if (role && !ALL_ROLES.includes(role)) {
    return res.status(400).json({ error: 'invalid role' })
  }

  if (email) {
    const normalized = email.trim().toLowerCase()
    if (users.some(u => u.id !== id && u.email.toLowerCase() === normalized)) {
      return res.status(409).json({ error: 'email already exists' })
    }
    target.email = normalized
  }

  if (name !== undefined) target.name = name
  if (role) target.role = role
  if (title !== undefined) target.title = title
  if (department !== undefined) target.department = department
  if (section !== undefined) target.section = section
  if (group !== undefined) target.group = group
  if (typeof active === 'boolean') target.active = active
  if (password) target.password = password
  target.updatedAt = new Date().toISOString()

  return res.json(sanitizeUser(target))
})

app.get('/api/recruitment/admin/settings', (req, res) => {
  const actorId = req.query.actorId as string | undefined
  const authz = requireAdmin(actorId)
  if (!authz.ok) return res.status(403).json({ error: 'admin access is restricted to recruiter/tech_admin' })
  return res.json({ settings: systemSettings })
})

app.patch('/api/recruitment/admin/settings', (req, res) => {
  const { actorId, fiscalYearStartMonth } = req.body as {
    actorId?: string
    fiscalYearStartMonth?: number
  }

  const authz = requireAdmin(actorId)
  if (!authz.ok) return res.status(403).json({ error: 'admin access is restricted to recruiter/tech_admin' })

  if (!fiscalYearStartMonth || !ALLOWED_FISCAL_START_MONTHS.includes(fiscalYearStartMonth as FiscalYearStartMonth)) {
    return res.status(400).json({ error: 'fiscalYearStartMonth must be one of 1, 4, 9' })
  }

  systemSettings.fiscalYearStartMonth = fiscalYearStartMonth as FiscalYearStartMonth
  return res.json({ settings: systemSettings })
})

app.post('/api/recruitment/candidates', (req, res) => {
  const body = req.body as Partial<CandidateRecord>
  if (!body.fullName || !body.email || !body.phone || !body.appliedRole) {
    return res.status(400).json({ error: 'fullName, email, phone, appliedRole are required' })
  }

  const now = new Date().toISOString()
  const nextDepartment = (body.applications?.[0]?.department as string) || ORG_GROUPS[0]?.department || '未設定'
  const nextSection = (body.applications?.[0]?.section as string) || ORG_GROUPS[0]?.section || '未設定'
  const nextGroup = (body.applications?.[0]?.group as string) || ORG_GROUPS[0]?.group || '未設定'
  const nextAppliedDate = (body.applications?.[0]?.appliedDate as string) || now.slice(0, 10)
  const nextFirstInterviewers = (body.applications?.[0]?.firstInterviewers as string[] | undefined) || []
  const nextFinalInterviewers = (body.applications?.[0]?.finalInterviewers as string[] | undefined) || []

  const created: CandidateRecord = {
    id: nextId('cand'),
    fullName: body.fullName,
    email: body.email,
    phone: body.phone,
    appliedRole: body.appliedRole,
    documentUrls: Array.isArray(body.documentUrls) ? body.documentUrls.filter(v => typeof v === 'string') : [],
    createdAt: now,
    applications: [
      {
        id: nextId('app'),
        department: nextDepartment,
        section: nextSection,
        group: nextGroup,
        appliedDate: nextAppliedDate,
        firstInterviewDate: body.applications?.[0]?.firstInterviewDate as string | undefined,
        firstInterviewers: nextFirstInterviewers.filter(v => typeof v === 'string').slice(0, 2),
        firstInterviewResult: body.applications?.[0]?.firstInterviewResult as Decision | undefined,
        firstInterviewerComment: body.applications?.[0]?.firstInterviewerComment as string | undefined,
        firstRecruiterComment: body.applications?.[0]?.firstRecruiterComment as string | undefined,
        firstResultNotifiedDate: body.applications?.[0]?.firstResultNotifiedDate as string | undefined,
        finalInterviewDate: body.applications?.[0]?.finalInterviewDate as string | undefined,
        finalInterviewers: nextFinalInterviewers.filter(v => typeof v === 'string').slice(0, 2),
        finalInterviewResult: body.applications?.[0]?.finalInterviewResult as Decision | undefined,
        finalInterviewerComment: body.applications?.[0]?.finalInterviewerComment as string | undefined,
        finalRecruiterComment: body.applications?.[0]?.finalRecruiterComment as string | undefined,
        finalResultNotifiedDate: body.applications?.[0]?.finalResultNotifiedDate as string | undefined,
        status: 'APPLIED',
        appliedAt: now,
        interviews: [],
        statusHistory: [{ from: null, to: 'APPLIED', changedAt: now, changedByRole: 'recruiter' }]
      }
    ]
  }
  candidates.unshift(created)
  res.status(201).json(created)
})

app.patch('/api/recruitment/candidates/:id', (req, res) => {
  const { id } = req.params
  const body = req.body as Partial<CandidateRecord>
  const target = candidates.find(c => c.id === id)
  if (!target) return res.status(404).json({ error: 'candidate not found' })

  if (!body.fullName || !body.email || !body.phone || !body.appliedRole) {
    return res.status(400).json({ error: 'fullName, email, phone, appliedRole are required' })
  }

  target.fullName = body.fullName
  target.email = body.email
  target.phone = body.phone
  target.appliedRole = body.appliedRole
  target.documentUrls = Array.isArray(body.documentUrls) ? body.documentUrls.filter(v => typeof v === 'string') : []

  const nextDepartment = body.applications?.[0]?.department
  const nextSection = body.applications?.[0]?.section
  const nextGroup = body.applications?.[0]?.group
  const incomingApp = body.applications?.[0] as any
  const app = target.applications[0]
  if (nextDepartment && target.applications[0]) {
    target.applications[0].department = nextDepartment
  }
  if (nextSection && target.applications[0]) {
    target.applications[0].section = nextSection
  }
  if (nextGroup && target.applications[0]) {
    target.applications[0].group = nextGroup
  }
  if (app) {
    if (incomingApp && 'appliedDate' in incomingApp) app.appliedDate = incomingApp.appliedDate || app.appliedDate
    if (incomingApp && 'firstInterviewDate' in incomingApp) app.firstInterviewDate = incomingApp.firstInterviewDate || undefined
    if (incomingApp && 'firstInterviewers' in incomingApp) {
      app.firstInterviewers = (Array.isArray(incomingApp.firstInterviewers) ? incomingApp.firstInterviewers : []).filter((v: unknown): v is string => typeof v === 'string').slice(0, 2)
    }
    if (incomingApp && 'firstInterviewResult' in incomingApp) app.firstInterviewResult = incomingApp.firstInterviewResult || undefined
    if (incomingApp && 'firstInterviewerComment' in incomingApp) app.firstInterviewerComment = incomingApp.firstInterviewerComment || undefined
    if (incomingApp && 'firstRecruiterComment' in incomingApp) app.firstRecruiterComment = incomingApp.firstRecruiterComment || undefined
    if (incomingApp && 'firstResultNotifiedDate' in incomingApp) app.firstResultNotifiedDate = incomingApp.firstResultNotifiedDate || undefined
    if (incomingApp && 'finalInterviewDate' in incomingApp) app.finalInterviewDate = incomingApp.finalInterviewDate || undefined
    if (incomingApp && 'finalInterviewers' in incomingApp) {
      app.finalInterviewers = (Array.isArray(incomingApp.finalInterviewers) ? incomingApp.finalInterviewers : []).filter((v: unknown): v is string => typeof v === 'string').slice(0, 2)
    }
    if (incomingApp && 'finalInterviewResult' in incomingApp) app.finalInterviewResult = incomingApp.finalInterviewResult || undefined
    if (incomingApp && 'finalInterviewerComment' in incomingApp) app.finalInterviewerComment = incomingApp.finalInterviewerComment || undefined
    if (incomingApp && 'finalRecruiterComment' in incomingApp) app.finalRecruiterComment = incomingApp.finalRecruiterComment || undefined
    if (incomingApp && 'finalResultNotifiedDate' in incomingApp) app.finalResultNotifiedDate = incomingApp.finalResultNotifiedDate || undefined
  }

  return res.json(target)
})

app.patch('/api/recruitment/interviews/:id/feedback', (req, res) => {
  const { id } = req.params
  const { interviewerDecision, interviewerComment, recruiterComment } = req.body as {
    interviewerDecision?: Decision
    interviewerComment?: string
    recruiterComment?: string
  }

  if (!interviewerDecision || (interviewerDecision !== 'PASS' && interviewerDecision !== 'FAIL') || !interviewerComment) {
    return res.status(400).json({ error: 'interviewerDecision(PASS/FAIL) and interviewerComment are required' })
  }

  for (const candidate of candidates) {
    for (const appItem of candidate.applications) {
      const interview = appItem.interviews.find(v => v.id === id)
      if (interview) {
        interview.feedback = {
          interviewerDecision,
          interviewerComment,
          recruiterComment
        }
        if (!interview.resultNotifiedAt) interview.resultNotifiedAt = new Date().toISOString()
        return res.json(interview)
      }
    }
  }

  return res.status(404).json({ error: 'interview not found' })
})

app.patch('/api/recruitment/applications/:id/status', (req, res) => {
  const { id } = req.params
  const { status, actorRole } = req.body as { status?: Status; actorRole?: Role }
  const allowedRoles: Role[] = ['recruiter', 'dept_manager']
  const allowedStatuses: Status[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED']
  if (!status || !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'invalid status' })
  }
  if (!actorRole || !allowedRoles.includes(actorRole)) {
    return res.status(403).json({ error: 'only recruiter or dept_manager can change status' })
  }

  for (const candidate of candidates) {
    const appItem = candidate.applications.find(v => v.id === id)
    if (appItem) {
      const from = appItem.status
      appItem.status = status
      appItem.statusHistory.push({
        from,
        to: status,
        changedAt: new Date().toISOString(),
        changedByRole: actorRole
      })
      return res.json(appItem)
    }
  }
  return res.status(404).json({ error: 'application not found' })
})

const port = process.env.PORT || 3101
app.listen(Number(port), () => {
  console.log(`Recruitment backend running on http://localhost:${port}`)
})
