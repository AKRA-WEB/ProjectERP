import { useState, useRef, useCallback } from 'react';

export interface OverridePinRequest {
  action: string;
  resolve: (value: { token: string; reasonCode: string }) => void;
  reject: (reason: Error) => void;
}

export function useOverridePin() {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState('');
  const activeRequestRef = useRef<OverridePinRequest | null>(null);

  const requestPin = useCallback((actionToRequest: string) => {
    setAction(actionToRequest);
    setIsOpen(true);
    return new Promise<{ token: string; reasonCode: string }>((resolve, reject) => {
      activeRequestRef.current = {
        action: actionToRequest,
        resolve,
        reject,
      };
    });
  }, []);

  const handleSuccess = useCallback((token: string, reasonCode: string) => {
    if (activeRequestRef.current) {
      activeRequestRef.current.resolve({ token, reasonCode });
    }
    setIsOpen(false);
    setAction('');
    activeRequestRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    if (activeRequestRef.current) {
      activeRequestRef.current.reject(new Error('PIN authorization cancelled'));
    }
    setIsOpen(false);
    setAction('');
    activeRequestRef.current = null;
  }, []);

  return {
    requestPin,
    isOpen,
    action,
    handleSuccess,
    handleClose,
  };
}
