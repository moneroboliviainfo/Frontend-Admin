'use client'

import { useEffect, useMemo, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'

import CustomTextField from '@core/components/mui/TextField'
import type { ProductGroup } from './CentralWarehouseTable'

export type ShortcutEntry = { variantSizeId: number; quantity: number; label: string }

type Props = {
  group: ProductGroup | null
  onApply: (entries: ShortcutEntry[]) => void
  onClose: () => void
}

const label = (group: ProductGroup, colorName: string, sizeName: string) =>
  `${group.productName} · ${colorName} · Talla ${sizeName}`

// Tres formas rapidas de llenar la columna "Enviar" de todo un producto de una
// sola vez, en vez de tipear variante por variante
const DispatchShortcuts = ({ group, onApply, onClose }: Props) => {
  const [allQty, setAllQty] = useState('')
  const [sizeName, setSizeName] = useState('')
  const [sizeQty, setSizeQty] = useState('')
  const [colorKey, setColorKey] = useState('')
  const [colorQty, setColorQty] = useState('')
  const [multiColorKeys, setMultiColorKeys] = useState<string[]>([])
  const [multiSizeNames, setMultiSizeNames] = useState<string[]>([])
  const [multiQty, setMultiQty] = useState('')
  const [applied, setApplied] = useState<string | null>(null)

  useEffect(() => {
    setAllQty('')
    setSizeName('')
    setSizeQty('')
    setColorKey('')
    setColorQty('')
    setMultiColorKeys([])
    setMultiSizeNames([])
    setMultiQty('')
    setApplied(null)
  }, [group])

  // Las tallas de la curva: todas las que aparecen en algun color de este producto
  const sizeNames = useMemo(() => {
    const seen = new Set<string>()

    group?.colors.forEach(color => color.sizes.forEach(size => seen.add(size.sizeName)))

    return [...seen]
  }, [group])

  if (!group) return null

  const apply = (entries: ShortcutEntry[], message: string) => {
    onApply(entries)
    setApplied(message)
  }

  const applyAll = () => {
    const qty = parseInt(allQty, 10)

    if (!qty || qty <= 0) return

    const entries: ShortcutEntry[] = []

    group.colors.forEach(color =>
      color.sizes.forEach(size =>
        entries.push({ variantSizeId: size.variantSizeId, quantity: qty, label: label(group, color.colorName, size.sizeName) })
      )
    )

    apply(entries, `Se puso ${qty} a las ${entries.length} variantes de ${group.productName}`)
    setAllQty('')
  }

  const applyBySize = () => {
    const qty = parseInt(sizeQty, 10)

    if (!qty || qty <= 0 || !sizeName) return

    const entries: ShortcutEntry[] = []

    group.colors.forEach(color => {
      const size = color.sizes.find(s => s.sizeName === sizeName)

      if (size) entries.push({ variantSizeId: size.variantSizeId, quantity: qty, label: label(group, color.colorName, size.sizeName) })
    })

    apply(entries, `Se puso ${qty} a la talla ${sizeName} en ${entries.length} color(es)`)
    setSizeQty('')
  }

  const applyByColor = () => {
    const qty = parseInt(colorQty, 10)
    const color = group.colors.find(c => c.key === colorKey)

    if (!qty || qty <= 0 || !color) return

    const entries: ShortcutEntry[] = color.sizes.map(size => ({
      variantSizeId: size.variantSizeId,
      quantity: qty,
      label: label(group, color.colorName, size.sizeName)
    }))

    apply(entries, `Se puso ${qty} a las ${entries.length} tallas de ${color.colorName}`)
    setColorQty('')
  }

  const applyByColorsAndSizes = () => {
    const qty = parseInt(multiQty, 10)

    if (!qty || qty <= 0 || multiColorKeys.length === 0 || multiSizeNames.length === 0) return

    const entries: ShortcutEntry[] = []

    group.colors
      .filter(color => multiColorKeys.includes(color.key))
      .forEach(color => {
        color.sizes
          .filter(size => multiSizeNames.includes(size.sizeName))
          .forEach(size =>
            entries.push({ variantSizeId: size.variantSizeId, quantity: qty, label: label(group, color.colorName, size.sizeName) })
          )
      })

    apply(
      entries,
      `Se puso ${qty} a las tallas ${multiSizeNames.join(', ')} en ${multiColorKeys.length} color(es)`
    )
    setMultiQty('')
  }

  return (
    <Dialog open onClose={onClose} maxWidth='sm' fullWidth>
      <DialogTitle>
        Atajos para enviar
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
          {group.productName}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {applied && (
          <Alert severity='success' sx={{ mb: 4 }} onClose={() => setApplied(null)}>
            {applied}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Box>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              Misma cantidad a todos los colores y tallas
            </Typography>
            <Box className='flex items-end gap-2'>
              <CustomTextField
                type='number'
                size='small'
                label='Cantidad'
                placeholder='0'
                value={allQty}
                onChange={e => setAllQty(e.target.value)}
                sx={{ width: 150 }}
                inputProps={{ min: 1 }}
              />
              <Button variant='outlined' disabled={!allQty} onClick={applyAll}>
                Aplicar
              </Button>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              Por talla (curva): la misma cantidad en esa talla, para todos los colores
            </Typography>
            <Box className='flex items-end gap-2'>
              <CustomTextField
                select
                size='small'
                label='Talla'
                value={sizeName}
                onChange={e => setSizeName(e.target.value)}
                sx={{ width: 110 }}
              >
                {sizeNames.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </CustomTextField>
              <CustomTextField
                type='number'
                size='small'
                label='Cantidad'
                placeholder='0'
                value={sizeQty}
                disabled={!sizeName}
                onChange={e => setSizeQty(e.target.value)}
                sx={{ width: 150 }}
                inputProps={{ min: 1 }}
              />
              <Button variant='outlined' disabled={!sizeName || !sizeQty} onClick={applyBySize}>
                Aplicar
              </Button>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              Por color: la misma cantidad en todas las tallas de ese color
            </Typography>
            <Box className='flex items-end gap-2'>
              <CustomTextField
                select
                size='small'
                label='Color'
                value={colorKey}
                onChange={e => setColorKey(e.target.value)}
                sx={{ width: 150 }}
              >
                {group.colors.map(color => (
                  <MenuItem key={color.key} value={color.key}>
                    {color.colorName}
                  </MenuItem>
                ))}
              </CustomTextField>
              <CustomTextField
                type='number'
                size='small'
                label='Cantidad'
                placeholder='0'
                value={colorQty}
                disabled={!colorKey}
                onChange={e => setColorQty(e.target.value)}
                sx={{ width: 150 }}
                inputProps={{ min: 1 }}
              />
              <Button variant='outlined' disabled={!colorKey || !colorQty} onClick={applyByColor}>
                Aplicar
              </Button>
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant='body2' className='font-medium' sx={{ mb: 2 }}>
              A elección: la misma cantidad solo en los colores y tallas que marque (ej. S y M en 2 colores)
            </Typography>
            <Box className='flex flex-wrap items-end gap-2'>
              <CustomTextField
                select
                size='small'
                label='Colores'
                value={multiColorKeys}
                onChange={e => setMultiColorKeys(e.target.value as unknown as string[])}
                sx={{ width: 220 }}
                slotProps={{
                  select: {
                    multiple: true,
                    renderValue: (selected: unknown) => (
                      <Box className='flex flex-wrap gap-1'>
                        {(selected as string[]).map(key => (
                          <Chip
                            key={key}
                            size='small'
                            label={group.colors.find(c => c.key === key)?.colorName || key}
                          />
                        ))}
                      </Box>
                    )
                  }
                }}
              >
                {group.colors.map(color => (
                  <MenuItem key={color.key} value={color.key}>
                    {color.colorName}
                  </MenuItem>
                ))}
              </CustomTextField>

              <CustomTextField
                select
                size='small'
                label='Tallas'
                value={multiSizeNames}
                onChange={e => setMultiSizeNames(e.target.value as unknown as string[])}
                sx={{ width: 160 }}
                slotProps={{
                  select: {
                    multiple: true,
                    renderValue: (selected: unknown) => (
                      <Box className='flex flex-wrap gap-1'>
                        {(selected as string[]).map(name => (
                          <Chip key={name} size='small' label={name} />
                        ))}
                      </Box>
                    )
                  }
                }}
              >
                {sizeNames.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </CustomTextField>

              <CustomTextField
                type='number'
                size='small'
                label='Cantidad'
                placeholder='0'
                value={multiQty}
                disabled={multiColorKeys.length === 0 || multiSizeNames.length === 0}
                onChange={e => setMultiQty(e.target.value)}
                sx={{ width: 120 }}
                inputProps={{ min: 1 }}
              />
              <Button
                variant='outlined'
                disabled={multiColorKeys.length === 0 || multiSizeNames.length === 0 || !multiQty}
                onClick={applyByColorsAndSizes}
              >
                Aplicar
              </Button>
            </Box>
          </Box>
        </Box>

        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 4 }}>
          Lo aplicado queda en la columna &quot;Enviar&quot; de la tabla: se puede seguir ajustando a mano antes de
          guardar.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ p: 4 }}>
        <Button onClick={onClose} variant='contained'>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default DispatchShortcuts
