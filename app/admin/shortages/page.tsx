'use client'

import React, { useState, useEffect } from 'react'
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  Download,
  Printer,
  RefreshCw,
  X,
  AlertCircle,
  Package,
} from 'lucide-react'
import Link from 'next/link'
import { ToastContainer, ToastMessage } from '@/components/Toast'
import { CopyShortlistButton } from '@/components/CopyShortlistButton'
import { getLocalDateString } from '@/lib/date-utils'
import { useDynamicShortages } from '@/lib/use-dynamic-shortages'

interface ShortageItem {
  id: string
  medicineId: string
  quantity: number | null
  unit: string | null
  notes: string | null
  status: 'REPORTED' | 'REVIEWED' | 'ORDERED' | 'CANCELLED'
  reportedDate: string
  reportedAt: string
  reviewedAt: string | null
  reviewedBy: string | null
  orderedAt: string | null
  orderedBy: string | null
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
  employee: {
    id: string
    employeeId: string
    name: string
  }
}

export default function AdminShortagesPage() {
  const [shortages, setShortages] = useState<ShortageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [dateFilter, setDateFilter] = useState<string>(getLocalDateString())
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [deletingBulk, setDeletingBulk] = useState(false)

  // Edit modal
  const [editingShortage, setEditingShortage] = useState<ShortageItem | null>(null)
  const [editQty, setEditQty] = useState<string>('')
  const [editUnit, setEditUnit] = useState<string>('Box')
  const [editStatus, setEditStatus] = useState<string>('REPORTED')
  const [editNotes, setEditNotes] = useState<string>('')
  const [savingEdit, setSavingEdit] = useState(false)

  const addToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToasts((prev) => [...prev, { id: Date.now().toString(), type, text }])
  }

  const loadShortages = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const query = new URLSearchParams()
      if (dateFilter) query.set('date', dateFilter)
      if (statusFilter !== 'ALL') query.set('status', statusFilter)

      const res = await fetch(`/api/shortages?${query.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setShortages(data.rawReports || [])
      }
    } catch (err) {
      if (!silent) {
        console.error('Error loading shortages:', err)
        addToast('error', 'Failed to load shortage list')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    setSelectedIds([])
    loadShortages()
  }, [dateFilter, statusFilter])

  // Instant dynamic multi-user sync
  useDynamicShortages({
    onUpdate: () => loadShortages(true),
    pollIntervalMs: 3000,
  })

  // Delete shortage
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete report for "${name}"?`)) return

    try {
      const res = await fetch(`/api/shortages/${id}`, { method: 'DELETE' })
      if (res.ok) {
        addToast('success', `Deleted report for ${name}`)
        loadShortages()
      } else {
        addToast('error', 'Failed to delete report')
      }
    } catch (err) {
      addToast('error', 'Network error deleting report')
    }
  }

  // Open edit modal
  const openEditModal = (item: ShortageItem) => {
    setEditingShortage(item)
    setEditQty(item.quantity ? item.quantity.toString() : '')
    setEditUnit(item.unit || 'Box')
    setEditStatus(item.status)
    setEditNotes(item.notes || '')
  }

  // Save edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingShortage) return

    setSavingEdit(true)
    try {
      const res = await fetch(`/api/shortages/${editingShortage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: editQty ? parseFloat(editQty) : null,
          unit: editUnit,
          status: editStatus,
          notes: editNotes.trim() || null,
        }),
      })

      if (res.ok) {
        addToast('success', 'Shortage record updated successfully')
        setEditingShortage(null)
        loadShortages()
      } else {
        const data = await res.json()
        addToast('error', data.error || 'Failed to update shortage')
      }
    } catch (err) {
      addToast('error', 'Network error saving update')
    } finally {
      setSavingEdit(false)
    }
  }

  // Filter shortages locally by search
  const filteredShortages = shortages.filter((item) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.medicine.brandName.toLowerCase().includes(q) ||
      item.medicine.genericName.toLowerCase().includes(q) ||
      item.medicine.strength.toLowerCase().includes(q) ||
      item.medicine.manufacturer?.name.toLowerCase().includes(q) ||
      item.employee.name.toLowerCase().includes(q) ||
      item.employee.employeeId.toLowerCase().includes(q)
    )
  })

  // Bulk selection handlers
  const handleToggleSelectAll = () => {
    const selectableIds = filteredShortages.map((item) => item.id)
    const allSelected =
      selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id))

    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(selectableIds)
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return

    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.length} selected shortage report(s)? This action cannot be undone.`
      )
    ) {
      return
    }

    setDeletingBulk(true)
    try {
      const res = await fetch('/api/shortages/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortageIds: selectedIds }),
      })

      const data = await res.json()
      if (res.ok) {
        addToast('success', `Successfully deleted ${data.deletedCount} shortage record(s)`)
        setSelectedIds([])
        loadShortages()
      } else {
        addToast('error', data.error || 'Failed to bulk delete shortages')
      }
    } catch (err) {
      console.error('Bulk delete error:', err)
      addToast('error', 'Network error during bulk delete')
    } finally {
      setDeletingBulk(false)
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    if (filteredShortages.length === 0) {
      addToast('info', 'No items to export')
      return
    }

    const headers = [
      'No',
      'Date',
      'Time',
      'Brand Name',
      'Strength',
      'Dosage Form',
      'Generic Name',
      'Manufacturer',
      'Quantity',
      'Unit',
      'Reported By',
      'Employee ID',
      'Status',
      'Notes',
    ]

    const rows = filteredShortages.map((item, idx) => [
      idx + 1,
      item.reportedDate,
      `"${new Date(item.reportedAt).toLocaleTimeString()}"`,
      `"${item.medicine.brandName}"`,
      `"${item.medicine.strength}"`,
      `"${item.medicine.dosageForm}"`,
      `"${item.medicine.genericName}"`,
      `"${item.medicine.manufacturer?.name || ''}"`,
      item.quantity ?? '',
      `"${item.unit || ''}"`,
      `"${item.employee.name}"`,
      `"${item.employee.employeeId}"`,
      item.status,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `shortage-records-${dateFilter}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    addToast('success', 'CSV exported')
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shortage Records</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed log of all individual employee shortage reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopyShortlistButton
            items={filteredShortages}
            className="h-10"
            options={{
              date: dateFilter,
            }}
            onToast={addToast}
          />
          <Link
            href={`/admin/print?date=${dateFilter}`}
            className="h-10 px-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print View</span>
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

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Search */}
        <div className="sm:col-span-2 relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search medicine, staff, or generic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-xs bg-slate-50 border border-slate-300 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden"
          />
        </div>

        {/* Date Filter */}
        <div>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-300 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-10 px-3 text-xs font-semibold bg-slate-50 border border-slate-300 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="REPORTED">Reported (Pending)</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="ORDERED">Ordered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Shortage Records Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Shortage Submissions ({filteredShortages.length})
            </span>
            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-200">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  onClick={() => setSelectedIds([])}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Deselect All
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={deletingBulk}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Delete selected shortage reports"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deletingBulk ? 'Deleting...' : `Bulk Delete (${selectedIds.length})`}</span>
                </button>
              </>
            )}

            <button
              onClick={() => loadShortages(false)}
              className="text-slate-400 hover:text-sky-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              title="Reload records"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading shortages...</div>
        ) : filteredShortages.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No shortage records found</p>
            <p className="text-xs text-slate-400 mt-1">Try changing the date or search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredShortages.length > 0 &&
                        filteredShortages.every((item) => selectedIds.includes(item.id))
                      }
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                  <th className="p-3.5">Medicine</th>
                  <th className="p-3.5">Manufacturer</th>
                  <th className="p-3.5">Quantity</th>
                  <th className="p-3.5">Reported By</th>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredShortages.map((item) => {
                  const statusColors = {
                    REPORTED: 'bg-amber-100 text-amber-800 border-amber-200',
                    REVIEWED: 'bg-sky-100 text-sky-800 border-sky-200',
                    ORDERED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    CANCELLED: 'bg-slate-100 text-slate-600 border-slate-200',
                  }
                  const isSelected = selectedIds.includes(item.id)

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${
                        isSelected ? 'bg-sky-50/70 hover:bg-sky-100/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(item.id)}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {item.medicine.brandName} {item.medicine.strength}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {item.medicine.genericName} ({item.medicine.dosageForm})
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            Note: "{item.notes}"
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 font-medium text-slate-600">
                        {item.medicine.manufacturer?.shortName || item.medicine.manufacturer?.name}
                      </td>

                      <td className="p-3.5 font-bold text-slate-900">
                        {item.quantity ? `${item.quantity} ${item.unit || 'Box'}` : '—'}
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800">{item.employee.name}</div>
                        <div className="text-[10px] text-slate-400">{item.employee.employeeId}</div>
                      </td>

                      <td className="p-3.5 text-slate-500">
                        {new Date(item.reportedAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                            statusColors[item.status]
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td className="p-3.5 text-right space-x-1">
                        <Link
                          href={`/admin/print?date=${item.reportedDate}&brand=${encodeURIComponent(item.medicine.brandName)}`}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-block align-middle"
                          title={`Print shortages for ${item.medicine.brandName}`}
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer inline-block align-middle"
                          title="Edit report"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(
                              item.id,
                              `${item.medicine.brandName} (${item.employee.name})`
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer inline-block align-middle"
                          title="Delete report"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Shortage Modal */}
      {editingShortage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">Edit Shortage Record</h3>
              <button
                onClick={() => setEditingShortage(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-sm text-slate-900">
                  {editingShortage.medicine.brandName} {editingShortage.medicine.strength}
                </div>
                <div className="text-slate-500 mt-0.5">
                  Reported by: {editingShortage.employee.name} ({editingShortage.employee.employeeId})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    placeholder="Leave empty if none"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                  >
                    <option value="Box">Box</option>
                    <option value="Strip">Strip</option>
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Bottle">Bottle</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold"
                >
                  <option value="REPORTED">Reported (Pending)</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="ORDERED">Ordered</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional admin or employee notes"
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingShortage(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl disabled:opacity-50"
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
