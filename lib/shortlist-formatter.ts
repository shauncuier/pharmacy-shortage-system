/**
 * Utility functions for formatting and copying medicine shortage lists
 * optimized for sharing via WhatsApp, SMS, or plain text.
 */

export interface ShortlistMedicineItem {
  medicine: {
    brandName: string
    strength?: string | null
    dosageForm?: string | null
    genericName?: string | null
    manufacturer?: {
      name?: string | null
      shortName?: string | null
    } | null
  }
  quantity?: number | null
  totalQuantity?: number | null
  unit?: string | null
  units?: string[]
  notes?: string | null
  reports?: Array<{
    notes?: string | null
    quantity?: number | null
    unit?: string | null
  }>
}

export interface FormatShortlistOptions {
  pharmacyName?: string
  date?: string
  filterBrand?: string
  filterManufacturer?: string
}

/**
 * Format a list of shortage items into a clean message suitable for WhatsApp and SMS.
 */
export function formatShortlistForMessage(
  items: ShortlistMedicineItem[],
  options: FormatShortlistOptions = {}
): string {
  const pharmacyName = options.pharmacyName || 'Bara-Awlia Medical Hall'
  
  // Format date if provided, otherwise default to today
  let dateStr = ''
  if (options.date) {
    try {
      const parsed = new Date(options.date.includes('T') ? options.date : options.date + 'T00:00:00')
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      } else {
        dateStr = options.date
      }
    } catch {
      dateStr = options.date
    }
  } else {
    dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const lines: string[] = []

  // Header
  lines.push(`📋 *${pharmacyName}*`)
  lines.push(`*Medicine Shortage List*`)
  lines.push(`📅 Date: ${dateStr}`)

  if (options.filterManufacturer && options.filterManufacturer !== 'ALL') {
    lines.push(`🏢 Company: ${options.filterManufacturer}`)
  }

  if (options.filterBrand && options.filterBrand !== 'ALL') {
    lines.push(`🏷️ Brand: ${options.filterBrand}`)
  }

  lines.push(`📦 Total Items: ${items.length}`)
  lines.push('')

  if (items.length === 0) {
    lines.push('(No shortage items listed)')
    return lines.join('\n')
  }

  // Items
  items.forEach((item, idx) => {
    const brand = item.medicine.brandName?.trim() || 'Unknown'
    const strength = item.medicine.strength?.trim() || ''
    const dosage = item.medicine.dosageForm?.trim() || ''
    const mfg =
      item.medicine.manufacturer?.shortName?.trim() ||
      item.medicine.manufacturer?.name?.trim() ||
      ''

    // Calculate quantity and units
    let qtyStr = ''
    if (item.totalQuantity !== undefined && item.totalQuantity !== null && item.totalQuantity > 0) {
      const unit = item.units && item.units.length > 0 ? item.units.join('/') : 'Box'
      qtyStr = `${item.totalQuantity} ${unit}`
    } else if (item.quantity !== undefined && item.quantity !== null && item.quantity > 0) {
      const unit = item.unit || 'Box'
      qtyStr = `${item.quantity} ${unit}`
    }

    // Notes extraction
    let noteText = ''
    if (item.reports && item.reports.length > 0) {
      const reportNotes = item.reports
        .map((r) => r.notes?.trim())
        .filter(Boolean) as string[]
      if (reportNotes.length > 0) {
        noteText = Array.from(new Set(reportNotes)).join('; ')
      }
    } else if (item.notes?.trim()) {
      noteText = item.notes.trim()
    }

    // Don't repeat manufacturer if we already have a company filter for it
    const showMfg =
      mfg &&
      (!options.filterManufacturer ||
        options.filterManufacturer === 'ALL' ||
        options.filterManufacturer.toLowerCase() !== mfg.toLowerCase())

    let itemLine = `${idx + 1}. *${brand}*`
    if (strength) itemLine += ` ${strength}`
    if (dosage) itemLine += ` ${dosage}`
    if (showMfg) itemLine += ` (${mfg})`
    if (qtyStr) itemLine += ` - ${qtyStr}`

    lines.push(itemLine)
    if (noteText) {
      lines.push(`   📝 Note: ${noteText}`)
    }
  })

  lines.push('')
  lines.push('— Generated from BMH Shortage System')

  return lines.join('\n')
}

/**
 * Bulletproof copy to clipboard supporting modern HTTPS APIs
 * and fallback to textarea/execCommand for LAN HTTP deployments (e.g. 192.168.x.x).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern Clipboard API if supported and in secure context
  if (typeof window !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (err) {
      console.warn('navigator.clipboard failed, attempting fallback:', err)
    }
  }

  // Fallback for non-HTTPS LAN access, older browsers, or permission restrictions
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.setAttribute('readonly', '')
      textArea.style.position = 'fixed'
      textArea.style.top = '0'
      textArea.style.left = '0'
      textArea.style.width = '2em'
      textArea.style.height = '2em'
      textArea.style.padding = '0'
      textArea.style.border = 'none'
      textArea.style.outline = 'none'
      textArea.style.boxShadow = 'none'
      textArea.style.background = 'transparent'
      document.body.appendChild(textArea)

      textArea.focus()
      textArea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textArea)
      return successful
    } catch (err) {
      console.error('Fallback execCommand copy failed:', err)
      return false
    }
  }

  return false
}

/**
 * Generate a WhatsApp sharing link with pre-filled text.
 */
export function getWhatsAppShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`
}
