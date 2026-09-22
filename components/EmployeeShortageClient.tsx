'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search,
  X,
  Pill,
  Clock,
  Trash2,
  CheckCircle2,
  ChevronRight,
  Zap,
  RefreshCw,
  Sparkles,
  Pencil,
  Plus,
} from 'lucide-react'
import { Navbar } from '@/components/Navbar'
import { ToastContainer, ToastMessage } from '@/components/Toast'
import { PwaInstallBanner } from '@/components/PwaInstallBanner'
import { ShortageAddModal, SelectedMedicine } from '@/components/ShortageAddModal'
import { CopyShortlistButton } from '@/components/CopyShortlistButton'
import { useDynamicShortages } from '@/lib/use-dynamic-shortages'

import { Role } from '@prisma/client'

export interface UserProfile {
  id: string
  employeeId: string
  name: string
  role: Role | string
}

interface ShortageReport {
  id: string
  quantity: number | null
  unit: string | null
  notes: string | null
  status: string
  reportedAt: string
  medicine: {
    id: string
    brandName: string
    genericName: string
    strength: string
    dosageForm: string
    manufacturer?: {
      name: string
      shortName?: string | null
    }
  }
}

interface EmployeeShortageClientProps {
  user: UserProfile
}

export function EmployeeShortageClient({ user }: EmployeeShortageClientProps) {
  // Search state
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SelectedMedicine[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const clientCacheRef = useRef<Map<string, SelectedMedicine[]>>(new Map())

  // Frequently used medicines
  const [frequentMedicines, setFrequentMedicines] = useState<SelectedMedicine[]>([])
  const [loadingFrequent, setLoadingFrequent] = useState(true)

  // Today's employee reports
  const [myReports, setMyReports] = useState<ShortageReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)

  // Modal & Toast
  const [selectedMed, setSelectedMed] = useState<SelectedMedicine | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, type, text }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Edit My Report state
  const [editingReport, setEditingReport] = useState<ShortageReport | null>(null)
  const [editQty, setEditQty] = useState<string>('')
  const [editUnit, setEditUnit] = useState<string>('Box')
  const [editNotes, setEditNotes] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState<boolean>(false)

  // 1-Tap Instant Quick Add for Mobile
  const [quickAddingId, setQuickAddingId] = useState<string | null>(null)

  const handleQuickAdd = async (e: React.MouseEvent, med: SelectedMedicine) => {
    e.stopPropagation()

    // Prevent duplicate submission on client
    const alreadyExists = myReports.some(
      (r) =>
        r.medicine.id === med.id ||
        (r.medicine.brandName.toLowerCase() === med.brandName.toLowerCase() &&
          r.medicine.strength.toLowerCase().replace(/\s+/g, '') ===
            med.strength.toLowerCase().replace(/\s+/g, '') &&
          r.medicine.dosageForm.toLowerCase() === med.dosageForm.toLowerCase())
    )

    if (alreadyExists) {
      addToast('info', `${med.brandName} ${med.strength} is already on your shortage list today`)
      return
    }

    setQuickAddingId(med.id)

    try {
      const res = await fetch('/api/shortages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: med.id,
          quantity: null,
          unit: med.purchaseUnit || 'Box',
          notes: null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (data.isDuplicate) {
          addToast('info', data.message)
        } else {
          addToast('success', `⚡ Added ${med.brandName} ${med.strength} to Shortlist!`)
        }
        loadMyReports(true)
      } else {
        addToast('error', data.error || 'Failed to add shortage')
      }
    } catch {
      addToast('error', 'Network error adding shortage')
    } finally {
      setTimeout(() => setQuickAddingId(null), 700)
    }
  }

  const openEditModal = (report: ShortageReport) => {
    setEditingReport(report)
    setEditQty(report.quantity !== null && report.quantity !== undefined ? String(report.quantity) : '')
    setEditUnit(report.unit || 'Box')
    setEditNotes(report.notes || '')
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingReport) return

    setSavingEdit(true)
    try {
      const res = await fetch(`/api/shortages/${editingReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editQty ? parseFloat(editQty) : null,
          unit: editUnit,
          notes: editNotes.trim() || null,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        addToast('success', `Updated ${editingReport.medicine.brandName}`)
        setEditingReport(null)
        loadMyReports()
      } else {
        addToast('error', data.error || 'Failed to update report')
      }
    } catch (err) {
      console.error('Update error:', err)
      addToast('error', 'Network error updating report')
    } finally {
      setSavingEdit(false)
    }
  }

  // Load initial data on mount
  useEffect(() => {
    loadFrequent()
    loadMyReports()
  }, [])

  // 2. Load frequently used medicines
  const loadFrequent = async () => {
    try {
      setLoadingFrequent(true)
      const res = await fetch('/api/medicines/frequent')
      if (res.ok) {
        const data = await res.json()
        setFrequentMedicines(data.frequent || [])
      }
    } catch (err) {
      console.error('Error loading frequent medicines:', err)
    } finally {
      setLoadingFrequent(false)
    }
  }

  // 3. Load today's reports by current employee
  const loadMyReports = async (silent = false) => {
    try {
      if (!silent) setLoadingReports(true)
      const res = await fetch('/api/shortages?mode=my')
      if (res.ok) {
        const data = await res.json()
        const reportsList =
          data.reports ||
          (Array.isArray(data.rawReports)
            ? data.rawReports.filter((r: any) => r.employeeId === user.id)
            : [])
        setMyReports(reportsList)
      }
    } catch (err) {
      if (!silent) console.error('Error loading my reports:', err)
    } finally {
      if (!silent) setLoadingReports(false)
    }
  }

  // Instant dynamic multi-user sync
  useDynamicShortages({
    onUpdate: () => loadMyReports(true),
    pollIntervalMs: 4000,
  })

  // 4. Ultra-fast dynamic search with client cache and abort controller
  const performSearch = useCallback(async (searchTerm: string) => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) {
      setSearchResults([])
      setSearching(false)
      setSelectedIndex(-1)
      return
    }

    // Check instant client cache first (0ms latency!)
    if (clientCacheRef.current.has(q)) {
      setSearchResults(clientCacheRef.current.get(q)!)
      setSearching(false)
      setSelectedIndex(0)
      return
    }

    // Cancel previous ongoing fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Instant 0ms optimistic match from frequent medicines while network returns
    if (frequentMedicines.length > 0) {
      const quickMatches = frequentMedicines.filter(
        (m) =>
          m.brandName.toLowerCase().startsWith(q) ||
          m.brandName.toLowerCase().includes(q) ||
          m.genericName.toLowerCase().startsWith(q)
      )
      if (quickMatches.length > 0) {
        setSearchResults(quickMatches)
        setSelectedIndex(0)
      }
    }

    setSearching(true)
    try {
      const res = await fetch(`/api/medicines/search?q=${encodeURIComponent(q)}&limit=30`, {
        signal: controller.signal,
      })

      if (res.ok) {
        const data = await res.json()
        const items = data.medicines || []
        clientCacheRef.current.set(q, items)
        setSearchResults(items)
        setSelectedIndex(items.length > 0 ? 0 : -1)
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('Search error:', err)
      }
    } finally {
      setSearching(false)
    }
  }, [frequentMedicines])

  // Ultra-fast reactive debounce (25ms)
  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setSearchResults([])
      setSearching(false)
      return
    }

    // If already in client cache, return synchronously in 0ms!
    if (clientCacheRef.current.has(q.toLowerCase())) {
      performSearch(q)
      return
    }

    const timer = setTimeout(() => {
      performSearch(q)
    }, 25)

    return () => clearTimeout(timer)
  }, [query, performSearch])

  // Keyboard navigation inside search results
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
        handleSelectMedicine(searchResults[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setQuery('')
      setSearchResults([])
    }
  }

  // 5. Select medicine to report
  const handleSelectMedicine = (med: SelectedMedicine) => {
    setSelectedMed(med)
    setModalOpen(true)
  }

  // 6. Handle successful shortage addition
  const handleShortageSuccess = (medicineName: string) => {
    addToast('success', `✓ ${medicineName} added to today's shortage list`)
    setQuery('')
    setSearchResults([])
    loadMyReports()
    loadFrequent()

    // Immediately refocus search field so employee can report next medicine
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 80)
  }

  // 7. Remove/Undo a report
  const handleRemoveReport = async (reportId: string, medName: string) => {
    if (!confirm(`Remove "${medName}" from your today's reports?`)) return

    try {
      const res = await fetch(`/api/shortages/${reportId}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('info', `Removed ${medName}`)
        loadMyReports()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to remove report')
      }
    } catch (err) {
      console.error('Delete error:', err)
      addToast('error', 'Network error removing report')
    }
  }

  // Helper to highlight matching characters
  const highlightMatch = (text: string, searchWord: string) => {
    if (!searchWord.trim() || !text) return text
    const words = searchWord.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const regex = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-sky-200 text-sky-950 px-0.5 rounded font-black">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div
      className={`min-h-screen bg-slate-100 flex flex-col ${
        myReports.length > 0 ? 'pb-24 sm:pb-12' : 'pb-12'
      }`}
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <Navbar user={user} />
      <PwaInstallBanner />

      <main className="max-w-xl mx-auto w-full px-4 pt-4 flex-1 flex flex-col gap-4">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-lg font-bold text-slate-900">Medicine Short</h1>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200" suppressHydrationWarning>
              Today: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Search 25,000+ medicines by Brand, Generic, Strength, or Company.
          </p>

          {/* Quick Search Bar */}
          <div className="relative mt-3">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                placeholder="Search medicine brand, generic or company..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-12 pl-11 pr-10 text-sm sm:text-base font-semibold bg-slate-50 border-2 border-slate-200 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden transition-all shadow-inner placeholder:text-slate-400 placeholder:font-normal"
              />
              {query ? (
                <button
                  onClick={() => {
                    setQuery('')
                    setSearchResults([])
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : searching ? (
                <div className="absolute right-3">
                  <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : null}
            </div>

            {/* Live Search Results Dropdown */}
            {query.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-[60vh] overflow-y-auto z-30 divide-y divide-slate-100">
                {searching && searchResults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                    <span>Searching catalog...</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-xs font-semibold text-slate-700">No medicine matched "{query}"</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Check spelling or try searching generic name
                    </p>
                  </div>
                ) : (
                  searchResults.map((med, index) => {
                    const isSelected = index === selectedIndex
                    const isAlreadyReported = myReports.some(
                      (r) =>
                        r.medicine.id === med.id ||
                        (r.medicine.brandName.toLowerCase() === med.brandName.toLowerCase() &&
                          r.medicine.strength.toLowerCase().replace(/\s+/g, '') ===
                            med.strength.toLowerCase().replace(/\s+/g, '') &&
                          r.medicine.dosageForm.toLowerCase() === med.dosageForm.toLowerCase())
                    )

                    return (
                      <div
                        key={med.id}
                        onClick={() => handleSelectMedicine(med)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`p-3 sm:p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 text-sm">
                              {highlightMatch(med.brandName, query)}
                            </span>
                            <span className="text-xs font-semibold text-sky-700 px-1.5 py-0.5 bg-sky-100 rounded-md">
                              {med.strength}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({med.dosageForm})
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 truncate">
                            {highlightMatch(med.genericName, query)}
                          </div>
                          {med.manufacturer && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {med.manufacturer.shortName || med.manufacturer.name}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* 1-Tap Quick Add (No modal needed) */}
                          {isAlreadyReported ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                addToast(
                                  'info',
                                  `${med.brandName} ${med.strength} is already in your shortlist today`
                                )
                              }}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                              title="Already added to today's shortlist"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>In List</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleQuickAdd(e, med)}
                              disabled={quickAddingId === med.id}
                              className={`px-3 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-95 ${
                                quickAddingId === med.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white'
                              }`}
                              title="Instant 1-tap add to shortages"
                            >
                              {quickAddingId === med.id ? (
                                <CheckCircle2 className="w-3.5 h-3.5 animate-in zoom-in" />
                              ) : (
                                <Plus className="w-3.5 h-3.5" />
                              )}
                              <span>{quickAddingId === med.id ? 'Added' : 'Short'}</span>
                            </button>
                          )}

                          {/* Open custom quantity modal */}
                          <button
                            type="button"
                            onClick={() => handleSelectMedicine(med)}
                            className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 active:bg-sky-100 rounded-xl transition-colors cursor-pointer"
                            title="Add with quantity or notes"
                            aria-label="Add with quantity"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Frequently Used Medicines Section */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Frequently Used</span>
            </div>
            <span className="text-[11px] text-slate-400">1-Tap Shortcuts</span>
          </div>

          {loadingFrequent ? (
            <div className="flex gap-2 animate-pulse py-1">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-8 w-20 bg-slate-200 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {frequentMedicines.map((med) => (
                <button
                  key={med.id}
                  onClick={() => handleSelectMedicine(med)}
                  className="px-3 py-2 bg-slate-100 hover:bg-sky-50 active:bg-sky-100 text-slate-800 hover:text-sky-900 border border-slate-200 hover:border-sky-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Pill className="w-3 h-3 text-sky-600 shrink-0" />
                  <span>
                    {med.brandName} {med.strength}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Today's My Reports */}
        <div id="my-shortlist-section" className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 flex-1 flex flex-col scroll-mt-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Today's My Reports</span>
                <span className="text-xs bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded-full">
                  {myReports.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Submissions made by you today</p>
            </div>
            <div className="flex items-center gap-1.5">
              <CopyShortlistButton
                items={myReports}
                variant="compact"
                className="h-8"
                buttonText="Copy List"
                onToast={addToast}
              />
              <button
                onClick={() => loadMyReports(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-sky-600 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                title="Refresh my reports"
              >
                <RefreshCw className={`w-4 h-4 ${loadingReports ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="mt-3 flex-1">
            {loadingReports && myReports.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading your submissions...</div>
            ) : myReports.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <Pill className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-medium">You haven't reported any shortages today yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Type medicine name above to add your first shortage!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {myReports.map((report) => {
                  const timeStr = new Date(report.reportedAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })

                  return (
                    <div
                      key={report.id}
                      className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {report.medicine.brandName}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {report.medicine.strength}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({report.medicine.dosageForm})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 ml-6 text-xs text-slate-600">
                          <span>
                            {report.quantity ? (
                              <strong className="text-slate-800">
                                {report.quantity} {report.unit || 'Box'}
                              </strong>
                            ) : (
                              <span className="text-amber-700 font-semibold">Short (Qty not set)</span>
                            )}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            {timeStr}
                          </span>
                        </div>

                        {report.notes && (
                          <p className="text-[11px] text-slate-500 italic mt-1 ml-6">
                            "{report.notes}"
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {/* Edit button */}
                        <button
                          onClick={() => openEditModal(report)}
                          className="text-slate-400 hover:text-sky-600 p-2 rounded-lg hover:bg-sky-50 transition-colors cursor-pointer"
                          title="Edit quantity or notes"
                          aria-label="Edit report"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        {/* Undo / Remove button for recent submission */}
                        <button
                          onClick={() =>
                            handleRemoveReport(
                              report.id,
                              `${report.medicine.brandName} ${report.medicine.strength}`
                            )
                          }
                          className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove this report"
                          aria-label="Remove report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Credit */}
        <footer className="mt-8 py-4 text-center text-xs text-slate-400 border-t border-slate-200">
          <p>
            Designed &amp; Developed by{' '}
            <a
              href="https://3s-soft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-600 font-semibold hover:underline"
            >
              3s-Soft
            </a>
          </p>
        </footer>

        {/* Mobile Sticky Floating Shortlist Bar */}
        {myReports.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 px-4 py-2.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.1)] z-40 md:hidden flex items-center justify-between gap-3 safe-area-inset-bottom">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById('my-shortlist-section')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              className="min-w-0 flex-1 text-left cursor-pointer active:opacity-75 transition-opacity"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-black text-slate-900 truncate">
                  Shortlist ({myReports.length})
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                {myReports.slice(0, 2).map((r) => r.medicine.brandName).join(', ')}
                {myReports.length > 2 ? ` +${myReports.length - 2} more` : ''}
              </p>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById('my-shortlist-section')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="h-10 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
                title="View shortage list"
              >
                <span>View</span>
              </button>

              <CopyShortlistButton
                items={myReports}
                buttonText={`Copy (${myReports.length})`}
                className="h-10"
                dropdownDirection="up"
                onToast={addToast}
              />
            </div>
          </div>
        )}
      </main>

      {/* Shortage Add Modal / Bottom Drawer */}
      <ShortageAddModal
        medicine={selectedMed}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedMed(null)
        }}
        onSuccess={handleShortageSuccess}
      />

      {/* Edit My Report Modal */}
      {editingReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Report
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingReport.medicine.brandName} {editingReport.medicine.strength} ({editingReport.medicine.dosageForm})
                </p>
              </div>
              <button
                onClick={() => setEditingReport(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Requested Quantity
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    placeholder="Enter quantity (e.g. 5)"
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-hidden"
                    autoFocus
                  />
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-hidden"
                  >
                    <option value="Box">Box</option>
                    <option value="Strip">Strip</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Vial">Vial</option>
                    <option value="Ampoule">Ampoule</option>
                    <option value="Tube">Tube</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g., Customer waiting, urgent"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReport(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
