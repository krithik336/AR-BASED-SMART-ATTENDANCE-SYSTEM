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

  useEffect(() => { load() }, [load])

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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Class Management</h1>
        <p className="text-text-secondary text-sm mt-1">Create classes and enrol students into them</p>
      </div>

      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">{error}</div>
      )}

      <form onSubmit={handleCreate} className="card p-6 space-y-4 mb-6">
        <h2 className="text-base font-semibold text-text-primary">Create New Class</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Class Name</label>
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Grade 10 - Section A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Class Code</label>
            <input
              required
              maxLength={20}
              pattern="[A-Za-z0-9_-]{2,20}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input"
              placeholder="10A"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Description</label>
          <textarea
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="Optional"
          />
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Creating…' : 'Create Class'}
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">All Classes</h2>
          <span className="badge-blue">{classes.length} total</span>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-text-secondary">Loading classes…</p>
        ) : classes.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">No classes yet. Create your first class above.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Students</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {classes.map((c) => (
                <tr key={c.id} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-3 font-medium text-text-primary">{c.name}</td>
                  <td className="px-6 py-3">
                    <span className="font-mono text-xs bg-primary-light text-primary px-2 py-1 rounded">{c.code}</span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">{c.studentCount}</td>
                  <td className="px-6 py-3 flex items-center gap-3">
                    <button
                      onClick={() => navigate(`/admin/students/register?classId=${c.id}`)}
                      className="text-primary text-xs font-medium hover:underline"
                    >
                      Add student
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-danger text-xs font-medium hover:underline"
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
    </div>
  )
}
