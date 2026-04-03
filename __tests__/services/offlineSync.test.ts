import {
  cacheProducts,
  getCachedProducts,
  addToQueue,
  getQueueLength,
  clearQueue,
} from "../../services/offlineSync";

beforeEach(() => {
  localStorage.clear();
});

describe("offlineSync", () => {
  describe("cacheProducts", () => {
    it("should cache products in localStorage", () => {
      const products = [
        { id: "1", name: "Produto A", price: 10 },
        { id: "2", name: "Produto B", price: 20 },
      ];
      cacheProducts(products);
      const cached = getCachedProducts();
      expect(cached).toHaveLength(2);
      expect(cached[0].name).toBe("Produto A");
    });

    it("should return empty array if no cache", () => {
      expect(getCachedProducts()).toEqual([]);
    });

    it("should not cache empty arrays", () => {
      cacheProducts([]);
      expect(getCachedProducts()).toEqual([]);
    });
  });

  describe("queue operations", () => {
    it("should add items to queue", () => {
      const count = addToQueue({
        type: "sale",
        endpoint: "/companies/123/sales",
        method: "POST",
        body: { items: [], total: 50 },
      });
      expect(count).toBe(1);
      expect(getQueueLength()).toBe(1);
    });

    it("should increment queue length", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      addToQueue({ type: "transaction", endpoint: "/z", method: "POST", body: {} });
      expect(getQueueLength()).toBe(3);
    });

    it("should clear queue", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      clearQueue();
      expect(getQueueLength()).toBe(0);
    });

    it("should generate unique IDs", () => {
      addToQueue({ type: "sale", endpoint: "/x", method: "POST", body: {} });
      addToQueue({ type: "sale", endpoint: "/y", method: "POST", body: {} });
      const raw = JSON.parse(localStorage.getItem("aura_offline_queue") || "[]");
      expect(raw[0].id).not.toBe(raw[1].id);
    });
  });
});
