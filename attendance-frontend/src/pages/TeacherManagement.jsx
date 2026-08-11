import { useState, useEffect, useCallback } from 'react'
import { listTeachers, createTeacher, deleteTeacher, assignTeacher } from '../api/teachers'
import { listClasses } from '../api/classes'

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([])
  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([listTeachers(), listClasses()])
      setTeachers(t); setClasses(c)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('')
    try {
      const t = await createTeacher({ name, email, password })
      setTeachers((prev) => [...prev, t])
      setName(''); setEmail(''); setPassword('')
      setSuccess(`Teacher "${t.name}" created successfully.`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create teacher')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id, tname) => {
    if (!window.confirm(`Delete teacher "${tname}"?`)) return
    setError('')
    try {
      await deleteTeacher(id)
      setTeachers((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete teacher')
    }
  }

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedClass || !selectedTeacher) return
    setError(''); setSuccess('')
    try {
      const updated = await assignTeacher(Number(selectedClass), Number(selectedTeacher))
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSuccess('Teacher assigned successfully.')
      setSelectedClass(''); setSelectedTeacher('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to assign teacher')
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Teacher Management</h1>
        <p className="text-text-secondary text-sm mt-1">Create teachers and assign them to classes</p>
      </div>

      {error && <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">{error}</div>}
      {success && <div className="bg-green-50 text-success text-sm rounded-lg px-4 py-3 border border-green-200 mb-6">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Create teacher */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-text-primary mb-5">Add New Teacher</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Full Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Dr. Arun Kumar" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="arun@university.edu" />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
              <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="Min. 6 characters" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">
              {saving ? 'Creating…' : 'Create Teacher'}
            </button>
          </form>
        </div>

        {/* Assign teacher */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-text-primary mb-5">Assign Teacher to Class</h2>
          <form onSubmit={handleAssign} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Teacher</label>
              <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="input">
                <option value="">Select Teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Class</label>
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="input">
                <option value="">Select Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={!selectedClass || !selectedTeacher} className="btn-primary w-full">
              Assign Teacher
            </button>
          </form>
        </div>
      </div>

      {/* Teachers table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">All Teachers</h2>
          <span className="badge-blue">{teachers.length} total</span>
        </div>
        {teachers.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">No teachers yet. Create one above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {teachers.map((t) => (
                <tr key={t.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-3 font-medium text-text-primary">{t.name}</td>
                  <td className="px-6 py-3 text-text-secondary">{t.email}</td>
                  <td className="px-6 py-3">
                    <button onClick={() => handleDelete(t.id, t.name)} className="text-danger text-xs font-medium hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Class assignments table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">Class Assignments</h2>
        </div>
        {classes.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">No classes yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Class Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Assigned Teacher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-3 font-medium text-text-primary">{c.name}</td>
                  <td className="px-6 py-3"><span className="font-mono text-xs bg-primary-light text-primary px-2 py-1 rounded">{c.code}</span></td>
                  <td className="px-6 py-3">
                    {c.teacherName
                      ? <span className="badge-blue">{c.teacherName}</span>
                      : <span className="text-text-secondary italic text-xs">Unassigned</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
