import React from 'react';

interface CurrencyInputProps {
    value?: number;
    onValueChange?: (value: number | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const CurrencyInput: React.FC<CurrencyInputProps> = ({
    value,
    onValueChange,
    placeholder = "0.00",
    disabled = false,
    className = ""
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // Converte para número ou undefined se vazio
        const numericValue = inputValue === '' ? undefined : parseFloat(inputValue);

        onValueChange?.(isNaN(numericValue || 0) ? undefined : numericValue);
    };

    return (
        <input
            type="number"
            step="0.01"
            value={value || ''}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        />
    );
};

export default CurrencyInput;