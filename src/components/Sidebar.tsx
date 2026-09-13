"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FaHouse,
  FaChartLine,
  FaDroplet,
  FaGaugeHigh,
  FaChartArea,
  FaDatabase,
  FaClockRotateLeft,
  FaTableList,
  FaBars,
  FaXmark,
  FaBell,
} from "react-icons/fa6";

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
      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-(--on-sidebar-text)">
        <FaGaugeHigh size={16} />
      </div>
      <div className="leading-tight">
        <div className="text-[13px] font-bold text-(--on-sidebar-text)">Environmental EMS</div>
        <div className="text-[11px] font-mono-data text-(--on-sidebar-muted)">Flexicare Lanka</div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-(--sidebar)">
        <Logo />
        <div className="flex items-center gap-2">
          <button
            aria-label="Notifications"
            className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-muted) hover:bg-white/10 transition"
          >
            <FaBell size={14} />
          </button>
          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-(--on-sidebar-text) hover:bg-white/10 transition"
          >
            <FaBars size={16} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-(--sidebar) z-50 transform transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <Logo />
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:bg-white/10"
          >
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
                  active
                    ? "bg-(--sidebar-active) text-white border-[#8FC6FF]"
                    : "text-(--on-sidebar-muted) hover:bg-white/5 hover:text-white border-transparent"
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:shrink-0 bg-(--sidebar) px-4 py-6">
        <div className="px-2 mb-8">
          <Logo />
        </div>

        <nav className="flex flex-col gap-1">
          {LINKS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all border-l-2 ${
                  active
                    ? "bg-(--sidebar-active) text-white border-[#8FC6FF]"
                    : "text-(--on-sidebar-muted) hover:bg-white/5 hover:text-white border-transparent"
                }`}
              >
                <item.icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 px-2 border-t border-white/10 font-mono-data text-[11px] text-(--on-sidebar-muted) leading-relaxed">
          Building 2 — Cleanroom Suite
          <br />
          ISO 14644-1 monitored
        </div>
      </aside>
    </>
  );
}
