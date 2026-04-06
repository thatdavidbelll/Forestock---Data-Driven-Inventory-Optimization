import type { Dispatch, SetStateAction } from 'react'
import type { ImportResult } from './types'

interface ProductImportModalProps {
  isOpen: boolean
  importFile: File | null
  setImportFile: Dispatch<SetStateAction<File | null>>
  updateExisting: boolean
  setUpdateExisting: Dispatch<SetStateAction<boolean>>
  importing: boolean
  importError: string
  importResult: ImportResult | null
  onClose: () => void
  onImport: () => void
}

export default function ProductImportModal({
  isOpen,
  importFile,
  setImportFile,
  updateExisting,
  setUpdateExisting,
  importing,
  importError,
  importResult,
  onClose,
  onImport,
}: ProductImportModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Import Products CSV</h2>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Update existing products when SKU matches
          </label>
          {importError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {importError}
            </p>
          )}
          {importResult && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <p>
                Imported <span className="font-semibold">{importResult.imported}</span>, skipped{' '}
                <span className="font-semibold">{importResult.skipped}</span>.
              </p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500">
                  {importResult.errors.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onImport}
            disabled={importing || !importFile}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
