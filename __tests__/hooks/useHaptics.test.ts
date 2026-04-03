import { haptic, hapticLight, hapticSuccess, withHaptic } from "../../hooks/useHaptics";

describe("useHaptics", () => {
  it("should not throw on web (no-op)", () => {
    expect(() => haptic("light")).not.toThrow();
    expect(() => hapticLight()).not.toThrow();
    expect(() => hapticSuccess()).not.toThrow();
  });

  it("withHaptic should wrap a function", () => {
    const fn = jest.fn(() => 42);
    const wrapped = withHaptic(fn, "light");
    const result = wrapped("arg1", "arg2");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    expect(result).toBe(42);
  });
});
