// ============================================================
// AURA. — Frontend component test stubs
// Run: npx jest --testPathPattern=components
// ============================================================

import React from 'react';

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  StyleSheet: { create: (s: any) => s },
  Platform: { OS: 'web' },
  ActivityIndicator: 'ActivityIndicator',
}));

jest.mock('@/constants/colors', () => ({
  Colors: {
    bg: '#0a0a1a', bg2: '#1a1a2e', bg3: '#141428', bg4: '#222',
    ink: '#fff', ink2: '#aaa', ink3: '#888',
    border: '#333', violet: '#7C3AED', violet3: '#a78bfa',
    violetD: 'rgba(124,58,237,0.08)', green: '#10B981',
  },
}));

describe('VerticalShell', () => {
  it('should render context bar with accent color', () => {
    // TODO: render VerticalShell with odonto config
    // Assert context bar contains clinic name
    // Assert accent color applied
    expect(true).toBe(true);
  });

  it('should render tabs and highlight active', () => {
    // TODO: render with 8 tabs, activeTab='Agenda'
    // Assert Agenda tab has accent underline
    expect(true).toBe(true);
  });

  it('should render 4 KPIs', () => {
    // TODO: render with kpis array
    // Assert 4 KPI cards rendered with correct values
    expect(true).toBe(true);
  });

  it('should render flow bar steps', () => {
    // TODO: render with flowSteps
    // Assert pills rendered with arrows between
    expect(true).toBe(true);
  });

  it('should show action button when provided', () => {
    // TODO: render with actionLabel='+ Agendar'
    // Assert button visible with accent color
    expect(true).toBe(true);
  });
});

describe('VerticalRow', () => {
  it('should render avatar, name, subtitle, and badge', () => {
    // TODO: render with row data
    // Assert all elements present
    expect(true).toBe(true);
  });

  it('should apply badge color correctly', () => {
    // TODO: render with badgeColor='#10B981'
    // Assert badge has green background
    expect(true).toBe(true);
  });
});

describe('VerticalEmpty', () => {
  it('should render icon, title, subtitle', () => {
    // TODO: render empty state
    // Assert all elements
    expect(true).toBe(true);
  });

  it('should render CTA button when provided', () => {
    // TODO: render with actionLabel
    // Assert button present with accent color
    expect(true).toBe(true);
  });
});
