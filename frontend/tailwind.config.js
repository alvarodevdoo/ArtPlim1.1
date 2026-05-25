import tailwindAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    // ... rest of theme unchanged
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          'Inter var',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        // Escala semântica — usar estas em vez de text-xs/sm/2xl/etc.
        // Formato: [size, { lineHeight, letterSpacing, fontWeight }]
        'display': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em', fontWeight: '700' }], // 30px - Título de página
        'h2':      ['1.25rem',  { lineHeight: '1.75rem', letterSpacing: '-0.01em', fontWeight: '600' }], // 20px - Título de seção/card
        'h3':      ['1rem',     { lineHeight: '1.5rem',  letterSpacing: '-0.005em', fontWeight: '600' }], // 16px - Subtítulo
        'body':    ['0.875rem', { lineHeight: '1.375rem', fontWeight: '400' }],                          // 14px - Corpo padrão
        'body-lg': ['1rem',     { lineHeight: '1.5rem',  fontWeight: '400' }],                          // 16px - Corpo destacado
        'label':   ['0.8125rem',{ lineHeight: '1.125rem', fontWeight: '500' }],                         // 13px - Labels de form/tabela
        'caption': ['0.75rem',  { lineHeight: '1rem',    fontWeight: '400' }],                          // 12px - Metadados, footnotes
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindAnimate],
}