'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  id?: string
}

export default function AnimatedSection({ children, className, delay = 0, id }: Props) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div id={id} className={className}>{children}</div>
  }

  return (
    <motion.div
      id={id}
      className={className}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
    >
      {children}
    </motion.div>
  )
}
