/**
 * DashboardShell - the app-shell chrome for the results dashboard.
 *
 * Dark teal sidebar nav (logo + tabs with badges + "New report") on the left,
 * a light content area with a header bar on the right. Collapses to a horizontal
 * top tab-strip on narrow screens. Pure presentational - the active tab's content
 * is passed as children.
 */

import React, { useEffect, useState } from 'react';
import { colors, gradients, borderRadius, spacing, typography, shadows } from '@/lib/theme';
import { Activity, FilePlus2, type LucideIcon } from 'lucide-react';

export interface DashTab {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | string | null;
  badgeTone?: 'neutral' | 'warn' | 'danger';
}

interface Props {
  tabs: DashTab[];
  activeTab: string;
  onTab: (id: string) => void;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  onNewReport: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** Tracks a media query (client-only); false on the server to avoid hydration drift. */
function useMatches(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function badgeColors(tone: DashTab['badgeTone']) {
  if (tone === 'danger') return { bg: colors.error[500], fg: colors.white };
  if (tone === 'warn') return { bg: colors.warning[500], fg: colors.white };
  return { bg: 'rgba(255,255,255,0.18)', fg: colors.white };
}

export function DashboardShell({ tabs, activeTab, onTab, title, subtitle, headerRight, onNewReport, footer, children }: Props) {
  const narrow = useMatches('(max-width: 880px)');

  const Logo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: borderRadius.md, background: 'rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Activity size={19} color={colors.white} />
      </div>
      <div>
        <div style={{ fontFamily: typography.fontFamilySerif, fontWeight: 800, fontSize: 18, color: colors.white, lineHeight: 1 }}>Clarion</div>
        <div style={{ fontSize: 10, letterSpacing: 1.5, color: 'rgba(255,255,255,0.55)', fontWeight: 700, textTransform: 'uppercase' }}>Lab Intelligence</div>
      </div>
    </div>
  );

  const NavItem = ({ tab }: { tab: DashTab }) => {
    const active = tab.id === activeTab;
    const Icon = tab.icon;
    const bc = badgeColors(tab.badgeTone);
    return (
      <button
        onClick={() => onTab(tab.id)}
        aria-current={active ? 'page' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, width: narrow ? 'auto' : '100%',
          padding: narrow ? '9px 13px' : '10px 13px', borderRadius: borderRadius.md, border: 'none',
          background: active ? colors.white : 'transparent',
          color: active ? colors.accent.secondary : 'rgba(255,255,255,0.82)',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
          boxShadow: active ? shadows.sm : 'none', transition: 'background 0.15s',
        }}
      >
        <Icon size={17} aria-hidden="true" />
        <span>{tab.label}</span>
        {tab.badge != null && tab.badge !== 0 && tab.badge !== '' && (
          <span style={{ marginLeft: 'auto', background: active ? colors.accent.primary + '1f' : bc.bg, color: active ? colors.accent.secondary : bc.fg, fontSize: 11, fontWeight: 700, borderRadius: borderRadius.full, padding: '1px 7px', minWidth: 18, textAlign: 'center' }}>
            {tab.badge}
          </span>
        )}
      </button>
    );
  };

  const NewReportBtn = (
    <button
      onClick={onNewReport}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: narrow ? 'auto' : '100%', padding: '10px 14px', borderRadius: borderRadius.md,
        border: '1px solid rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.08)',
        color: colors.white, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      <FilePlus2 size={16} aria-hidden="true" /> New report
    </button>
  );

  // ── Narrow: top strip ──────────────────────────────────────────────────────
  if (narrow) {
    return (
      <div style={{ background: colors.gray[50], borderRadius: borderRadius.xl, border: `1px solid ${colors.primary[200]}` }}>
        {/* Sticky nav so tabs stay reachable while scrolling; wraps so all are visible. */}
        <div data-testid="dash-nav" style={{ position: 'sticky', top: 0, zIndex: 30, background: gradients.primary, padding: spacing.md, borderRadius: `${borderRadius.xl} ${borderRadius.xl} 0 0`, boxShadow: shadows.md }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {Logo}
            {NewReportBtn}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tabs.map((t) => <NavItem key={t.id} tab={t} />)}
          </div>
        </div>
        <div style={{ padding: spacing.lg }}>
          <DashHeader title={title} subtitle={subtitle} headerRight={headerRight} />
          {children}
          {footer}
        </div>
      </div>
    );
  }

  // ── Wide: sidebar (sticky so the tabs stay reachable while content scrolls) ──
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', background: colors.gray[50], borderRadius: borderRadius.xl, border: `1px solid ${colors.primary[200]}`, boxShadow: shadows.lg, minHeight: 600 }}>
      <aside style={{ width: 232, flexShrink: 0, background: gradients.primary, padding: spacing.lg, display: 'flex', flexDirection: 'column', gap: spacing.lg, position: 'sticky', top: 12, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto', borderRadius: `${borderRadius.xl} 0 0 ${borderRadius.xl}` }}>
        {Logo}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {tabs.map((t) => <NavItem key={t.id} tab={t} />)}
        </nav>
        <div style={{ marginTop: 'auto' }}>{NewReportBtn}</div>
      </aside>
      <main style={{ flex: 1, minWidth: 0, padding: spacing.xl }}>
        <DashHeader title={title} subtitle={subtitle} headerRight={headerRight} />
        {children}
        {footer}
      </main>
    </div>
  );
}

function DashHeader({ title, subtitle, headerRight }: { title: string; subtitle?: string; headerRight?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap', marginBottom: spacing.xl, paddingBottom: spacing.md, borderBottom: `1px solid ${colors.primary[200]}` }}>
      <div>
        <h1 style={{ fontFamily: typography.fontFamilySerif, fontSize: 26, fontWeight: 800, color: colors.primary[700], margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13.5, color: colors.primary[500], margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {headerRight && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>{headerRight}</div>}
    </div>
  );
}
