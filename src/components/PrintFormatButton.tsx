'use client'

// Boton de imprimir con eleccion de papel: rollo de 80mm (termica, lo de
// siempre) u hoja A4 (impresora comun). El clic principal usa el ultimo formato
// elegido en ESTE equipo (por defecto rollo, asi nada cambia para quien no
// toca la flecha); la flecha abre el menu para elegir y lo recuerda.

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import IconButton from '@mui/material/IconButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'

export type PrintFormat = 'roll' | 'a4'

const STORAGE_KEY = 'print-format'

const readFormat = (): PrintFormat => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'a4' ? 'a4' : 'roll'
  } catch {
    return 'roll'
  }
}

const saveFormat = (format: PrintFormat) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, format)
  } catch {
    // Sin almacenamiento (incognito, bloqueado): se queda con el de por defecto
  }
}

const FORMATS: { value: PrintFormat; label: string; hint: string; icon: string }[] = [
  { value: 'roll', label: 'Rollo 80 mm', hint: 'Impresora térmica', icon: 'tabler-receipt' },
  { value: 'a4', label: 'Hoja carta / A4', hint: 'Impresora común', icon: 'tabler-file-text' }
]

const usePrintFormat = () => {
  // Arranca en rollo para que el render del servidor y el del cliente coincidan
  const [format, setFormat] = useState<PrintFormat>('roll')

  useEffect(() => setFormat(readFormat()), [])

  const choose = (value: PrintFormat) => {
    setFormat(value)
    saveFormat(value)
  }

  return { format, choose }
}

type Props = {
  onRoll: () => void
  onA4: () => void
  label?: ReactNode
  variant?: 'text' | 'outlined' | 'contained'
  disabled?: boolean

  // 'icon' es la version chica para tablas
  mode?: 'button' | 'icon'
  tooltip?: string
}

const PrintFormatButton = ({
  onRoll,
  onA4,
  label = 'Imprimir',
  variant = 'outlined',
  disabled,
  mode = 'button',
  tooltip
}: Props) => {
  const { format, choose } = usePrintFormat()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement | HTMLButtonElement | null>(null)

  const print = (value: PrintFormat) => (value === 'a4' ? onA4() : onRoll())

  const pick = (value: PrintFormat) => {
    choose(value)
    setOpen(false)
    print(value)
  }

  const menu = (
    <Menu
      anchorEl={anchorRef.current}
      open={open}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {FORMATS.map(item => (
        <MenuItem key={item.value} selected={item.value === format} onClick={() => pick(item.value)}>
          <ListItemIcon>
            <i className={item.icon} />
          </ListItemIcon>
          <ListItemText primary={item.label} secondary={item.hint} />
        </MenuItem>
      ))}
    </Menu>
  )

  // En tablas: el icono abre directamente el menu (dos opciones, un clic mas)
  if (mode === 'icon') {
    return (
      <>
        <Tooltip title={tooltip || 'Imprimir'}>
          <span>
            <IconButton
              size='small'
              disabled={disabled}
              ref={el => {
                anchorRef.current = el
              }}
              onClick={() => setOpen(true)}
            >
              <i className='tabler-printer' />
            </IconButton>
          </span>
        </Tooltip>
        {menu}
      </>
    )
  }

  const current = FORMATS.find(item => item.value === format)!

  return (
    <>
      <ButtonGroup
        variant={variant}
        disabled={disabled}
        ref={el => {
          anchorRef.current = el
        }}
      >
        <Button startIcon={<i className='tabler-printer' />} onClick={() => print(format)}>
          {label}
          {format === 'a4' ? ' (hoja)' : ''}
        </Button>
        {/* Sin Tooltip envolviendo: rompe los bordes del ButtonGroup */}
        <Button
          size='small'
          aria-label='Elegir formato de impresión'
          title={`Formato: ${current.label}. Cambiar`}
          onClick={() => setOpen(true)}
          sx={{ px: 1 }}
        >
          <i className='tabler-chevron-down' />
        </Button>
      </ButtonGroup>
      {menu}
    </>
  )
}

export default PrintFormatButton
