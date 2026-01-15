import React from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

// Variantes de animação comuns
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
};

export const fadeInDown: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 }
};

export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 }
};

export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 }
};

export const slideInFromBottom: Variants = {
  initial: { opacity: 0, y: '100%' },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: '100%' }
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 }
};

// Componentes de animação reutilizáveis
interface AnimatedContainerProps {
  children: React.ReactNode;
  variant?: Variants;
  className?: string;
  delay?: number;
  duration?: number;
}

export const AnimatedContainer: React.FC<AnimatedContainerProps> = ({
  children,
  variant = fadeInUp,
  className = '',
  delay = 0,
  duration = 0.3
}) => (
  <motion.div
    variants={variant}
    initial="initial"
    animate="animate"
    exit="exit"
    transition={{ duration, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

// Lista animada com stagger
interface AnimatedListProps {
  children: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
}

export const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  className = '',
  itemClassName = '',
  staggerDelay = 0.1
}) => (
  <motion.div
    variants={staggerContainer}
    initial="initial"
    animate="animate"
    className={className}
  >
    {children.map((child, index) => (
      <motion.div
        key={index}
        variants={staggerItem}
        transition={{ delay: index * staggerDelay }}
        className={itemClassName}
      >
        {child}
      </motion.div>
    ))}
  </motion.div>
);

// Modal animado
interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  className = ''
}) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
        />
        
        {/* Modal */}
        <motion.div
          variants={scaleIn}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${className}`}
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto">
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// Botão com animação de loading
interface AnimatedButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  loading = false,
  onClick,
  className = '',
  disabled = false,
  variant = 'primary'
}) => {
  const baseClasses = 'px-4 py-2 rounded-lg font-medium transition-all duration-200 relative overflow-hidden';
  const variantClasses = {
    primary: 'bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300',
    secondary: 'bg-gray-500 text-white hover:bg-gray-600 disabled:bg-gray-300',
    outline: 'border border-blue-500 text-blue-500 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-300'
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            />
            <span className="ml-2">Carregando...</span>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// Card animado
interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  hover = true,
  delay = 0
}) => (
  <motion.div
    variants={fadeInUp}
    initial="initial"
    animate="animate"
    transition={{ delay }}
    whileHover={hover ? { y: -4, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" } : undefined}
    className={`bg-white rounded-lg shadow-md p-6 ${className}`}
  >
    {children}
  </motion.div>
);

// Notificação animada
interface AnimatedNotificationProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  isVisible: boolean;
  onClose: () => void;
}

export const AnimatedNotification: React.FC<AnimatedNotificationProps> = ({
  message,
  type = 'info',
  isVisible,
  onClose
}) => {
  const typeClasses = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-black',
    info: 'bg-blue-500 text-white'
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${typeClasses[type]} max-w-sm`}
        >
          <div className="flex items-center justify-between">
            <span>{message}</span>
            <button
              onClick={onClose}
              className="ml-4 text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Progress bar animado
interface AnimatedProgressProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  progress,
  className = '',
  showPercentage = true
}) => (
  <div className={`w-full ${className}`}>
    <div className="flex justify-between items-center mb-2">
      <span className="text-sm text-gray-600">Progresso</span>
      {showPercentage && (
        <span className="text-sm font-medium">{Math.round(progress)}%</span>
      )}
    </div>
    <div className="w-full bg-gray-200 rounded-full h-2">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-blue-500 h-2 rounded-full"
      />
    </div>
  </div>
);

// Skeleton animado
export const AnimatedSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <motion.div
    animate={{ opacity: [0.5, 1, 0.5] }}
    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
    className={`bg-gray-200 rounded ${className}`}
  />
);

// Contador animado
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1,
  className = '',
  prefix = '',
  suffix = ''
}) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const difference = value - startValue;

    const updateValue = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      
      setDisplayValue(Math.round(startValue + difference * easeOutQuart));

      if (progress < 1) {
        requestAnimationFrame(updateValue);
      }
    };

    requestAnimationFrame(updateValue);
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};