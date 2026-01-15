import React, { useState, useCallback } from 'react';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

const initialState: ToastState = {
  toasts: [],
};

let toastState = initialState;
let listeners: Array<(state: ToastState) => void> = [];

function dispatch(action: { type: string; payload?: any }) {
  switch (action.type) {
    case 'ADD_TOAST':
      toastState = {
        ...toastState,
        toasts: [...toastState.toasts, action.payload],
      };
      break;
    case 'REMOVE_TOAST':
      toastState = {
        ...toastState,
        toasts: toastState.toasts.filter((toast) => toast.id !== action.payload),
      };
      break;
    case 'DISMISS_TOAST':
      toastState = {
        ...toastState,
        toasts: toastState.toasts.filter((toast) => toast.id !== action.payload),
      };
      break;
  }

  listeners.forEach((listener) => listener(toastState));
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function toast({
  title,
  description,
  variant = 'default',
  duration = 5000,
  ...props
}: Omit<Toast, 'id'>) {
  const id = generateId();

  const newToast: Toast = {
    id,
    title,
    description,
    variant,
    duration,
    ...props,
  };

  dispatch({ type: 'ADD_TOAST', payload: newToast });

  // Auto dismiss after duration
  if (duration > 0) {
    setTimeout(() => {
      dispatch({ type: 'DISMISS_TOAST', payload: id });
    }, duration);
  }

  return {
    id,
    dismiss: () => dispatch({ type: 'DISMISS_TOAST', payload: id }),
    update: (updates: Partial<Toast>) => {
      dispatch({
        type: 'ADD_TOAST',
        payload: { ...newToast, ...updates },
      });
    },
  };
}

export function useToast() {
  const [state, setState] = useState<ToastState>(toastState);

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribe(setState);
    return unsubscribe;
  }, [subscribe]);

  return {
    ...state,
    toast,
    dismiss: (toastId: string) =>
      dispatch({ type: 'DISMISS_TOAST', payload: toastId }),
  };
}