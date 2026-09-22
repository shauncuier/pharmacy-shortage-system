'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Pill,
  Users,
  Clock,
  Printer,
  Download,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  AlertCircle,
  Trash2,
  Building2,
  Search,
  X,
  RotateCcw,
  Filter,
} from 'lucide-react'
import { ToastContainer, ToastMessage } from '@/components/Toast'
import { CopyShortlistButton } from '@/components/CopyShortlistButton'
import { getLocalDateString } from '@/lib/date-utils'
import { useDynamicShortages } from '@/lib/use-dynamic-shortages'

interface ConsolidatedItem {
  medicineId: string
  medicine: {
    id: string
    brandName: string
    genericName: string
    strength: string
    dosageForm: string
    purchaseUnit?: string | null
    retailUnit?: string | null
    manufacturer?: {
      id: string
      name: string
      shortName?: string | null
    }
  }
  reportCount: number
  totalQuantity: number
  units: string[]
  employees: Array<{
    id: string
    employeeId: string
    name: string
    count: number
  }>
  reports: Array<{
    id: string
    employeeId: string
    employeeName: string
    quantity: number | null
    unit: string | null
    notes: string | null
    status: string
    reportedAt: string
  }>
  hasPending: boolean
}

interface DashboardStats {
  totalReports: number
  uniqueMedicines: number
  employeesReporting: number
  pendingReview: number
}

