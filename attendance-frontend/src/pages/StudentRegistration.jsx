import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listClasses } from '../api/classes'
import { registerStudent } from '../api/students'

const MAX_PHOTOS = 10
const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp']

export default function StudentRegistration() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [classes, setClasses] = useState([])
  const [name, setName] = useState('')
  const [rollNumber, setRollNumber] = useState('')
  const [email, setEmail] = useState('')
  const [classId, setClassId] = useState(searchParams.get('classId') || '')
  const [previews, setPreviews] = useState([]) // [{ file, url }]
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch(() => setError('Failed to load classes'))
  }, [])

  const validateAndAddFiles = (files) => {
    setError('')
    const additions = []
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(`${file.name} is not a supported image type`)
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setError(`${file.name} exceeds the 8MB limit`)
        continue
      }
      additions.push({ file, url: URL.createObjectURL(file) })
    }
    if (previews.length + additions.length > MAX_PHOTOS) {
      setError(`You can upload at most ${MAX_PHOTOS} photos`)
      return
    }
    if (additions.length) setPreviews((prev) => [...prev, ...additions])
  }

  const handleFiles = (e) => {
    validateAndAddFiles(Array.from(e.target.files || []))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePreview = (url) => {
    URL.revokeObjectURL(url)
    setPreviews((prev) => prev.filter((p) => p.url !== url))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (previews.length === 0) {
      setError('Add at least one photo of the student')
      return
    }
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const student = await registerStudent({
        name: name.trim(),
        rollNumber: rollNumber.trim(),
        email: email.trim() || undefined,
        classId: Number(classId),
        files: previews.map((p) => p.file),
      })
      setSuccess(
        `Registered ${student.name} (${student.rollNumber}) with ${student.embeddingCount} face embedding(s).`
      )
      setName('')
      setRollNumber('')
      setEmail('')
      setClassId('')
      previews.forEach((p) => URL.revokeObjectURL(p.url))
      setPreviews([])
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = name.trim() && rollNumber.trim() && classId && previews.length > 0 && !loading

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-brand-dark">Student Registration</h1>
          <p className="text-sm text-slate-500">
            Upload multiple photos — a face is detected and an ArcFace embedding is stored per photo
          </p>
        </div>
        <button
          onClick={() => navigate('/admin')}
          className="text-sm text-slate-600 hover:text-brand"
        >
          ← Back to dashboard
        </button>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2 border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 text-sm rounded-md px-3 py-2 border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="Aarav Sharma"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number</label>
              <input
                required
                maxLength={40}
                pattern="[A-Za-z0-9-_]+"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="10A-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional)</label>
              <input
                type="email"
                maxLength={120}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="aarav@student.edu"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Face Photos ({previews.length}/{MAX_PHOTOS})
            </label>
            <div className="flex flex-wrap gap-3">
              {previews.map((p) => (
                <div key={p.url} className="relative">
                  <img
                    src={p.url}
                    alt="preview"
                    className="h-24 w-24 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removePreview(p.url)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-5 w-5 text-xs leading-none"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
              {previews.length < MAX_PHOTOS && (
                <label className="h-24 w-24 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 cursor-pointer hover:border-brand hover:text-brand text-xs text-center px-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                  />
                  Add photos
                </label>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Use 3–5 clear, front-facing photos for best recognition accuracy.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-brand hover:bg-brand-dark text-white font-medium rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Registering & generating embeddings…' : 'Register Student'}
          </button>
        </form>
      </main>
    </div>
  )
}
