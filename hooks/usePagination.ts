import { useState, useMemo, useEffect } from "react";

export function usePagination<T>(items: T[], pageSize = 20, resetKey?: string | number) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the reset key changes (e.g. search/filter changes)
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  function goTo(p: number) {
    setPage(Math.max(1, Math.min(totalPages, p)));
  }

  return { paginated, page: safePage, totalPages, total: items.length, goTo };
}
