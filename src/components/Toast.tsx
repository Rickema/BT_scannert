import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none max-w-[90vw]">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = toast.duration || 3500;
    const hideTimer = setTimeout(() => {
      setVisible(false);
    }, duration - 300);

    const removeTimer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [toast, onDismiss]);

  return (
    <div
      className={`bg-[#323232] text-white text-xs font-normal px-4 py-2.5 rounded-full shadow-lg pointer-events-auto transition-opacity duration-300 text-center whitespace-pre-line max-w-md ${
        visible ? "opacity-95 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {toast.text}
    </div>
  );
};
