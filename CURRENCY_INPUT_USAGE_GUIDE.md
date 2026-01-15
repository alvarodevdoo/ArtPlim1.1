# Guia de Uso do CurrencyInput

## Como Usar o Campo de Moeda

O componente `CurrencyInput` foi configurado para aceitar entrada de decimais de várias formas:

### Formas de Digitar Valores

#### 1. **Digitação Direta de Centavos**
- Digite: `1234` → Resultado: `R$ 12,34`
- Digite: `50` → Resultado: `R$ 0,50`
- Digite: `100` → Resultado: `R$ 1,00`

#### 2. **Usando Vírgula para Decimais**
- Digite: `12,50` → Resultado: `R$ 12,50`
- Digite: `1,99` → Resultado: `R$ 1,99`
- Digite: `100,00` → Resultado: `R$ 100,00`

#### 3. **Usando Ponto para Decimais (será convertido)**
- Digite: `12.50` → Resultado: `R$ 12,50`
- Digite: `1.99` → Resultado: `R$ 1,99`

#### 4. **Valores Grandes com Separadores**
- Digite: `1234,56` → Resultado: `R$ 1.234,56`
- Digite: `12345,67` → Resultado: `R$ 12.345,67`

## Configuração Atual

```typescript
<CurrencyInputField
    prefix="R$ "
    decimalSeparator=","      // Vírgula para decimais
    groupSeparator="."        // Ponto para milhares
    allowDecimals={true}      // Permite decimais
    decimalsLimit={2}         // Máximo 2 casas decimais
    allowNegativeValue={false} // Não permite valores negativos
    disableGroupSeparators={false} // Permite separadores de milhares
/>
```

## Testando o Componente

### Teste 1: Valores Simples
1. Clique no campo de preço
2. Digite `1250`
3. Deve aparecer: `R$ 12,50`

### Teste 2: Com Vírgula
1. Clique no campo de preço
2. Digite `15,75`
3. Deve aparecer: `R$ 15,75`

### Teste 3: Valores Grandes
1. Clique no campo de preço
2. Digite `123456,78`
3. Deve aparecer: `R$ 123.456,78`

## Solução de Problemas

Se a vírgula não estiver funcionando, verifique:

1. **Teclado**: Certifique-se de estar usando a vírgula do teclado numérico ou a vírgula normal
2. **Foco**: Clique no campo antes de digitar
3. **Navegador**: Teste em diferentes navegadores (Chrome, Firefox, Edge)

## Comportamento Esperado

- ✅ Aceita vírgula (,) para decimais
- ✅ Aceita ponto (.) para decimais (converte para vírgula)
- ✅ Formata automaticamente com separadores de milhares
- ✅ Limita a 2 casas decimais
- ✅ Adiciona prefixo "R$ " automaticamente
- ✅ Não permite valores negativos

## Exemplo de Implementação

```tsx
const [price, setPrice] = useState<number>(0);

<CurrencyInput
    value={price}
    onValueChange={(value) => setPrice(value || 0)}
    placeholder="R$ 0,00"
/>
```

## Debugging

Se ainda houver problemas, verifique no console do navegador (F12) se há algum erro JavaScript relacionado ao componente.