/**
 * Toast component for displaying transient error/success messages.
 */

'use client';

import React, { useState, useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContainerProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

/**
 * Individual toast message component.
 */
function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (message.duration) {
      const timer = setTimeout(onDismiss, message.duration);
      return () => clearTimeout(timer);
    }
  }, [message.duration, onDismiss]);

  const colors = {
    error: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  };

  const icons = {
    error: '❌',
    success: '✅',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div className={`border rounded-lg p-4 ${colors[message.type]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-lg flex-shrink-0">{icons[message.type]}</span>
          <div className="flex-1">
            {message.title && (
              <h3 className="font-semibold mb-1">{message.title}</h3>
            )}
            <p className="text-sm">{message.message}</p>
            {message.action && (
              <button
                onClick={message.action.onClick}
                className="text-sm font-medium underline hover:no-underline mt-2"
              >
                {message.action.label}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-lg hover:opacity-70"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Toast container component - renders all active toasts.
 */
export function ToastContainer({
  messages,
  onDismiss,
}: ToastContainerProps) {
  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {messages.map(msg => (
        <Toast
          key={msg.id}
          message={msg}
          onDismiss={() => onDismiss(msg.id)}
        />
      ))}
    </div>
  );
}

/**
 * Hook to manage toast messages.
 */
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const show = (config: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const duration = config.duration ?? 5000;

    setMessages(prev => [...prev, { ...config, id, duration }]);

    return id;
  };

  const dismiss = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
  };

  const error = (message: string, title?: string) =>
    show({ type: 'error', message, title, duration: 6000 });

  const success = (message: string, title?: string) =>
    show({ type: 'success', message, title, duration: 3000 });

  const info = (message: string, title?: string) =>
    show({ type: 'info', message, title, duration: 4000 });

  const warning = (message: string, title?: string) =>
    show({ type: 'warning', message, title, duration: 5000 });

  return {
    messages,
    show,
    dismiss,
    error,
    success,
    info,
    warning,
  };
}
