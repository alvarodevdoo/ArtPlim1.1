import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalPortalProps {
  children: React.ReactNode;
  className?: string;
  onBackdropClick?: () => void;
}

/**
 * Renderiza o overlay do modal diretamente em document.body via portal,
 * escapando qualquer containing block / stacking context criado por
 * ancestrais (transform, filter, backdrop-filter, contain, etc.).
 *
 * Mantém a classe `.modal-overlay` (definida em index.css) para preservar
 * o estilo já existente em todo o app.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({
  children,
  className,
  onBackdropClick,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onBackdropClick && e.target === e.currentTarget) {
      onBackdropClick();
    }
  };

  return createPortal(
    <div className={cn('modal-overlay', className)} onClick={handleClick}>
      {children}
    </div>,
    document.body
  );
};

export default ModalPortal;
