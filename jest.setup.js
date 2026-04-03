// Jest setup for Aura frontend tests

// Mock localStorage
const store = {};
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  },
  writable: true,
});

// Mock navigator.onLine
Object.defineProperty(global, 'navigator', {
  value: { onLine: true, userAgent: 'jest' },
  writable: true,
});

// Mock window events
if (typeof window !== 'undefined') {
  window.addEventListener = window.addEventListener || (() => {});
  window.removeEventListener = window.removeEventListener || (() => {});
}

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ['(tabs)'],
  useLocalSearchParams: () => ({}),
  Slot: ({ children }) => children,
  Link: ({ children }) => children,
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}), { virtual: true });
