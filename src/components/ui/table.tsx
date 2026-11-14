import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Tabla con scroll horizontal. Cuando no entra, la barra de desplazamiento se
 * ofrece también ARRIBA (pegada al borde superior al bajar la página), para no
 * tener que ir hasta el final de la tabla a deslizar. Las dos barras se mueven
 * juntas; la de abajo se oculta porque la de arriba la reemplaza.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const barraSuperior = React.useRef<HTMLDivElement>(null)
  const [anchoTotal, setAnchoTotal] = React.useState(0)
  const [desborda, setDesborda] = React.useState(false)

  React.useEffect(() => {
    const el = contenedor.current
    if (!el) return
    const medir = () => {
      setAnchoTotal(el.scrollWidth)
      setDesborda(el.scrollWidth > el.clientWidth + 1)
    }
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    if (el.firstElementChild) observador.observe(el.firstElementChild)
    return () => observador.disconnect()
  }, [])

  const sincronizar = (
    origen: HTMLDivElement | null,
    destino: HTMLDivElement | null
  ) => {
    if (origen && destino && destino.scrollLeft !== origen.scrollLeft) {
      destino.scrollLeft = origen.scrollLeft
    }
  }

  return (
    <div className="w-full">
      <div
        ref={barraSuperior}
        aria-hidden="true"
        onScroll={() => sincronizar(barraSuperior.current, contenedor.current)}
        className={cn(
          "themed-scrollbar sticky top-0 z-10 overflow-x-auto overflow-y-hidden bg-card",
          !desborda && "hidden"
        )}
      >
        <div className="h-px" style={{ width: anchoTotal }} />
      </div>
      <div
        ref={contenedor}
        data-slot="table-container"
        onScroll={() => sincronizar(contenedor.current, barraSuperior.current)}
        className={cn(
          "relative w-full overflow-x-auto",
          desborda && "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-[13px]", className)}
          {...props}
        />
      </div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "font-subtitulo text-muted-foreground h-9 px-3 text-left align-middle text-xs font-medium tracking-wide uppercase whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle tabular-nums whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
