'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Check, Plus, Minus, AlertCircle, Zap, ShieldCheck } from 'lucide-react'

export interface SelectedMedicine {
  id: string
  brandName: string
  strength: string
  dosageForm: string
  genericName: string
  purchaseUnit?: string | null
  retailUnit?: string | null
  manufacturer?: {
    name: string
    shortName?: string | null
  }
}

interface ShortageAddModalProps {
  medicine: SelectedMedicine | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (medicineName: string) => void
}

export function ShortageAddModal({
  medicine,
  isOpen,
  onClose,
  onSuccess,
}: ShortageAddModalProps) {
  const [quantity, setQuantity] = useState<string>('')
  const [unit, setUnit] = useState<string>('Box')
  const [notes, setNotes] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && medicine) {
      setQuantity('')
      setNotes('')
      setError(null)
      setUnit(medicine.purchaseUnit || 'Box')
      // Auto-focus on desktop / non-touch
      if (typeof window !== 'undefined' && window.innerWidth >= 640) {
        setTimeout(() => {
          qtyInputRef.current?.focus()
        }, 150)
      }
    }
  }, [isOpen, medicine])

  if (!isOpen || !medicine) return null

  const handleStepQuantity = (delta: number) => {
    const current = parseInt(quantity || '0', 10)
    const nextVal = Math.max(1, current + delta)
    setQuantity(nextVal.toString())
  }

  const handleSetPreset = (val: number, presetUnit?: string) => {
    setQuantity(val.toString())
    if (presetUnit) setUnit(presetUnit)
  }

  const handleSubmit = async (e?: React.FormEvent, skipQuantity = false) => {
    if (e) e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/shortages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medicineId: medicine.id,
          quantity: skipQuantity ? null : (quantity ? parseFloat(quantity) : null),
          unit: unit || 'Box',
          notes: notes.trim() || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit shortage report')
      }

      onSuccess(`${medicine.brandName} ${medicine.strength}`)
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error submitting shortage'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white w-full max-w-lg rounded-t-[28px] sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-8 duration-200">
        {/* Mobile drag handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center bg-slate-900">
          <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-sky-800 text-sky-200 font-bold uppercase tracking-wider">
                {medicine.dosageForm}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {medicine.manufacturer?.shortName || medicine.manufacturer?.name}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black mt-1 text-white leading-tight truncate">
              {medicine.brandName} <span className="text-sky-400">{medicine.strength}</span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5 truncate">{medicine.genericName}</p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={(e) => handleSubmit(e, false)} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Buttons (Thumb-friendly 1-tap) */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
              Quick Quantity Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 5, 10].map((num) => {
                const isSelected = quantity === num.toString()
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSetPreset(num, 'Box')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 active:bg-sky-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    {num} Box
                  </button>
                )
              })}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[20, 50, 100].map((num) => {
                const isSelected = quantity === num.toString()
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleSetPreset(num)}
                    className={`py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 active:bg-sky-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    +{num}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Quantity & Stepper Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Quantity &amp; Unit
              </label>
              {quantity && (
                <button
                  type="button"
                  onClick={() => setQuantity('')}
                  className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear Qty
                </button>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2 items-center">
              {/* Stepper Down */}
              <button
                type="button"
                onClick={() => handleStepQuantity(-1)}
                className="col-span-2 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="Decrease"
              >
                <Minus className="w-5 h-5" />
              </button>

              {/* Number Input */}
              <div className="col-span-6 relative">
                <input
                  ref={qtyInputRef}
                  type="number"
                  inputMode="numeric"
                  placeholder="Short (Optional)"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full h-12 text-center text-lg font-black bg-slate-50 border-2 border-slate-300 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden transition-all placeholder:text-xs placeholder:font-medium placeholder:text-slate-400"
                />
              </div>

              {/* Stepper Up */}
              <button
                type="button"
                onClick={() => handleStepQuantity(1)}
                className="col-span-2 h-12 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="Increase"
              >
                <Plus className="w-5 h-5" />
              </button>

              {/* Unit Dropdown */}
              <div className="col-span-2">
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-12 text-xs font-bold bg-slate-100 border-2 border-slate-300 rounded-xl px-1 text-center focus:border-sky-600 focus:outline-hidden cursor-pointer"
                >
                  <option value="Box">Box</option>
                  <option value="Strip">Strip</option>
                  <option value="Pcs">Pcs</option>
                  <option value="Tablet">Tab</option>
                  <option value="Capsule">Cap</option>
                  <option value="Bottle">Btl</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Notes */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 block">
              Urgent Note <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Urgent customer order, Rack B empty"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={200}
              className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-300 focus:border-sky-600 focus:bg-white rounded-xl focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold rounded-2xl text-base shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>
                    {quantity ? `ADD ${quantity} ${unit.toUpperCase()} TO SHORTLIST` : 'ADD SHORTAGE'}
                  </span>
                </>
              )}
            </button>

            {/* Quick 1-Tap No Qty */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(undefined, true)}
              className="w-full py-2.5 text-xs text-slate-600 hover:text-slate-900 active:bg-slate-100 font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Instant 1-Tap Short (No Quantity Needed)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
