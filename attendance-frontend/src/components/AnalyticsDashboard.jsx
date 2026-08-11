import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { getAdminAnalytics, getTeacherAnalytics } from '../api/analytics'

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  primary: '#2563EB',
  accent:  '#3B82F6',
  light:   '#60A5FA',
  success: '#16A34A',
  warning: '#F59E0B',
  danger:  '#DC2626',
  navy:    '#0F172A',
  border:  '#E2E8F0',
  surface: '#F8FAFC',
  text:    '#0F172A',
  muted:   '#64748B',
}

const RANGE_OPTIONS = [
  { label: 'Last 7 days',  days: 7  },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
]

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return <h2 className="text-base font-semibold text-text-primary mb-4">{children}</h2>
}

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <p className="text-sm font-semibold text-text-primary mb-4">{title}</p>
      {children}
    </div>
  )
}

function EmptyState({ message = 'No data available for this period.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5">
          <path d="M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2z M15 13v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2 M21 9v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="ml-3 text-sm text-text-secondary">Loading analytics…</span>
    </div>
  )
}

// Custom tooltip for charts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-border rounded-lg shadow-card-md px-3 py-2 text-xs">
      <p className="font-semibold text-text-primary mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{p.value}{p.name.includes('%') || p.name === 'Attendance %' ? '%' : ''}</span>
        </p>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, iconPath, color, textColor }) {
  return (
    <div className="card p-5 flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${textColor || 'text-text-primary'}`}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-text-secondary mt-1">{sub}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AnalyticsDashboard({ role }) {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = role === 'ADMIN'
        ? await getAdminAnalytics(days)
        : await getTeacherAnalytics(days)
      setData(result)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load analytics data.')
    } finally {
      setLoading(false)
    }
  }, [days, role])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Distribution data for bar chart ────────────────────────────────────────
  const distributionData = data ? [
    { range: '≥ 90%',    count: data.above90,        fill: C.primary },
    { range: '75–89%',   count: data.between75and89, fill: C.warning },
    { range: '< 75%',    count: data.below75,        fill: C.danger  },
  ] : []

  // ── Doughnut center label ───────────────────────────────────────────────────
  const totalAttendance = data
    ? (data.overallPresent + data.overallAbsent > 0
        ? Math.round(data.overallPresent * 1000 / (data.overallPresent + data.overallAbsent)) / 10
        : 0)
    : 0

  const pieData = data ? [
    { name: 'Present', value: data.overallPresent },
    { name: 'Absent',  value: data.overallAbsent  },
  ] : []

  return (
    <div className="mt-10">
      {/* ── Section header + range filter ──────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Attendance Analytics</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {role === 'ADMIN' ? 'Institution-wide attendance insights' : 'Your class attendance insights'}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                days === opt.days
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
          <button onClick={fetchData} className="ml-auto underline font-medium">Retry</button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !data ? null : (
        <>
          {/* ── Summary stat cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {role === 'ADMIN' ? (
              <>
                <StatCard label="Total Students"  value={data.totalStudents}
                  iconPath="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75"
                  color="bg-primary" />
                <StatCard label="Total Teachers"  value={data.totalTeachers}
                  iconPath="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  color="bg-primary-accent" />
                <StatCard label="Total Classes"   value={data.totalClasses}
                  iconPath="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
                  color="bg-slate-600" />
                <StatCard label="Today's Attendance" value={`${data.todayAttendancePct}%`}
                  sub="Based on today's sessions"
                  iconPath="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3"
                  color={data.todayAttendancePct >= 75 ? 'bg-success' : 'bg-warning'}
                  textColor={data.todayAttendancePct >= 75 ? 'text-success' : 'text-warning'} />
              </>
            ) : (
              <>
                <StatCard label="My Classes"      value={data.totalClasses}
                  iconPath="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"
                  color="bg-primary" />
                <StatCard label="Total Students"  value={data.totalStudents}
                  iconPath="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  color="bg-primary-accent" />
                <StatCard label="Overall Present" value={data.overallPresent}
                  iconPath="M22 11.08V12a10 10 0 1 1-5.93-9.14 M22 4L12 14.01l-3-3"
                  color="bg-success" textColor="text-success" />
                <StatCard label="Today's Attendance" value={`${data.todayAttendancePct}%`}
                  iconPath="M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
                  color={data.todayAttendancePct >= 75 ? 'bg-success' : 'bg-warning'}
                  textColor={data.todayAttendancePct >= 75 ? 'text-success' : 'text-warning'} />
              </>
            )}
          </div>

          {/* ── Attendance Trend ────────────────────────────────────────────── */}
          <ChartCard title="Attendance Trend" className="mb-6">
            {data.trend.every((d) => d.total === 0) ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trend} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="pct" name="Attendance %" stroke={C.primary} strokeWidth={2.5}
                    dot={{ r: 3, fill: C.primary, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: C.primary }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* ── Present vs Absent + Class-wise ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Doughnut */}
            <ChartCard title="Present vs Absent">
              {data.overallPresent + data.overallAbsent === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex items-center justify-center gap-8">
                  <div className="relative">
                    <PieChart width={180} height={180}>
                      <Pie data={pieData} cx={85} cy={85} innerRadius={55} outerRadius={80}
                        dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
                        <Cell fill={C.primary} />
                        <Cell fill={C.border} />
                      </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-2xl font-bold text-text-primary">{totalAttendance}%</span>
                      <span className="text-xs text-text-secondary">Attendance</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: C.primary }} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{data.overallPresent.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Present</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: C.border }} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{data.overallAbsent.toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Absent</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ChartCard>

            {/* Class-wise bar */}
            <ChartCard title="Class-wise Attendance">
              {data.classAttendance.length === 0 ? (
                <EmptyState />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data.classAttendance} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barSize={20}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="className" tick={{ fontSize: 10, fill: C.muted }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="pct" name="Attendance %" fill={C.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* ── Attendance Distribution ─────────────────────────────────────── */}
          <ChartCard title="Student Attendance Distribution" className="mb-6">
            {data.above90 + data.between75and89 + data.below75 === 0 ? (
              <EmptyState />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={distributionData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barSize={40}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 12, fill: C.muted }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: C.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Students" radius={[4, 4, 0, 0]}>
                      {distributionData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex sm:flex-col gap-4 sm:gap-3 flex-shrink-0">
                  {[
                    { label: '≥ 90% (Good)',    value: data.above90,        color: C.primary },
                    { label: '75–89% (Average)', value: data.between75and89, color: C.warning },
                    { label: '< 75% (Critical)', value: data.below75,        color: C.danger  },
                  ].map((b) => (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                      <div>
                        <p className="text-sm font-bold text-text-primary">{b.value}</p>
                        <p className="text-xs text-text-secondary">{b.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>

          {/* ── Low Attendance Students ─────────────────────────────────────── */}
          <div className="card overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <p className="font-semibold text-text-primary">Low Attendance Students</p>
                <p className="text-xs text-text-secondary mt-0.5">Students below 75% attendance threshold</p>
              </div>
              {data.lowAttendanceStudents.length > 0 && (
                <span className="badge-danger">{data.lowAttendanceStudents.length} students</span>
              )}
            </div>
            {data.lowAttendanceStudents.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-success font-medium">✓ All students are above 75% attendance</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface border-b border-border text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Roll No.</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Attendance</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.lowAttendanceStudents.map((s) => (
                      <tr key={s.studentId} className="hover:bg-surface transition-colors">
                        <td className="px-6 py-3 font-medium text-text-primary">{s.name}</td>
                        <td className="px-6 py-3 font-mono text-xs text-text-secondary">{s.rollNumber}</td>
                        <td className="px-6 py-3 text-text-secondary">{s.className}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.pct < 50 ? C.danger : C.warning }} />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: s.pct < 50 ? C.danger : C.warning }}>{s.pct}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className={s.pct < 50 ? 'badge-danger' : 'badge-neutral text-warning border border-yellow-200 bg-yellow-50'}>
                            {s.pct < 50 ? 'Critical' : 'Warning'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Recent Attendance Activity ──────────────────────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <p className="font-semibold text-text-primary">Recent Attendance Activity</p>
              <p className="text-xs text-text-secondary mt-0.5">Latest completed sessions</p>
            </div>
            {data.recentSessions.length === 0 ? (
              <EmptyState message="No completed sessions in this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface border-b border-border text-left">
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Class</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Present</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Absent</th>
                      <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recentSessions.map((s, i) => (
                      <tr key={i} className="hover:bg-surface transition-colors">
                        <td className="px-6 py-3 text-text-secondary">{s.date}</td>
                        <td className="px-6 py-3 font-medium text-text-primary">{s.className}</td>
                        <td className="px-6 py-3 text-success font-medium">{s.present}</td>
                        <td className="px-6 py-3 text-danger font-medium">{s.absent}</td>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${s.pct}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${s.pct >= 75 ? 'text-primary' : 'text-warning'}`}>{s.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
