// Jest setup — Aura frontend

// Mock localStorage
const store = {};
const localStorageMock = {
  getItem: (key) => (key in store ? store[key] : null),
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};
global.localStorage = localStorageMock;

// Mock window.addEventListener for web hooks
global.addEventListener = global.addEventListener || jest.fn();
global.removeEventListener = global.removeEventListener || jest.fn();

// Mock expo modules
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ['(tabs)'],
  Slot: 'Slot',
  Link: 'Link',
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Heavy: 2 },
  NotificationFeedbackType: { Success: 0, Warning: 1, Error: 2 },
}), { virtual: true });

jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
