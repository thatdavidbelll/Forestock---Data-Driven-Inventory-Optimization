import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import api from '../lib/api'
import { captureEvent } from '../lib/analytics'
import { extractErrorMessage } from '../lib/errors'

interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

interface ImportPreview {
  detectedColumns: string[]
  expectedColumns: string[]
  columnMatch: boolean
  sample: Array<Record<string, string>>
  totalRowsInFile: number
  existingSkuMatches: number
  newSkus: string[]
  dateFormatDetected: string | null
  errors: string[]
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [forecastStarted, setForecastStarted] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(f: File | null) {
    if (!f) return
    if (!f.name.endsWith('.csv')) {
      setError('Only .csv files are accepted.')
      return
    }
    setError('')
    setPreview(null)
    setForecastStarted(false)
    setResult(null)
    setFile(f)
    await loadPreview(f)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    void handleFile(e.dataTransfer.files[0] ?? null)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    void handleFile(e.target.files?.[0] ?? null)
  }

  async function loadPreview(nextFile: File) {
    setPreviewLoading(true)
    setError('')
    const form = new FormData()
    form.append('file', nextFile)

    try {
      const { data } = await api.post('/sales/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPreview(data.data)
    } catch (e: unknown) {
      setPreview(null)
      setError(extractErrorMessage(e, 'Failed to preview CSV.'))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleSubmit() {
    if (!file || !preview || previewLoading || preview.errors.length > 0 || !preview.columnMatch) return
    setLoading(true)
    setError('')
    setForecastStarted(false)
    setResult(null)
    const form = new FormData()
    form.append('file', file)
    try {
      const { data } = await api.post(`/sales/import?overwriteExisting=${overwrite}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data.data)
      captureEvent('csv_imported', {
        imported: data.data?.imported ?? 0,
        skipped: data.data?.skipped ?? 0,
        errorCount: data.data?.errors?.length ?? 0,
      })
      setForecastStarted((data.data?.imported ?? 0) > 0)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e: unknown) {
      setError(extractErrorMessage(e, 'Upload failed.'))
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

        {previewLoading && (
          <p className="text-sm text-gray-500 rounded-lg bg-gray-50 px-3 py-2">
            Analyzing CSV structure and matching SKUs…
          </p>
        )}

        {preview && (
          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className={`rounded-lg px-3 py-2 text-sm ${
              preview.columnMatch && preview.errors.length === 0
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {preview.columnMatch
                ? 'Columns match expected format.'
                : `Column mismatch: found ${preview.detectedColumns.join(', ') || 'no headers'}, expected ${preview.expectedColumns.join(', ')}`}
            </div>

            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Rows detected</p>
                <p className="mt-1 font-semibold text-gray-900">{preview.totalRowsInFile}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Existing SKU matches</p>
                <p className="mt-1 font-semibold text-gray-900">{preview.existingSkuMatches}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Date format</p>
                <p className="mt-1 font-semibold text-gray-900">{preview.dateFormatDetected ?? '—'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-sm font-medium text-gray-800">
                {preview.totalRowsInFile} rows detected — {preview.existingSkuMatches} SKUs match existing products, {preview.newSkus.length} SKUs are new
              </p>
              {preview.newSkus.length > 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  New SKUs: {preview.newSkus.slice(0, 8).join(', ')}{preview.newSkus.length > 8 ? '…' : ''}
                </p>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-100 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">SKU</th>
                    <th className="px-3 py-2 text-left">Sale Date</th>
                    <th className="px-3 py-2 text-left">Quantity</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.sample.map((row, index) => (
                    <tr key={`${row.sku}-${index}`}>
                      <td className="px-3 py-2 text-gray-700">{row.sku || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.sale_date || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.quantity_sold || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{row.errors || 'OK'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings</p>
                <ul className="mt-2 space-y-1">
                  {preview.errors.map((previewError, index) => (
                    <li key={index} className="text-xs text-amber-700">{previewError}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || loading || previewLoading || !preview || preview.errors.length > 0 || !preview.columnMatch}
          className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Importing…' : 'Confirm Import'}
        </button>
      </div>

      {result && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Import Result</h2>
          {forecastStarted && (
            <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              Import complete. A forecast is running in the background — check the Dashboard in a few seconds.
            </p>
          )}
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
