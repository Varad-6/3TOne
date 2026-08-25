import { useState, useMemo } from "react";

export function usePagination({ totalItems, itemsPerPage, initialPage = 1 }) {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const goToPage = (page) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  const goToNextPage = () => {
    goToPage(currentPage + 1);
  };

  const goToPreviousPage = () => {
    goToPage(currentPage - 1);
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

  const paginatedRange = useMemo(() => {
    return {
      start: startIndex + 1,
      end: endIndex,
      total: totalItems,
    };
  }, [startIndex, endIndex, totalItems]);

  return {
    currentPage,
    totalPages,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    startIndex,
    endIndex,
    paginatedRange,
    canGoNext: currentPage < totalPages,
    canGoPrevious: currentPage > 1,
  };
}
