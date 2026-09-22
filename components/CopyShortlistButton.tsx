'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Copy,
  Check,
  Share2,
  ChevronDown,
  MessageCircle,
  ExternalLink,
} from 'lucide-react'
import {
  ShortlistMedicineItem,
  FormatShortlistOptions,
  formatShortlistForMessage,
  copyToClipboard,
  getWhatsAppShareUrl,
} from '@/lib/shortlist-formatter'

interface CopyShortlistButtonProps {
  items: ShortlistMedicineItem[]
  options?: FormatShortlistOptions
  onToast?: (type: 'success' | 'error' | 'info', text: string) => void
  variant?: 'default' | 'compact' | 'minimal'
  buttonText?: string
  disabled?: boolean
  className?: string
  showWhatsAppOption?: boolean
  dropdownDirection?: 'up' | 'down'
}

export function CopyShortlistButton({
  items,
  options = {},
  onToast,
  variant = 'default',
  buttonText,
  disabled = false,
  className = '',
  showWhatsAppOption = true,
  dropdownDirection = 'down',
}: CopyShortlistButtonProps) {
  const [copied, setCopied] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleCopy = async () => {
    if (items.length === 0) {
      onToast?.('info', 'Shortlist is empty. Nothing to copy.')
      return
    }

    const message = formatShortlistForMessage(items, options)
    const success = await copyToClipboard(message)

    if (success) {
      setCopied(true)
      onToast?.(
        'success',
        `Copied ${items.length} shortage item${items.length > 1 ? 's' : ''} to clipboard!`
      )
      setTimeout(() => setCopied(false), 2000)
    } else {
      onToast?.('error', 'Failed to copy to clipboard')
    }
  }

  const handleOpenWhatsApp = async () => {
    if (items.length === 0) {
      onToast?.('info', 'Shortlist is empty. Nothing to send.')
      return
    }

    const message = formatShortlistForMessage(items, options)
    // Also copy to clipboard for convenience
    await copyToClipboard(message)

    const url = getWhatsAppShareUrl(message)
    window.open(url, '_blank', 'noopener,noreferrer')
    setDropdownOpen(false)

    onToast?.(
      'success',
      'Opening WhatsApp & copied to clipboard!'
    )
  }

  const isDisabled = disabled || items.length === 0
  const defaultLabel = copied ? 'Copied!' : buttonText || `Copy Shortlist (${items.length})`

  // Minimal variant: Just an icon button (e.g. inside tight list headers)
  if (variant === 'minimal') {
    return (
      <button
        onClick={handleCopy}
        disabled={isDisabled}
        title={copied ? 'Copied to clipboard!' : 'Copy shortlist for WhatsApp or SMS'}
        className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          copied
            ? 'bg-emerald-100 text-emerald-700'
            : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
        } ${className}`}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      </button>
    )
  }

  // Compact variant: Small pill for secondary toolbars
  if (variant === 'compact') {
    const hasHeight = className.includes('h-')
    const defaultHeightClass = hasHeight ? '' : 'h-8'

    return (
      <div className={`relative inline-flex items-stretch ${defaultHeightClass} ${className}`} ref={dropdownRef}>
        <div className="inline-flex items-stretch w-full h-full rounded-xl shadow-xs border border-emerald-600/30 overflow-hidden bg-emerald-50">
          <button
            onClick={handleCopy}
            disabled={isDisabled}
            className={`flex-1 self-stretch h-full px-3 py-1.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-600/10 hover:bg-emerald-600 hover:text-white text-emerald-800'
            }`}
            title="Copy shortlist for WhatsApp or SMS"
          >
            {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">{copied ? 'Copied!' : buttonText || 'Copy Shortlist'}</span>
          </button>

          {showWhatsAppOption && !isDisabled && (
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="self-stretch h-full px-2 py-1.5 bg-emerald-600/15 hover:bg-emerald-600 hover:text-white text-emerald-800 border-l border-emerald-600/20 transition-colors cursor-pointer flex items-center justify-center shrink-0"
              title="More options"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div
            className={`absolute right-0 ${
              dropdownDirection === 'up'
                ? 'bottom-full mb-1.5 origin-bottom-right'
                : 'top-full mt-1.5 origin-top-right'
            } w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
          >
            <button
              onClick={handleOpenWhatsApp}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              <span>Send via WhatsApp</span>
            </button>
            <button
              onClick={() => {
                handleCopy()
                setDropdownOpen(false)
              }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              <span>Copy as Plain Text</span>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Default variant: Primary prominent action button with split WhatsApp dropdown
  const hasHeight = className.includes('h-')
  const defaultHeightClass = hasHeight ? '' : 'h-10'

  return (
    <div className={`relative inline-flex items-stretch ${defaultHeightClass} ${className}`} ref={dropdownRef}>
      <div className="inline-flex items-stretch w-full h-full rounded-xl shadow-xs overflow-hidden bg-emerald-800">
        {/* Main Copy Button */}
        <button
          onClick={handleCopy}
          disabled={isDisabled}
          className={`flex-1 self-stretch h-full px-3.5 py-2 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
            copied
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
          }`}
          title="Copy formatted shortlist for WhatsApp or SMS"
        >
          {copied ? (
            <Check className="w-4 h-4 text-white animate-in zoom-in duration-150 shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-emerald-200 shrink-0" />
          )}
          <span className="truncate">{defaultLabel}</span>
        </button>

        {/* Dropdown toggle for WhatsApp */}
        {showWhatsAppOption && !isDisabled && (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="self-stretch h-full px-2.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white border-l border-emerald-600/40 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Shortlist share options"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div
          className={`absolute right-0 ${
            dropdownDirection === 'up'
              ? 'bottom-full mb-1.5 origin-bottom-right'
              : 'top-full mt-1.5 origin-top-right'
          } w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className="px-3 py-1.5 border-b border-slate-100">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Share Shortlist
            </p>
            <p className="text-[10px] text-slate-400">
              Formatted for WhatsApp &amp; Text
            </p>
          </div>

          <button
            onClick={handleOpenWhatsApp}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span>Send to WhatsApp</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </div>
              <p className="text-[10px] text-slate-400 font-normal">Opens app / web directly</p>
            </div>
          </button>

          <button
            onClick={() => {
              handleCopy()
              setDropdownOpen(false)
            }}
            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Copy className="w-4 h-4 text-slate-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <span>Copy Formatted Text</span>
              <p className="text-[10px] text-slate-400 font-normal">For SMS, email, or pasting</p>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}