interface EmployeeSummary {
  id: string
  employeeId: string
  name: string
  reportsToday: number
  totalReports: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalReports: 0,
    uniqueMedicines: 0,
    employeesReporting: 0,
    pendingReview: 0,
  })
  const [consolidated, setConsolidated] = useState<ConsolidatedItem[]>([])
  const [employees, setEmployees] = useState<EmployeeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMedId, setExpandedMedId] = useState<string | null>(null)
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, text }])
  }

  const loadDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      // On silent/background sync, only refresh shortages (fastest!)
      // Only fetch employees on initial mount or manual refresh
      const promises: [Promise<Response>, Promise<Response>?] = [fetch('/api/shortages')]
      if (!silent || employees.length === 0) {
        promises.push(fetch('/api/admin/employees'))
      }

      const [shortagesRes, empRes] = await Promise.all(promises)

      if (shortagesRes.ok) {
        const data = await shortagesRes.json()
        setStats(data.stats || { totalReports: 0, uniqueMedicines: 0, employeesReporting: 0, pendingReview: 0 })
        setConsolidated(data.consolidated || [])
      }

      if (empRes && empRes.ok) {
        const empData = await empRes.json()
        setEmployees(empData.employees || [])
      }
    } catch (err) {
      if (!silent) {
        console.error('Error fetching dashboard data:', err)
        addToast('error', 'Failed to load dashboard data')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadDashboardData()
  }, [])

  // Instant multi-user sync: SSE stream (0ms) + BroadcastChannel + auto-poll (every 3s)
  const { isLiveConnected } = useDynamicShortages({
    onUpdate: (silent) => loadDashboardData(silent),
    pollIntervalMs: 3000,
  })

  // Mark all pending as reviewed
  const handleMarkAllReviewed = async () => {
    if (!confirm("Mark all today's pending shortage reports as Reviewed?")) return

    try {
      const res = await fetch('/api/shortages/bulk-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REVIEWED' }),
      })

      if (res.ok) {
        addToast('success', "All today's shortages marked as Reviewed")
        loadDashboardData()
      } else {
        addToast('error', 'Failed to update shortages')
      }
    } catch (err) {
      console.error('Review error:', err)
      addToast('error', 'Network error updating shortages')
    }
  }

  // Delete single staff report from drilldown
  const handleDeleteReport = async (reportId: string, brandName: string, employeeName: string) => {
    if (!confirm(`Are you sure you want to delete ${employeeName}'s report for "${brandName}"?`)) return

    try {
      const res = await fetch(`/api/shortages/${reportId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('success', `Deleted ${employeeName}'s report for ${brandName}`)
        loadDashboardData()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to delete report')
      }
    } catch (err) {
      console.error('Delete error:', err)
      addToast('error', 'Network error deleting report')
    }
  }

  // Delete all reports for a consolidated medicine
  const handleDeleteAllForMedicine = async (medicineName: string, shortageIds: string[]) => {
    if (shortageIds.length === 0) return
    if (!confirm(`Are you sure you want to delete all ${shortageIds.length} report(s) for "${medicineName}"? This action cannot be undone.`)) return

    try {
      const res = await fetch('/api/shortages/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortageIds }),
      })

      const data = await res.json()
      if (res.ok) {
        addToast('success', `Deleted all ${data.deletedCount} reports for ${medicineName}`)
        loadDashboardData()
      } else {
        addToast('error', data.error || 'Failed to delete reports')
      }
    } catch (err) {
      console.error('Bulk delete error:', err)
      addToast('error', 'Network error deleting reports')
    }
  }

  // Extract all unique companies / manufacturers with item counts
  const uniqueCompanies = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of consolidated) {
      const mfg =
        item.medicine.manufacturer?.shortName?.trim() ||
        item.medicine.manufacturer?.name?.trim() ||
        'Other'
      map.set(mfg, (map.get(mfg) || 0) + 1)
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [consolidated])

  // Filter list by selected employee, company, and search query
  const filteredConsolidated = useMemo(() => {
    return consolidated.filter((item) => {
      // 1. Employee filter
      if (selectedEmployeeFilter) {
        if (!item.employees.some((e) => e.employeeId === selectedEmployeeFilter)) {
          return false
        }
      }

      // 2. Company / Manufacturer filter
      if (selectedCompany !== 'ALL') {
        const mfg = (
          item.medicine.manufacturer?.shortName ||
          item.medicine.manufacturer?.name ||
          'Other'
        ).toLowerCase()
        if (mfg !== selectedCompany.toLowerCase()) {
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
  }, [consolidated, selectedEmployeeFilter, selectedCompany, searchQuery])

  // Export CSV
  const handleExportCSV = () => {
    if (filteredConsolidated.length === 0) {
      addToast('info', 'No shortages to export')
      return
    }

    const todayStr = getLocalDateString()
    const headers = ['No', 'Brand Name', 'Strength', 'Dosage Form', 'Generic Name', 'Manufacturer', 'Reports Count', 'Requested Quantity', 'Unit', 'Reported By Employees']
    
    const rows = filteredConsolidated.map((item, index) => [
      index + 1,
      `"${item.medicine.brandName}"`,
      `"${item.medicine.strength}"`,
      `"${item.medicine.dosageForm}"`,
      `"${item.medicine.genericName}"`,
      `"${item.medicine.manufacturer?.name || ''}"`,
      item.reportCount,
      item.totalQuantity || '',
      `"${item.units.join(', ') || ''}"`,
      `"${item.employees.map((e) => `${e.name} (${e.count})`).join('; ')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const fileSuffix = selectedCompany !== 'ALL' ? `-${selectedCompany.replace(/\s+/g, '_')}` : ''
    link.setAttribute('download', `pharmacy-shortages${fileSuffix}-${todayStr}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('success', 'Shortage CSV exported')
  }

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 lg:pb-0">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Top Title & Header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">TODAY'S SHORTAGES</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                isLiveConnected
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title={isLiveConnected ? 'Realtime stream connected (instant dynamic updates)' : 'Dynamic auto-polling active (every 3s)'}
            >
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-400'}`} />
              <span>{isLiveConnected ? 'Live Dynamic Sync' : 'Live Syncing'}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5" suppressHydrationWarning>{todayFormatted}</p>
        </div>

        {/* Global Dashboard Actions - Mobile (sm:hidden) */}
        <div className="sm:hidden flex flex-col gap-2">
          {/* Row 1: Refresh (square 40x40) + Review All (h-10) + Copy (h-10) */}
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => loadDashboardData(false)}
              disabled={loading}
              className="w-10 h-10 shrink-0 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleMarkAllReviewed}
              disabled={stats.pendingReview === 0}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4 shrink-0" />
              <span className="truncate">Review All</span>
            </button>

            <div className="flex-1 h-10 min-w-0">
              <CopyShortlistButton
                items={filteredConsolidated}
                className="w-full h-10"
                options={{
                  date: getLocalDateString(),
                  filterManufacturer: selectedCompany !== 'ALL' ? selectedCompany : undefined,
                }}
                buttonText={`Copy (${filteredConsolidated.length})`}
                onToast={addToast}
              />
            </div>
          </div>

          {/* Row 2: Print A4 (h-10) + Export CSV (h-10) */}
          <div className="grid grid-cols-2 gap-2 w-full">
            <Link
              href={selectedCompany !== 'ALL' ? `/admin/print?manufacturer=${encodeURIComponent(selectedCompany)}` : '/admin/print'}
              className="h-10 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print A4</span>
            </Link>

            <button
              onClick={handleExportCSV}
              className="h-10 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Global Dashboard Actions - Desktop (hidden sm:flex) */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadDashboardData(false)}
            disabled={loading}
            className="w-10 h-10 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-700 shadow-xs flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleMarkAllReviewed}
            disabled={stats.pendingReview === 0}
            className="h-10 px-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark Reviewed</span>
          </button>

          <div className="h-10">
            <CopyShortlistButton
              items={filteredConsolidated}
              className="h-10"
              options={{
                date: getLocalDateString(),
                filterManufacturer: selectedCompany !== 'ALL' ? selectedCompany : undefined,
              }}
              buttonText={
                selectedCompany !== 'ALL'
                  ? `Copy ${selectedCompany} (${filteredConsolidated.length})`
                  : `Copy Shortlist (${filteredConsolidated.length})`
              }
              onToast={addToast}
            />
          </div>

          <Link
            href={selectedCompany !== 'ALL' ? `/admin/print?manufacturer=${encodeURIComponent(selectedCompany)}` : '/admin/print'}
            className="h-10 px-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </Link>

          <button
            onClick={handleExportCSV}
            className="h-10 px-3.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Prominent Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Total Reports */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200 flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{stats.totalReports}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide truncate">
              Total Reports
            </div>
          </div>
        </div>

        {/* Card 2: Unique Medicines */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200 flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{stats.uniqueMedicines}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide truncate">
              Unique Meds
            </div>
          </div>
        </div>

        {/* Card 3: Employees Reporting */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200 flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{stats.employeesReporting}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide truncate">
              Staff Active
            </div>
          </div>
        </div>

        {/* Card 4: Pending Review */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 shadow-xs border border-slate-200 flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{stats.pendingReview}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wide truncate">
              Pending
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Consolidated List (Left/Main) + Employee Activity (Right/Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Consolidated Shortages Table (2 Cols on lg) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <span>Consolidated Shortage List</span>
                  {selectedEmployeeFilter && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold flex items-center gap-1">
                      Staff: {selectedEmployeeFilter}
                      <button
                        onClick={() => setSelectedEmployeeFilter(null)}
                        className="hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        title="Clear staff filter"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {selectedCompany !== 'ALL' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1 border border-emerald-300">
                      Company: {selectedCompany}
                      <button
                        onClick={() => setSelectedCompany('ALL')}
                        className="hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        title="Clear company filter"
                      >
                        ×
                      </button>
                    </span>
                  )}
                  {searchQuery.trim() && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold flex items-center gap-1 border border-amber-300">
                      Search: "{searchQuery.trim()}"
                      <button
                        onClick={() => setSearchQuery('')}
                        className="hover:text-rose-600 font-bold ml-1 cursor-pointer"
                        title="Clear search"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Filter by company to copy &amp; send shortlists directly to medical reps or distributors.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <CopyShortlistButton
                  items={filteredConsolidated}
                  variant="compact"
                  className="h-8"
                  options={{
                    date: getLocalDateString(),
                    filterManufacturer: selectedCompany !== 'ALL' ? selectedCompany : undefined,
                  }}
                  buttonText={
                    selectedCompany !== 'ALL'
                      ? `Copy ${selectedCompany} (${filteredConsolidated.length})`
                      : `Copy List (${filteredConsolidated.length})`
                  }
                  onToast={addToast}
                />
                <span className="h-8 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 rounded-xl border border-slate-200 inline-flex items-center">
                  {filteredConsolidated.length} items
                </span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Company / Manufacturer Dropdown */}
              <div className="flex-1 w-full relative flex items-center">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 absolute left-3 pointer-events-none" />
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className={`w-full h-10 pl-9 pr-8 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                    selectedCompany !== 'ALL'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                      : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
                  }`}
                >
                  <option value="ALL">All Companies ({consolidated.length} medicines)</option>
                  {uniqueCompanies.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.count} item{c.count > 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              </div>

              {/* Medicine Search Filter */}
              <div className="flex-1 w-full relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter brand or generic..."
                  className="w-full h-10 pl-9 pr-8 text-xs font-semibold bg-white border border-slate-300 rounded-xl focus:border-sky-600 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reset Filters button */}
              {(selectedCompany !== 'ALL' || searchQuery.trim() || selectedEmployeeFilter) && (
                <button
                  onClick={() => {
                    setSelectedCompany('ALL')
                    setSearchQuery('')
                    setSelectedEmployeeFilter(null)
                  }}
                  className="w-full sm:w-auto h-10 px-3.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>

            {/* Quick 1-Tap Company Filter Pills - Horizontally Scrollable on Mobile */}
            {uniqueCompanies.length > 0 && (
              <div className="px-3 sm:px-4 py-2 bg-slate-50/50 border-b border-slate-200 overflow-x-auto no-scrollbar scroll-smooth">
                <div className="flex items-center gap-1.5 min-w-max pr-6">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1 shrink-0">
                    <Building2 className="w-3 h-3 text-emerald-600" />
                    Company:
                  </span>
                  <button
                    onClick={() => setSelectedCompany('ALL')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0 ${
                      selectedCompany === 'ALL'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 border border-slate-200 text-slate-700'
                    }`}
                  >
                    All ({consolidated.length})
                  </button>
                  {uniqueCompanies.slice(0, 15).map((c) => {
                    const isSelected = selectedCompany.toLowerCase() === c.name.toLowerCase()
                    return (
                      <button
                        key={c.name}
                        onClick={() => setSelectedCompany(isSelected ? 'ALL' : c.name)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                            : 'bg-white hover:bg-emerald-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <span>{c.name}</span>
                        <span
                          className={`text-[10px] px-1 rounded-full ${
                            isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {c.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading today's shortage data...</div>
            ) : filteredConsolidated.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <CheckCheck className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm font-bold text-slate-700">No shortages reported today</p>
                <p className="text-xs text-slate-400 mt-1">
                  Employees have not submitted any shortage reports for today yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredConsolidated.map((item, idx) => {
                  const isExpanded = expandedMedId === item.medicineId

                  return (
                    <div key={item.medicineId} className="hover:bg-slate-50/80 transition-colors">
                      {/* --- MOBILE & TABLET CARD VIEW (md:hidden) --- */}
                      <div
                        onClick={() => setExpandedMedId(isExpanded ? null : item.medicineId)}
                        className="p-3.5 md:hidden space-y-2.5 cursor-pointer"
                      >
                        {/* Top: Index, Brand, Strength, Dosage, New badge, Reports count, Chevron */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <span className="text-xs font-bold text-slate-400 mt-0.5 shrink-0">
                              {idx + 1}.
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-black text-base text-slate-900 leading-tight">
                                  {item.medicine.brandName}
                                </span>
                                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                                  {item.medicine.strength}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                                  {item.medicine.dosageForm}
                                </span>
                                {item.hasPending && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                    New
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {item.medicine.genericName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                              {item.reportCount} {item.reportCount === 1 ? 'report' : 'reports'}
                            </span>
                            <div className="p-1 text-slate-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Manufacturer */}
                        <div className="text-xs font-semibold text-slate-600 flex items-center gap-1 pl-4">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{item.medicine.manufacturer?.name || 'Unknown'}</span>
                        </div>

                        {/* Bottom Row: Staff Chips + Total Qty + Action Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 pl-4">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">By:</span>
                            {item.employees.map((emp) => (
                              <span
                                key={emp.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200 truncate max-w-[150px]"
                              >
                                {emp.name} {emp.count > 1 ? `(${emp.count}x)` : ''}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.totalQuantity > 0 && (
                              <span className="h-8 text-xs font-bold text-slate-800 bg-slate-100 px-2.5 rounded-lg border border-slate-200 flex items-center">
                                Qty: {item.totalQuantity} {item.units[0] || 'Box'}
                              </span>
                            )}

                            <Link
                              href={`/admin/print?brand=${encodeURIComponent(item.medicine.brandName)}`}
                              onClick={(e) => e.stopPropagation()}
                              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              title={`Print shortages for ${item.medicine.brandName}`}
                            >
                              <Printer className="w-4 h-4" />
                            </Link>

                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteAllForMedicine(
                                  item.medicine.brandName,
                                  item.reports.map((r) => r.id)
                                )
                              }}
                              className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title={`Delete all ${item.reports.length} report(s) for ${item.medicine.brandName}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* --- DESKTOP ROW VIEW (hidden md:flex) --- */}
                      <div
                        onClick={() => setExpandedMedId(isExpanded ? null : item.medicineId)}
                        className="hidden md:flex p-4 items-center justify-between gap-4 cursor-pointer"
                      >
                        {/* Medicine Information */}
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-400 w-5 text-right">
                            {idx + 1}.
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-black text-base text-slate-900 leading-tight">
                                {item.medicine.brandName}
                              </span>
                              <span className="text-sm font-bold text-sky-700">
                                {item.medicine.strength}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                                {item.medicine.dosageForm}
                              </span>
                              {item.hasPending && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                                  New
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-500 mt-0.5">
                              {item.medicine.genericName}
                            </div>

                            <div className="text-xs font-semibold text-slate-700 mt-1">
                              Mfg: {item.medicine.manufacturer?.name || 'Unknown'}
                            </div>

                            {/* Badges for Reporting Employees */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="text-[11px] text-slate-400 font-medium">Reported by:</span>
                              {item.employees.map((emp) => (
                                <span
                                  key={emp.id}
                                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium border border-slate-200"
                                >
                                  {emp.name} {emp.count > 1 ? `(${emp.count}x)` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right side counts & toggle */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                              <span>{item.reportCount}</span>
                              <span className="text-[10px] font-semibold uppercase">
                                {item.reportCount === 1 ? 'report' : 'reports'}
                              </span>
                            </div>

                            {item.totalQuantity > 0 && (
                              <div className="text-xs font-bold text-slate-700 mt-1">
                                Qty: {item.totalQuantity} {item.units.join('/') || 'Box'}
                              </div>
                            )}
                          </div>

                          <Link
                            href={`/admin/print?brand=${encodeURIComponent(item.medicine.brandName)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title={`Print shortages for ${item.medicine.brandName}`}
                          >
                            <Printer className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteAllForMedicine(
                                item.medicine.brandName,
                                item.reports.map((r) => r.id)
                              )
                            }}
                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete all ${item.reports.length} report(s) for ${item.medicine.brandName}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Drill Down: Individual Submissions */}
                      {isExpanded && (
                        <div className="px-3 sm:px-5 py-3 bg-slate-100/70 border-t border-slate-200 space-y-2 text-xs">
                          <div className="font-bold text-slate-700 uppercase tracking-wide text-[11px] mb-1">
                            Staff Submissions ({item.reports.length})
                          </div>
                          {item.reports.map((sub) => (
                            <div
                              key={sub.id}
                              className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="font-bold text-slate-800">{sub.employeeName}</span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-700 font-semibold">
                                  {sub.quantity ? (
                                    <span>
                                      {sub.quantity} {sub.unit || 'Box'}
                                    </span>
                                  ) : (
                                    <span className="text-amber-700 font-normal">No qty specified</span>
                                  )}
                                </span>
                                {sub.notes && (
                                  <>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-500 italic truncate max-w-xs">
                                      "{sub.notes}"
                                    </span>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-1.5 sm:pt-0 border-slate-100">
                                <span className="text-[11px] text-slate-400">
                                  {new Date(sub.reportedAt).toLocaleTimeString('en-US', {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    sub.status === 'REPORTED'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {sub.status}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteReport(
                                      sub.id,
                                      item.medicine.brandName,
                                      sub.employeeName
                                    )
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete this submission"
                                  aria-label="Delete submission"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Employee Activity */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600" />
                <span>Employee Activity</span>
              </h2>
              <p className="text-xs text-slate-500">Reports submitted today by staff</p>
            </div>

            <div className="divide-y divide-slate-100">
              {employees.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No employees registered</div>
              ) : (
                employees.map((emp) => {
                  const isSelected = selectedEmployeeFilter === emp.employeeId

                  return (
                    <button
                      key={emp.id}
                      onClick={() =>
                        setSelectedEmployeeFilter(isSelected ? null : emp.employeeId)
                      }
                      className={`w-full text-left p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-400">{emp.employeeId}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            emp.reportsToday > 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {emp.reportsToday} today
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <Link
                href="/admin/employees"
                className="text-xs font-bold text-sky-600 hover:text-sky-800"
              >
                Manage Staff & PINs →
              </Link>
            </div>
          </div>

          {/* Quick System Links Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xs space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Offline Ready Architecture</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This system runs 100% on the local pharmacy router. No internet required. Database is safely
              stored on this server.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/admin/settings"
                className="w-full py-2 px-3 text-center bg-sky-600 hover:bg-sky-500 rounded-xl text-xs font-bold text-white transition-colors"
              >
                View Local IP & Backup Database
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Floating Bar for Admin (md:hidden) */}
      {filteredConsolidated.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 px-4 py-2.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.1)] z-40 md:hidden flex items-center justify-between gap-3 safe-area-inset-bottom">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-slate-900 truncate">
              {selectedCompany !== 'ALL' ? `${selectedCompany} Shortlist` : 'Today Shortages'} ({filteredConsolidated.length})
            </div>
            <p className="text-[10px] text-slate-500 truncate">
              {filteredConsolidated.slice(0, 2).map((r) => r.medicine.brandName).join(', ')}
              {filteredConsolidated.length > 2 ? ` +${filteredConsolidated.length - 2} more` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <CopyShortlistButton
              items={filteredConsolidated}
              variant="compact"
              dropdownDirection="up"
              className="h-9"
              options={{
                date: getLocalDateString(),
                filterManufacturer: selectedCompany !== 'ALL' ? selectedCompany : undefined,
              }}
              buttonText="Copy"
              onToast={addToast}
            />

            <Link
              href={
                selectedCompany !== 'ALL'
                  ? `/admin/print?manufacturer=${encodeURIComponent(selectedCompany)}`
                  : '/admin/print'
              }
              className="w-9 h-9 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center shrink-0"
              title="Print A4"
            >
              <Printer className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
