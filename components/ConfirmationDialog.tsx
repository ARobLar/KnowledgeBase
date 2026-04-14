"use client";

interface ConfirmationDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  message,
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-surface-3 rounded-2xl p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-text mb-2">Confirm operation</h3>
        <p className="text-sm text-text-muted mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading && (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
