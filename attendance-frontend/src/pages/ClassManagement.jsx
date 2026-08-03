import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listClasses, createClass, deleteClass } from '../api/classes'

export default function ClassManagement() {
  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setClasses(await listClasses())
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const created = await createClass({
        name: name.trim(),
        code: code.trim(),
        description: description.trim(),
      })
      setClasses((prev) => [...prev, created])
      setName('')
      setCode('')
      setDescription('')
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create class')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this class? This cannot be undone.')) return
    setError('')
    try {
      await deleteClass(id)
      setClasses((prev) => prev.filter((c) => c.id !== id))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete class')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-brand-dark">Class Management</h1>
          <p className="text-sm text-slate-500">Create classes and enrol students into them</p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="text-sm text-slate-600 hover:text-brand"
        >
          ← Back to dashboard
        </button>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2 border border-red-200">
            {error}
          </div>
        )}

        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class Name</label>
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Grade 10 - Section A"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class Code</label>
              <input
                required
                maxLength={20}
                pattern="[A-Za-z0-9_-]{2,20}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="10A"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="Optional"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-brand hover:bg-brand-dark text-white font-medium rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-60"
          >
            {saving ? 'Creating…' : 'Create Class'}
          </button>
        </form>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-medium text-slate-800">Classes</h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-slate-500">Loading classes…</p>
          ) : classes.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No classes yet. Create your first class above.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Code</th>
                  <th className="px-6 py-3 font-medium">Students</th>
                  <th className="px-6 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-3">{c.name}</td>
                    <td className="px-6 py-3 font-mono text-xs">{c.code}</td>
                    <td className="px-6 py-3">{c.studentCount}</td>
                    <td className="px-6 py-3 space-x-3">
                      <button
                        onClick={() => navigate(`/admin/students/register?classId=${c.id}`)}
                        className="text-brand text-xs font-medium hover:underline"
                      >
                        Add student
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="text-red-600 text-xs font-medium hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  )
}
