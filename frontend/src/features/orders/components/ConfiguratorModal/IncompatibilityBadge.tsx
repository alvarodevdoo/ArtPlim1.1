/**
 * IncompatibilityBadge
 *
 * Responsabilidade única: exibir tooltip/badge de motivo de bloqueio.
 * Componente puro — recebe o motivo como prop.
 */

import React, { useState } from 'react';

interface IncompatibilityBadgeProps {
  reason: string;
}

export const IncompatibilityBadge: React.FC<IncompatibilityBadgeProps> = ({ reason }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="incompatibility-badge-wrapper">
      <button
        type="button"
        className="incompatibility-badge-trigger"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label={`Incompatível: ${reason}`}
      >
        🚫
      </button>
      {visible && (
        <div className="incompatibility-tooltip" role="tooltip">
          {reason}
        </div>
      )}
    </div>
  );
};
