import * as React from "react"
import { cn } from "../../lib/utils"
import { PageTitle } from "./Typography"

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Título principal da página */
  title: React.ReactNode
  /** Subtítulo/descrição opcional, exibida abaixo do título */
  subtitle?: React.ReactNode
  /** Ações (botões) renderizadas à direita */
  actions?: React.ReactNode
  /** Ícone opcional renderizado à esquerda do título */
  icon?: React.ReactNode
}

/**
 * Cabeçalho padrão de página. Substitui o <h1> manual replicado em ~20 telas.
 *
 * Exemplo:
 *   <PageHeader
 *     title="Clientes"
 *     subtitle="Gerencie sua base de clientes"
 *     actions={<Button>Novo</Button>}
 *   />
 */
export const PageHeader = React.forwardRef<HTMLDivElement, PageHeaderProps>(
  ({ className, title, subtitle, actions, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <PageTitle className="truncate">{title}</PageTitle>
          {subtitle ? (
            <p className="mt-1 text-body text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  )
)
PageHeader.displayName = "PageHeader"
