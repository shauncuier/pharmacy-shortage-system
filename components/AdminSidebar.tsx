'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Pill,
  Building2,
  Users,
  FileText,
  Printer,
  Settings,
  Smartphone,
  ChevronRight,
  Shield,
  Store,
  ShoppingCart,
  PlusCircle,
  CreditCard,
  Package,
  BarChart3,
  TrendingUp,
} from 'lucide-react'

export function AdminSidebar() {
  const pathname = usePathname()

  const sections = [
    {
      title: 'Shortage System',
      links: [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
        { href: '/admin/shortages', label: "Today's Shortages", icon: ClipboardList },
        { href: '/admin/print', label: 'Print Shortages (A4)', icon: Printer },
        { href: '/admin/reports', label: 'History & Reports', icon: FileText },
      ],
    },
    {
      title: 'Counter & Retail Sales',
      links: [
        { href: '/pos', label: 'POS Terminal Counter', icon: CreditCard },
        { href: '/admin/pos/reports', label: 'POS Sales Analytics', icon: BarChart3 },
      ],
    },
    {
      title: 'Wholesale & B2B',
      links: [
        { href: '/admin/wholesale', label: 'Wholesale Hub', icon: Package, exact: true },
        { href: '/admin/wholesale/orders/new', label: 'New Wholesale Order', icon: PlusCircle },
        { href: '/admin/wholesale/orders', label: 'Wholesale Orders', icon: ShoppingCart },
        { href: '/admin/wholesale/retailers', label: 'Retailer Directory', icon: Store },
        { href: '/admin/wholesale/payments', label: 'Dues & Payments', icon: CreditCard },
        { href: '/admin/wholesale/reports', label: 'Retailer Advance Reports', icon: TrendingUp },
      ],
    },
    {
      title: 'Catalog & System',
      links: [
        { href: '/admin/medicines', label: 'Medicine & Price Master', icon: Pill },
        { href: '/admin/manufacturers', label: 'Manufacturers', icon: Building2 },
        { href: '/admin/employees', label: 'Employees', icon: Users },
        { href: '/admin/settings', label: 'Backup & Network', icon: Settings },
      ],
    },
  ]

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 no-print h-screen sticky top-0">
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide uppercase">
                Admin Console
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Shortage &amp; Wholesale
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto custom-scrollbar">
          {sections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {section.title}
              </div>
              {section.links.map((link) => {
                const Icon = link.icon
                const active = isActive(link.href, link.exact)

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-sky-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{link.label}</span>
                    </div>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-white/80 shrink-0" />}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Quick link to POS & employee view */}
        <div className="p-3 border-t border-slate-800 shrink-0 space-y-2">
          <Link
            href="/pos"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            <span>Open POS Counter</span>
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile Staff Entry</span>
          </Link>
        </div>

        {/* Developer Credit */}
        <div className="p-2.5 border-t border-slate-800/80 text-[10px] text-slate-500 text-center leading-tight shrink-0">
          <span>Designed &amp; Developed by</span>
          <a
            href="https://3s-soft.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 font-semibold hover:underline block mt-0.5"
          >
            3s-Soft
          </a>
        </div>
      </aside>

      {/* Mobile Horizontal Sub-Navigation */}
      <div className="lg:hidden bg-slate-900 border-b border-slate-800 text-white overflow-x-auto no-scrollbar scroll-smooth no-print sticky top-14 z-20">
        <div className="flex items-center gap-1.5 p-2 px-3 pr-6 min-w-max">
          {sections.flatMap((s) => s.links).map((link) => {
            const Icon = link.icon
            const active = isActive(link.href, link.exact)

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800 bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
