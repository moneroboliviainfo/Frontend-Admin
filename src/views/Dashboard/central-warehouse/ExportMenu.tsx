'use client'

import { useState } from 'react'

import Button from '@mui/material/Button'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import CircularProgress from '@mui/material/CircularProgress'

import { variantService } from '@/services/variantService'

type Props = {
  warehouseId?: number
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const download = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

const ExportMenu = ({ warehouseId, showMessage }: Props) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  // total-sales queda afuera: la bodega no vende, el back responde 403
  const options = [
    { label: 'Stock de la bodega', file: 'bodega-stock', run: () => variantService.exportToExcel(warehouseId) },
    { label: 'Stock crítico', file: 'bodega-stock-critico', run: () => variantService.exportCriticalStock(warehouseId) },
    {
      label: 'Movimientos (kardex)',
      file: 'bodega-movimientos',
      run: () => variantService.exportTransactionsToExcel(warehouseId)
    }
  ]

  const handleExport = async (option: (typeof options)[number]) => {
    setAnchorEl(null)
    setIsExporting(true)

    try {
      const blob = await option.run()

      download(blob, `${option.file}-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo exportar', 'error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        color='secondary'
        variant='tonal'
        disabled={!warehouseId || isExporting}
        onClick={e => setAnchorEl(e.currentTarget)}
        startIcon={isExporting ? <CircularProgress size={16} /> : <i className='tabler-file-spreadsheet' />}
      >
        {isExporting ? 'Exportando...' : 'Exportar'}
      </Button>

      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        {options.map(option => (
          <MenuItem key={option.file} onClick={() => handleExport(option)}>
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

export default ExportMenu
