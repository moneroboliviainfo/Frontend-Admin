'use client'

import { createContext, useContext, useState, useCallback, useEffect, useId, type ReactNode } from 'react'

import { usePathname } from 'next/navigation'

import { isBranchScoped } from '@/utils/branchScope'

// La ruta alcanza para clasificar casi todo, pero no siempre: en el alta de
// productos la sucursal solo importa en el paso de Variantes, y en Bodega
// Central la pestaña Retiros es un informe de todas las sucursales. Las dos
// comparten direccion con vistas del otro tipo.
//
// Por eso una vista interna puede declarar su propio alcance mientras esta en
// pantalla. Se guardan en una pila con un id por declarante: asi, si en algun
// momento hay dos anidados, el de adentro manda y al desmontarse no borra el
// del de afuera.

type Declaracion = { id: string; active: boolean }

type BranchScopeContextType = {
  declaraciones: Declaracion[]
  declarar: (id: string, active: boolean) => void
  quitar: (id: string) => void
}

const BranchScopeContext = createContext<BranchScopeContextType | null>(null)

export const BranchScopeProvider = ({ children }: { children: ReactNode }) => {
  const [declaraciones, setDeclaraciones] = useState<Declaracion[]>([])

  const declarar = useCallback((id: string, active: boolean) => {
    setDeclaraciones(prev => {
      const anterior = prev.find(d => d.id === id)

      if (anterior?.active === active) return prev

      return [...prev.filter(d => d.id !== id), { id, active }]
    })
  }, [])

  const quitar = useCallback((id: string) => {
    setDeclaraciones(prev => (prev.some(d => d.id === id) ? prev.filter(d => d.id !== id) : prev))
  }, [])

  return (
    <BranchScopeContext.Provider value={{ declaraciones, declarar, quitar }}>{children}</BranchScopeContext.Provider>
  )
}

// Lo que leen el color del tema, el selector y el chip de la navbar.
export const useBranchScope = (): boolean => {
  const context = useContext(BranchScopeContext)
  const pathname = usePathname()

  const ultima = context?.declaraciones[context.declaraciones.length - 1]

  return ultima ? ultima.active : isBranchScoped(pathname)
}

// Lo que usa una vista interna para corregir lo que dice su ruta.
export const useDeclareBranchScope = (active: boolean) => {
  const context = useContext(BranchScopeContext)
  const id = useId()

  const declarar = context?.declarar
  const quitar = context?.quitar

  useEffect(() => {
    declarar?.(id, active)

    return () => quitar?.(id)
  }, [id, active, declarar, quitar])
}
