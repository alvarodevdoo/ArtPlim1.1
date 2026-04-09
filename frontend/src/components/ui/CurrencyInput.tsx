import React from 'react';
import CurrencyInputPrimitive from 'react-currency-input-field';

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
    placeholder = "0,00",
    disabled = false,
    className = ""
}) => {
    // Mantém o estado como string internamente para que o usuário consiga digitar a vírgula livremente.
    // O valor do 'value' que vem de fora é number e "engole" as vírgulas puras se forçarmos via props.
    const [localValue, setLocalValue] = React.useState<string | number | undefined>(value);
    const lastReportedFloat = React.useRef<number | undefined>(value);

    // Quando o valor PAI mudar DE FATO (ex: via motor de cálculo), atualizamos o estado local
    React.useEffect(() => {
        if (value !== lastReportedFloat.current) {
            setLocalValue(value);
            lastReportedFloat.current = value;
        }
    }, [value]);

    return (
        <CurrencyInputPrimitive
            id="currency-input"
            name="currency-input"
            placeholder={placeholder}
            intlConfig={{ locale: 'pt-BR', currency: 'BRL' }}
            decimalsLimit={2}
            decimalScale={2}
            disableAbbreviations={true}
            allowNegativeValue={false}
            value={localValue}
            onValueChange={(val, _name, values) => {
                setLocalValue(val);
                const newFloat = values?.float !== undefined && values?.float !== null ? values.float : undefined;
                if (newFloat !== lastReportedFloat.current) {
                    lastReportedFloat.current = newFloat;
                    onValueChange?.(newFloat);
                }
            }}
            onBlur={(e) => {
                // Impede que o componente perca zeros ou formate errado ao sair se o valor for válido
                if (!e.target.value) {
                    setLocalValue(0);
                    lastReportedFloat.current = 0;
                    onValueChange?.(0);
                }
            }}
            onKeyDown={(e) => {
                // Transforma automaticamente o ponto do teclado numérico em vírgula decimal
                if (e.key === '.') {
                    e.preventDefault();
                    document.execCommand('insertText', false, ',');
                }
            }}
            disabled={disabled}
            className={`w-full h-10 px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        />
    );
};

export default CurrencyInput;
