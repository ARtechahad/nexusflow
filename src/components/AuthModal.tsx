import React from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RoleLoginView } from './RoleLoginView';

export const AuthModal: React.FC = () => {
  const { isAuthModalOpen, setIsAuthModalOpen } = useApp();

  if (!isAuthModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={() => setIsAuthModalOpen(false)}
    >
      <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(false)}
          className="btn-tactile-secondary absolute top-3 right-3 z-10 p-1.5 rounded-lg cursor-pointer"
          aria-label="Close Authentication Modal"
        >
          <X className="w-4 h-4" />
        </button>

        <RoleLoginView
          initialMode="signin"
          onSuccess={() => setIsAuthModalOpen(false)}
        />
      </div>
    </div>
  );
};
