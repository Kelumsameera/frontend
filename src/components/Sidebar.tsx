"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FaHouse, FaChartLine, FaDroplet, FaGaugeHigh, FaChartArea, FaDatabase, FaClockRotateLeft, FaTableList, FaBars, FaXmark, FaBell, FaAnglesLeft, FaAnglesRight } from "react-icons/fa6";

const LINKS = [
  { href: "/", label: "Home", icon: FaHouse },
  { href: "/dashboard", label: "Live Dashboard", icon: FaChartLine },
  { href: "/pressure", label: "Pressure", icon: FaGaugeHigh },
  { href: "/water", label: "Water", icon: FaDroplet },
  { href: "/chart", label: "Charts", icon: FaChartArea },
  { href: "/history", label: "Pressure History", icon: FaClockRotateLeft },
  { href: "/database", label: "Pressure DB", icon: FaDatabase },
  { href: "/waterdb", label: "Water DB", icon: FaTableList },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-(--on-sidebar-text,white)">
        <FaGaugeHigh size={16} />
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-bold text-(--on-sidebar-text,white)">Environmental EMS</div>
        <div className="text-[11px] font-mono text-(--on-sidebar-muted,#9ca3af)">Flexicare Lanka</div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false); // mobile drawer
  const [hidden, setHidden] = useState(false); // desktop sidebar hide/show
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-(--sidebar,#0f172a)">
        <Logo />
        <div className="flex items-center gap-2">
          <button aria-label="Notifications" className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-muted,#9ca3af) hover:bg-white/10 transition">
            <FaBell size={14} />
          </button>
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-text,white) hover:bg-white/10 transition">
            <FaBars size={16} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-(--sidebar,#0f172a) z-50 transform transition-transform duration-300 lg:hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Logo />
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10">
            <FaXmark size={16} />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3 mt-2">
          {LINKS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all border-l-2 ${
                  active ? "bg-(--sidebar-active,#1e293b)#8FC6FF]" : "text-(--on-sidebar-muted,#9ca3af) hover:bg-white/5 hover:text-white border-transparent"
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop fixed sidebar — hidden entirely (width 0) when collapsed */}
      <aside
        className={`hidden lg:flex lg:flex-col lg:shrink-0 bg-(--sidebar,#0f172a) py-6 transition-all duration-300 overflow-hidden min-h-screen ${
          hidden ? "lg:w-0 lg:px-0 lg:py-0 lg:opacity-0" : "lg:w-60 px-4 opacity-100"
        }`}
      >
        <div className="px-2 mb-8 flex items-center justify-between">
          <Logo />
          <button
            aria-label="Hide sidebar"
            onClick={() => setHidden(true)}
            className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-(--on-sidebar-muted,#9ca3af) hover:bg-white/10 hover:text-white transition"
          >
            <FaAnglesLeft size={13} />
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {LINKS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all border-l-2 whitespace-nowrap ${
                  active ? "bg-(--sidebar-active,#1e293b) text-white border-[#8FC6FF]" : "text-(--on-sidebar-muted,#9ca3af) hover:bg-white/5 hover:text-white border-transparent"
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 px-2 border-t border-white/10 font-mono text-[11px] text-(--on-sidebar-muted,#9ca3af) leading-relaxed whitespace-nowrap">
          Building 2 — Cleanroom Suite
          <br />
          ISO 14644-1 monitored
        </div>
      </aside>

      {/* Desktop top nav bar — appears only when sidebar is hidden */}
      {hidden && (
        <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 items-center justify-between px-4 py-3 bg-(--sidebar,#0f172a)">
          <div className="flex items-center gap-3">
            <button
              aria-label="Show sidebar"
              onClick={() => setHidden(false)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-text,white) hover:bg-white/10 transition"
            >
              <FaAnglesRight size={15} />
            </button>
            <Logo />
          </div>

          <nav className="flex items-center gap-1">
            {LINKS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                    active ? "bg-(--sidebar-active,#1e293b) text-white" : "text-(--on-sidebar-muted,#9ca3af) hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <item.icon size={15} />
                </Link>
              );
            })}
          </nav>

          <button aria-label="Notifications" className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-muted,#9ca3af) hover:bg-white/10 transition">
            <FaBell size={14} />
          </button>
        </header>
      )}
    </>
  );
}
