import { View, Text, ScrollView, Pressable, StyleSheet, Platform } from "react-native";
import { useState, ReactNode } from "react";
import { Colors } from "@/constants/colors";

// ============================================================
// VerticalShell — Standardized container for all verticals
// Context bar + Tabs + KPIs + Content + FlowBar
// ============================================================

export interface VerticalConfig {
  name: string;
  icon: string;
  accent: string;
  establishment: string;
  professional: string;
}

export interface KPI {
  value: string | number;
  label: string;
  color?: string;
}

export interface FlowStep {
  label: string;
  active?: boolean;
}

interface Props {
  config: VerticalConfig;
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  kpis: KPI[];
  flowSteps?: FlowStep[];
  flowTitle?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function VerticalShell({ config, tabs, activeTab, onTabChange, kpis, flowSteps, flowTitle, children, actionLabel, onAction }: Props) {
  return (
    <View style={s.container}>
      {/* Context Bar */}
      <View style={[s.ctxBar, { backgroundColor: config.accent + '12', borderColor: config.accent + '33' }]}>
        <View style={[s.ctxDot, { backgroundColor: config.accent }]} />
        <Text style={[s.ctxName, { color: config.accent }]}>{config.icon} {config.name} — {config.establishment}</Text>
        <Text style={s.ctxPro}>{config.professional}</Text>
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
        {tabs.map(tab => (
          <Pressable key={tab} onPress={() => onTabChange(tab)} style={[s.tab, activeTab === tab && { borderBottomColor: config.accent }]}>
            <Text style={[s.tabText, activeTab === tab && { color: config.accent, fontWeight: '500' }]}>{tab}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* KPI Row */}
      <View style={s.kpiRow}>
        {kpis.map((kpi, i) => (
          <View key={i} style={s.kpiCard}>
            <Text style={[s.kpiValue, { color: kpi.color || config.accent }]}>{kpi.value}</Text>
            <Text style={s.kpiLabel}>{kpi.label}</Text>
          </View>
        ))}
      </View>

      {/* Content Area */}
      <View style={s.contentCard}>
        {(actionLabel || onAction) && (
          <View style={s.contentHeader}>
            <Text style={s.contentTitle}>{activeTab}</Text>
            {actionLabel && onAction && (
              <Pressable onPress={onAction} style={[s.actionBtn, { backgroundColor: config.accent }]}>
                <Text style={s.actionBtnText}>{actionLabel}</Text>
              </Pressable>
            )}
          </View>
        )}
        {children}
      </View>

      {/* Flow Bar */}
      {flowSteps && flowSteps.length > 0 && (
        <View style={s.flowBar}>
          {flowTitle && <Text style={s.flowTitle}>{flowTitle}</Text>}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.flowSteps}>
            {flowSteps.map((step, i) => (
              <View key={i} style={s.flowStepRow}>
                <View style={[s.flowPill, { backgroundColor: step.active ? config.accent : config.accent + '18' }]}>
                  <Text style={[s.flowPillText, { color: step.active ? '#fff' : config.accent }]}>{step.label}</Text>
                </View>
                {i < flowSteps.length - 1 && <Text style={[s.flowArrow, { color: config.accent + '60' }]}>\u2192</Text>}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ============================================================
// VerticalRow — Standardized list row for all verticals
// ============================================================

export interface RowData {
  avatar: string;
  avatarColor: string;
  name: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  rightText?: string;
  rightColor?: string;
}

export function VerticalRow({ avatar, avatarColor, name, subtitle, badge, badgeColor, rightText, rightColor, onPress }: RowData & { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={[s.rowAvatar, { backgroundColor: avatarColor }]}>
        <Text style={s.rowAvatarText}>{avatar}</Text>
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowName}>{name}</Text>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      {rightText && <Text style={[s.rowRight, rightColor ? { color: rightColor } : {}]}>{rightText}</Text>}
      {badge && (
        <View style={[s.rowBadge, { backgroundColor: (badgeColor || '#9CA3AF') + '18' }]}>
          <Text style={[s.rowBadgeText, { color: badgeColor || '#9CA3AF' }]}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================================
// VerticalEmpty — Themed empty state
// ============================================================

export function VerticalEmpty({ icon, title, subtitle, accent, actionLabel, onAction }: { icon: string; title: string; subtitle: string; accent: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={s.emptyContainer}>
      <Text style={s.emptyIcon}>{icon}</Text>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} style={[s.emptyBtn, { borderColor: accent }]}>
          <Text style={[s.emptyBtnText, { color: accent }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const IS_WIDE = Platform.OS === 'web';

const s = StyleSheet.create({
  container: { gap: 12 },
  // Context bar
  ctxBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 0.5 },
  ctxDot: { width: 8, height: 8, borderRadius: 4 },
  ctxName: { fontSize: 13, fontWeight: '600', flex: 1 },
  ctxPro: { fontSize: 11, color: Colors.ink3 || '#888' },
  // Tabs
  tabsRow: { gap: 2, paddingBottom: 2, borderBottomWidth: 0.5, borderBottomColor: Colors.border || '#333' },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 12, color: Colors.ink3 || '#888' },
  // KPIs
  kpiRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kpiCard: { flex: 1, minWidth: IS_WIDE ? 100 : '22%', backgroundColor: Colors.bg2 || '#1a1a2e', borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 },
  kpiValue: { fontSize: 20, fontWeight: '700' },
  kpiLabel: { fontSize: 8, color: Colors.ink3 || '#888', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  // Content
  contentCard: { backgroundColor: Colors.bg2 || '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 0.5, borderColor: Colors.border || '#333', minHeight: 120 },
  contentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  contentTitle: { fontSize: 15, fontWeight: '700', color: Colors.ink || '#fff' },
  actionBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // Flow
  flowBar: { padding: 12, backgroundColor: Colors.bg2 || '#1a1a2e', borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border || '#333', gap: 8 },
  flowTitle: { fontSize: 11, fontWeight: '600', color: Colors.ink3 || '#888' },
  flowSteps: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flowStepRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  flowPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  flowPillText: { fontSize: 10, fontWeight: '600' },
  flowArrow: { fontSize: 10 },
  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border || '#222' },
  rowAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: 13, fontWeight: '600', color: Colors.ink || '#fff' },
  rowSub: { fontSize: 10, color: Colors.ink3 || '#888' },
  rowRight: { fontSize: 13, fontWeight: '600', color: Colors.ink || '#fff' },
  rowBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  rowBadgeText: { fontSize: 9, fontWeight: '600' },
  // Empty
  emptyContainer: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.ink || '#fff' },
  emptySubtitle: { fontSize: 12, color: Colors.ink3 || '#888', textAlign: 'center', maxWidth: 260 },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, marginTop: 8 },
  emptyBtnText: { fontSize: 12, fontWeight: '600' },
});

export default VerticalShell;
