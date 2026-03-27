import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import api from '../lib/api'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File | null) {
    if (!f) return
    if (!f.name.endsWith('.csv')) {
      setError('Only .csv files are accepted.')
      return
    }
    setError('')
    setResult(null)
    setFile(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0] ?? null)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0] ?? null)
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await api.post(`/sales/import?overwriteExisting=${overwrite}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data.data)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Import Sales</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Expected CSV format</p>
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-600">
            sku,sale_date,quantity_sold{'\n'}
            PROD-001,2026-03-01,42{'\n'}
            PROD-002,2026-03-01,18
          </pre>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv" onChange={onInputChange} className="hidden" />
          {file ? (
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500">Drop a CSV file here, or click to browse</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Overwrite existing records for the same product + date</span>
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!file || loading}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Uploading…' : 'Upload CSV'}
        </button>
      </div>

      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Import Result</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.imported}</p>
              <p className="text-xs text-green-600 mt-0.5">Imported</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-600">{result.skipped}</p>
              <p className="text-xs text-gray-500 mt-0.5">Skipped</p>
            </div>
            <div className={`border rounded-lg p-3 text-center ${result.errors.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-2xl font-bold ${result.errors.length > 0 ? 'text-red-700' : 'text-gray-600'}`}>
                {result.errors.length}
              </p>
              <p className={`text-xs mt-0.5 ${result.errors.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-medium text-red-700 mb-2">Error details:</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
