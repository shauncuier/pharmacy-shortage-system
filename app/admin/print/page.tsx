'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getLocalDateString } from '@/lib/date-utils'
import {
  Printer,
  Download,
  ArrowLeft,
  Filter,
  X,
  Search,
  Building2,
  Tag,
  CheckCircle2,
  ListFilter,
  RotateCcw,
} from 'lucide-react'
import { CopyShortlistButton } from '@/components/CopyShortlistButton'
import { ToastContainer, ToastMessage } from '@/components/Toast'
import { useDynamicShortages } from '@/lib/use-dynamic-shortages'

interface PrintShortageItem {
  medicineId: string
  medicine: {
    brandName: string
    strength: string
    dosageForm: string
    genericName: string
    manufacturer?: {
      name: string
      shortName?: string | null
    }
  }
  reportCount: number
  totalQuantity: number
  units: string[]
  employees: Array<{ name: string; count: number }>
  reports: Array<{ notes: string | null; quantity: number | null; unit: string | null }>
}

function PrintShortageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const dateFromQuery = searchParams.get('date') || getLocalDateString()
  const brandFromQuery = searchParams.get('brand') || 'ALL'
  const mfgFromQuery = searchParams.get('manufacturer') || 'ALL'

  const [selectedDate, setSelectedDate] = useState(dateFromQuery)
  const [selectedBrand, setSelectedBrand] = useState(brandFromQuery)
  const [selectedManufacturer, setSelectedManufacturer] = useState(mfgFromQuery)
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<PrintShortageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pharmacyName, setPharmacyName] = useState('Bara-Awlia Medical Hall')
  const [generatedTime, setGeneratedTime] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, text }])
  }

  useEffect(() => {
    setGeneratedTime(new Date().toLocaleTimeString())
  }, [])

  // Load shortage data for the selected date
  const loadData = async (date: string, silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch(`/api/shortages?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.consolidated || [])
      }
    } catch (err) {
      if (!silent) console.error('Failed to load print shortages:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedDate)
  }, [selectedDate])

  // Instant dynamic multi-user data load
  useDynamicShortages({
    onUpdate: () => loadData(selectedDate, true),
    pollIntervalMs: 3000,
  })

  // Sync initial query params if they change
  useEffect(() => {
    if (searchParams.get('brand')) {
      setSelectedBrand(searchParams.get('brand') || 'ALL')
    }
    if (searchParams.get('manufacturer')) {
      setSelectedManufacturer(searchParams.get('manufacturer') || 'ALL')
    }
  }, [searchParams])

  // Extract all unique brand names from today's shortage items
  const uniqueBrands = useMemo(() => {
    const brandMap = new Map<string, number>()
    for (const item of items) {
      const b = item.medicine.brandName?.trim()
      if (b) {
        brandMap.set(b, (brandMap.get(b) || 0) + 1)
      }
    }
    return Array.from(brandMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  // Extract all unique manufacturers from today's shortage items
  const uniqueManufacturers = useMemo(() => {
    const mfgMap = new Map<string, number>()
    for (const item of items) {
      const m =
        item.medicine.manufacturer?.shortName?.trim() ||
        item.medicine.manufacturer?.name?.trim() ||
        'Unknown'
      mfgMap.set(m, (mfgMap.get(m) || 0) + 1)
    }
    return Array.from(mfgMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items])

  // Filter items according to brand, manufacturer, and search query
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Filter by Brand
      if (selectedBrand && selectedBrand !== 'ALL') {
        if (item.medicine.brandName.toLowerCase() !== selectedBrand.toLowerCase()) {
          return false
        }
      }

      // 2. Filter by Manufacturer / Company
      if (selectedManufacturer && selectedManufacturer !== 'ALL') {
        const mfg = (
          item.medicine.manufacturer?.shortName ||
          item.medicine.manufacturer?.name ||
          ''
        ).toLowerCase()
        if (mfg !== selectedManufacturer.toLowerCase()) {
          return false
        }
      }

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const b = item.medicine.brandName.toLowerCase()
        const g = item.medicine.genericName.toLowerCase()
        const s = item.medicine.strength.toLowerCase()
        const m = (item.medicine.manufacturer?.name || '').toLowerCase()
        if (!b.includes(q) && !g.includes(q) && !s.includes(q) && !m.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [items, selectedBrand, selectedManufacturer, searchQuery])

  const totalReports = filteredItems.reduce((acc, curr) => acc + curr.reportCount, 0)
  const isFiltered =
    selectedBrand !== 'ALL' || selectedManufacturer !== 'ALL' || searchQuery.trim().length > 0

  // Action: Reset all filters to show and print all
  const handleResetFilters = () => {
    setSelectedBrand('ALL')
    setSelectedManufacturer('ALL')
    setSearchQuery('')
  }

  // Action: Print currently filtered list
  const handlePrintFiltered = () => {
    window.print()
  }

  // Action: Print ALL medicines (clears filter first, then prints)
  const handlePrintAll = () => {
    if (isFiltered) {
      setSelectedBrand('ALL')
      setSelectedManufacturer('ALL')
      setSearchQuery('')
      // Allow state to re-render full list before opening print dialog
      setTimeout(() => {
        window.print()
      }, 100)
    } else {
      window.print()
    }
  }

  // Action: Export CSV
  const handleExportCSV = () => {
    const listToExport = filteredItems
    const headers = [
      'No',
      'Brand Name',
      'Strength',
      'Dosage Form',
      'Generic Name',
      'Manufacturer',
      'Reports Count',
      'Requested Quantity',
      'Unit',
      'Notes',
    ]

    const rows = listToExport.map((item, idx) => {
      const allNotes = item.reports
        .map((r) => r.notes)
        .filter(Boolean)
        .join('; ')

      return [
        idx + 1,
        `"${item.medicine.brandName}"`,
        `"${item.medicine.strength}"`,
        `"${item.medicine.dosageForm}"`,
        `"${item.medicine.genericName}"`,
        `"${item.medicine.manufacturer?.name || ''}"`,
        item.reportCount,
        item.totalQuantity || '',
        `"${item.units.join('/') || 'Box'}"`,
        `"${allNotes.replace(/"/g, '""')}"`,
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileBrandSuffix = selectedBrand !== 'ALL' ? `-${selectedBrand.replace(/\s+/g, '_')}` : ''
    link.setAttribute('download', `pharmacy-shortlist${fileBrandSuffix}-${selectedDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6">
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />

      {/* Top Action & Filter Controls (Hidden when printing) */}
      <div className="no-print bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200 space-y-4">
        {/* Row 1: Primary Controls & Print Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Date:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Pharmacy:</span>
              <input
                type="text"
                value={pharmacyName}
                onChange={(e) => setPharmacyName(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 w-52 sm:w-60 focus:border-sky-600 focus:bg-white focus:outline-hidden"
                placeholder="Pharmacy name"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CopyShortlistButton
              items={filteredItems}
              options={{
                pharmacyName,
                date: selectedDate,
                filterBrand: selectedBrand,
                filterManufacturer: selectedManufacturer,
              }}
              onToast={addToast}
              buttonText={isFiltered ? `Copy Filtered (${filteredItems.length})` : `Copy Shortlist (${items.length})`}
            />

            <button
              onClick={handleExportCSV}
              disabled={filteredItems.length === 0}
              className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
              title="Download CSV for current view"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            {/* Print All Button (Always prints entire shortage list) */}
            <button
              onClick={handlePrintAll}
              disabled={items.length === 0}
              className="h-10 px-4 bg-slate-900 hover:bg-black disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
              title="Print all shortages for this date without any filter"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Print All ({items.length})</span>
            </button>

            {/* Print Filtered Button */}
            {isFiltered && (
              <button
                onClick={handlePrintFiltered}
                disabled={filteredItems.length === 0}
                className="h-10 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer animate-pulse"
                title="Print only the filtered medicines"
              >
                <Printer className="w-4 h-4" />
                <span>
                  Print Filtered ({filteredItems.length})
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Filtering Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Brand Filter Dropdown */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-sky-600" />
              <span>Filter by Brand Name</span>
            </label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className={`w-full h-10 px-3 text-xs font-bold rounded-xl border transition-colors ${
                selectedBrand !== 'ALL'
                  ? 'bg-sky-50 border-sky-500 text-sky-900'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <option value="ALL">All Brands ({items.length} total medicines)</option>
              {uniqueBrands.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({b.count} item{b.count > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Company / Manufacturer Filter Dropdown */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-emerald-600" />
              <span>Filter by Company / Manufacturer</span>
            </label>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              className={`w-full h-10 px-3 text-xs font-bold rounded-xl border transition-colors ${
                selectedManufacturer !== 'ALL'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : 'bg-slate-50 border-slate-300 text-slate-800'
              }`}
            >
              <option value="ALL">All Companies ({uniqueManufacturers.length})</option>
              {uniqueManufacturers.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count} item{m.count > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Search Box & Reset Button */}
          <div className="sm:col-span-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Search className="w-3 h-3 text-slate-500" />
                <span>Search Filter</span>
              </span>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="text-rose-600 hover:text-rose-700 text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Reset All</span>
                </button>
              )}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search brand, generic..."
                className="w-full h-10 pl-3 pr-8 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl focus:border-sky-600 focus:bg-white focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 3: Quick Brand Filter Pills (1-Tap Selection) */}
        {uniqueBrands.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Quick Brand Filter:
            </span>
            <button
              onClick={() => setSelectedBrand('ALL')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                selectedBrand === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              All ({items.length})
            </button>
            {uniqueBrands.slice(0, 10).map((b) => {
              const isSelected = selectedBrand.toLowerCase() === b.name.toLowerCase()
              return (
                <button
                  key={b.name}
                  onClick={() => setSelectedBrand(isSelected ? 'ALL' : b.name)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                      : 'bg-white hover:bg-sky-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <span>{b.name}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full ${
                      isSelected ? 'bg-sky-700 text-sky-100' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {b.count}
                  </span>
                </button>
              )
            })}
            {uniqueBrands.length > 10 && (
              <span className="text-[11px] text-slate-400 ml-1">
                +{uniqueBrands.length - 10} more in dropdown above
              </span>
            )}
          </div>
        )}

        {/* Active Filter Summary Bar */}
        {isFiltered && (
          <div className="bg-sky-50/80 border border-sky-200 rounded-xl p-2.5 px-3 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span>
                Active filter showing <strong>{filteredItems.length}</strong> of{' '}
                <strong>{items.length}</strong> medicines
                {selectedBrand !== 'ALL' && (
                  <>
                    {' '}• Brand: <strong>"{selectedBrand}"</strong>
                  </>
                )}
                {selectedManufacturer !== 'ALL' && (
                  <>
                    {' '}• Company: <strong>"{selectedManufacturer}"</strong>
                  </>
                )}
                {searchQuery.trim() && (
                  <>
                    {' '}• Search: <strong>"{searchQuery}"</strong>
                  </>
                )}
              </span>
            </div>
            <button
              onClick={handleResetFilters}
              className="text-xs font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1 cursor-pointer"
            >
              <span>Clear and show all</span>
            </button>
          </div>
        )}
      </div>

      {/* A4 Printable Paper Layout */}
      <div className="bg-white p-8 sm:p-12 max-w-4xl mx-auto border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none text-slate-900">
        {/* Document Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex justify-center mb-2">
            <img
              src="/logo.png"
              alt="Bara-Awlia Medical Hall Logo"
              className="h-16 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-slate-900">
            {pharmacyName}
          </h1>
          <h2 className="text-lg font-bold tracking-widest text-slate-800 uppercase mt-1">
            DAILY MEDICINE SHORTAGE LIST
          </h2>

          {/* Subheader when filtered by Brand or Company */}
          {selectedBrand !== 'ALL' && (
            <div className="mt-1 text-sm font-black tracking-wide text-sky-900 uppercase">
              Brand Filter: {selectedBrand}
            </div>
          )}
          {selectedManufacturer !== 'ALL' && (
            <div className="mt-1 text-sm font-black tracking-wide text-emerald-900 uppercase">
              Company / Manufacturer: {selectedManufacturer}
            </div>
          )}

          <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mt-3 text-slate-600 px-2">
            <div>
              Date: <strong className="text-slate-900" suppressHydrationWarning>{formattedDate}</strong>
            </div>
            {isFiltered && (
              <div className="text-slate-700 italic">
                (Filtered: {filteredItems.length} of {items.length} items)
              </div>
            )}
            <div>
              Generated:{' '}
              <strong className="text-slate-900" suppressHydrationWarning>
                {generatedTime}
              </strong>
            </div>
          </div>
        </div>

        {/* Shortage Table */}
        {loading ? (
          <div className="py-12 text-center text-slate-400">Loading shortage data...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-medium">
            No shortages recorded for {formattedDate}.
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-medium space-y-2">
            <p>No medicines match your current filter.</p>
            <button
              onClick={handleResetFilters}
              className="no-print text-xs font-bold text-sky-600 hover:underline cursor-pointer"
            >
              Reset filters to show all {items.length} items
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-y-2 border-slate-900 bg-slate-100 font-bold uppercase text-slate-900">
                  <th className="p-2 text-center w-10 border border-slate-300">No.</th>
                  <th className="p-2 text-left border border-slate-300">Medicine & Strength</th>
                  <th className="p-2 text-left border border-slate-300">Dosage Form</th>
                  <th className="p-2 text-left border border-slate-300">Manufacturer</th>
                  <th className="p-2 text-center w-16 border border-slate-300">Reports</th>
                  <th className="p-2 text-center w-24 border border-slate-300">Req. Qty</th>
                  <th className="p-2 text-left border border-slate-300">Notes / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {filteredItems.map((item, idx) => {
                  const notesList = item.reports
                    .map((r) => r.notes)
                    .filter(Boolean)
                    .join(', ')

                  return (
                    <tr key={item.medicineId} className="border-b border-slate-300">
                      <td className="p-2 text-center font-bold text-slate-600 border border-slate-300">
                        {idx + 1}
                      </td>
                      <td className="p-2 font-bold border border-slate-300">
                        {item.medicine.brandName} {item.medicine.strength}
                        <div className="text-[11px] font-normal text-slate-600 print:text-black">
                          {item.medicine.genericName}
                        </div>
                      </td>
                      <td className="p-2 uppercase text-xs border border-slate-300">
                        {item.medicine.dosageForm}
                      </td>
                      <td className="p-2 font-medium border border-slate-300">
                        {item.medicine.manufacturer?.shortName || item.medicine.manufacturer?.name}
                      </td>
                      <td className="p-2 text-center font-black text-slate-900 border border-slate-300">
                        {item.reportCount}
                      </td>
                      <td className="p-2 text-center font-bold border border-slate-300">
                        {item.totalQuantity > 0
                          ? `${item.totalQuantity} ${item.units.join('/') || 'Box'}`
                          : '—'}
                      </td>
                      <td className="p-2 text-xs text-slate-700 italic border border-slate-300">
                        {notesList || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals & Statistics */}
        <div className="mt-6 pt-4 border-t-2 border-slate-900 flex items-center justify-between text-xs sm:text-sm font-bold">
          <div>
            Total Unique Medicines:{' '}
            <span className="text-base text-slate-900">{filteredItems.length}</span>
            {isFiltered && (
              <span className="text-slate-500 font-normal ml-1">
                (filtered from {items.length} total)
              </span>
            )}
          </div>
          <div>
            Total Staff Reports:{' '}
            <span className="text-base text-slate-900">{totalReports}</span>
          </div>
        </div>

        {/* Signature & Verification Block */}
        <div className="mt-14 pt-8 grid grid-cols-2 gap-8 text-xs sm:text-sm">
          <div>
            <div className="border-b border-slate-900 w-48 mb-1.5" />
            <div className="font-bold">Prepared By (Pharmacist)</div>
            <div className="text-slate-500 text-[11px]">Name & Signature</div>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="border-b border-slate-900 w-48 mb-1.5" />
            <div className="font-bold">Approved / Ordered By</div>
            <div className="text-slate-500 text-[11px]">Pharmacy In-Charge</div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500 print:text-black">
          Bara-Awlia Medical Hall • Designed &amp; Developed by{' '}
          <a
            href="https://3s-soft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline font-semibold"
          >
            3s-Soft
          </a>
        </div>
      </div>
    </div>
  )
}

export default function AdminPrintPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading print layout...</div>}>
      <PrintShortageContent />
    </Suspense>
  )
}
