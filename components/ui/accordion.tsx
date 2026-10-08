'use client'

import * as React from 'react'
import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'
import { Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

function Accordion({ ...props }: AccordionPrimitive.Root.Props) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn('border-b border-rule last:border-b-0', className)}
      {...props}
    />
  )
}

/** Trigger with the site's FAQ "+" disc, which turns into a "×" when the panel is open. */
function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          'group/accordion-trigger flex flex-1 items-center justify-between gap-4 py-4 text-left text-[15px] font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-foreground shadow-pill transition-transform duration-200 ease-site group-data-[panel-open]/accordion-trigger:rotate-45"
        >
          <Plus className="size-3.5" />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="h-[var(--accordion-panel-height)] overflow-hidden text-sm transition-[height] duration-300 ease-site data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div className={cn('pb-4 text-muted-foreground', className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
