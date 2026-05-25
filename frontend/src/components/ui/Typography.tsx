import * as React from "react"
import { cn } from "../../lib/utils"

/**
 * Sistema tipográfico unificado.
 *
 * Use estes componentes em vez de aplicar text-xl/2xl/3xl direto.
 * A escala é definida em tailwind.config.js (display/h2/h3/body/label/caption).
 */

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement>
type TextProps = React.HTMLAttributes<HTMLParagraphElement>

export const PageTitle = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, ...props }, ref) => (
    <h1
      ref={ref}
      className={cn("text-display text-foreground", className)}
      {...props}
    />
  )
)
PageTitle.displayName = "PageTitle"

export const SectionTitle = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, ...props }, ref) => (
    <h2
      ref={ref}
      className={cn("text-h2 text-foreground", className)}
      {...props}
    />
  )
)
SectionTitle.displayName = "SectionTitle"

export const Subtitle = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-h3 text-foreground", className)}
      {...props}
    />
  )
)
Subtitle.displayName = "Subtitle"

export const Body = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-body text-foreground", className)}
      {...props}
    />
  )
)
Body.displayName = "Body"

export const Caption = React.forwardRef<HTMLParagraphElement, TextProps>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-caption text-muted-foreground", className)}
      {...props}
    />
  )
)
Caption.displayName = "Caption"

export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-label text-foreground", className)}
    {...props}
  />
))
FormLabel.displayName = "FormLabel"
