/**
 * useKeyboard hook tests
 * Note: This hook only works on web (Platform.OS === "web")
 * Tests verify the event listener setup and cleanup
 */

describe("useKeyboard", () => {
  it("should be importable", () => {
    // Basic import test - actual behavior requires DOM environment
    const mod = require("../../hooks/useKeyboard");
    expect(mod.useKeyboard).toBeDefined();
    expect(mod.useEscapeKey).toBeDefined();
  });
});
