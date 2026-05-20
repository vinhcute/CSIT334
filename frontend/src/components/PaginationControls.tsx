interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  loading?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  label: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  loading = false,
  onPrevious,
  onNext,
  label,
}: PaginationControlsProps) {
  const canGoPrevious = !loading && currentPage > 1;
  const canGoNext = !loading && currentPage < totalPages;

  return (
    <div className="inventory-pagination" aria-label={label}>
      <button
        className="secondary-button compact-button"
        disabled={!canGoPrevious}
        onClick={onPrevious}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="secondary-button compact-button"
        disabled={!canGoNext}
        onClick={onNext}
        type="button"
      >
        Next
      </button>
    </div>
  );
}
