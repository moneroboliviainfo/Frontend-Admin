'use client'

import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

// Components Imports
/* import OptionMenu from '@core/components/option-menu' */

// Hooks
import { useLowStock } from '@/hooks/useDashboard'
import { variantService } from '@/services/variantService'

const LowStock = () => {
  const { data: lowStockData, isLoading } = useLowStock()
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingTransactions, setIsExportingTransactions] = useState(false)
  const [isExportingCritical, setIsExportingCritical] = useState(false)

  const isAnyExporting = isExporting || isExportingTransactions || isExportingCritical

  const handleExportExcel = async () => {
    setIsExporting(true)

    try {
      const blob = await variantService.exportToExcel()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `productos-stock-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar Excel:', error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportTransactions = async () => {
    setIsExportingTransactions(true)

    try {
      const blob = await variantService.exportTransactionsToExcel()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `transacciones-stock-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar transacciones:', error)
    } finally {
      setIsExportingTransactions(false)
    }
  }

  const handleExportCriticalStock = async () => {
    setIsExportingCritical(true)

    try {
      const blob = await variantService.exportCriticalStock()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `stock-critico-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar stock crítico:', error)
    } finally {
      setIsExportingCritical(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant='h5' sx={{ mb: 0.5 }}>
            Productos con Bajo Stock
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Productos que necesitan reabastecimiento
          </Typography>
        </Box>

        <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1.5 }}>
          Exportar Reportes
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
            mb: 3
          }}
        >
          <Button
            variant='contained'
            color='success'
            size='small'
            onClick={handleExportExcel}
            disabled={isAnyExporting}
            fullWidth
            startIcon={
              isExporting ? <CircularProgress size={14} color='inherit' /> : <i className='tabler-file-spreadsheet' />
            }
            sx={{ minHeight: 32, fontSize: '0.8rem', py: 0.5 }}
          >
            {isExporting ? 'Exportando...' : 'Excel Stock'}
          </Button>
          <Button
            variant='contained'
            color='primary'
            size='small'
            onClick={handleExportTransactions}
            disabled={isAnyExporting}
            fullWidth
            startIcon={
              isExportingTransactions ? (
                <CircularProgress size={14} color='inherit' />
              ) : (
                <i className='tabler-file-download' />
              )
            }
            sx={{ minHeight: 32, fontSize: '0.8rem', py: 0.5 }}
          >
            {isExportingTransactions ? 'Exportando...' : 'Excel Transacciones'}
          </Button>
          <Button
            variant='contained'
            color='error'
            size='small'
            onClick={handleExportCriticalStock}
            disabled={isAnyExporting}
            fullWidth
            startIcon={
              isExportingCritical ? (
                <CircularProgress size={14} color='inherit' />
              ) : (
                <i className='tabler-alert-triangle' />
              )
            }
            sx={{ minHeight: 32, fontSize: '0.8rem', py: 0.5 }}
          >
            {isExportingCritical ? 'Exportando...' : 'Stock Crítico'}
          </Button>
        </Box>

        <Divider sx={{ mb: 3 }} />
        <Box
          sx={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.638rem',
            pr: 1,
            '&::-webkit-scrollbar': {
              width: '6px'
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent'
            },
            '&::-webkit-scrollbar-thumb': {
              background: '#888',
              borderRadius: '3px'
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: '#555'
            }
          }}
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className='flex items-center gap-4'>
                <Skeleton variant='rectangular' width={46} height={46} />
                <div className='flex flex-wrap justify-between items-center gap-x-4 gap-y-1 is-full'>
                  <div className='flex flex-col'>
                    <Skeleton variant='text' width={150} height={24} />
                    <Skeleton variant='text' width={100} height={20} />
                  </div>
                  <Skeleton variant='circular' width={60} height={24} />
                </div>
              </div>
            ))
          ) : lowStockData && lowStockData.length > 0 ? (
            lowStockData.map((item, index) => {
            const firstImage = item.productColor.multimedia[0] || '/images/placeholder.png'
            const productName = item.productColor.product.name
            const colorName = item.productColor.color.name
            const price = parseFloat(item.productColor.product.price)
            const stockLevel = item.stock

            const stockColor = stockLevel === 0 ? 'error' : stockLevel <= 5 ? 'warning' : 'info'

            return (
              <div key={index} className='flex items-center gap-4'>
                <img src={firstImage} alt={productName} width={46} height={46} style={{ objectFit: 'cover' }} />
                <div className='flex flex-wrap justify-between items-center gap-x-4 gap-y-1 is-full'>
                  <div className='flex flex-col gap-1'>
                    <Typography className='font-medium' color='text.primary'>
                      {productName}
                    </Typography>
                    <Typography variant='body2'>
                      {`${colorName} - Talla: ${item.size.name} | Bs ${price.toFixed(2)}`}
                    </Typography>
                  </div>
                  <Chip
                    label={`Stock: ${stockLevel}`}
                    color={stockColor}
                    size='small'
                    variant='filled'
                  />
                </div>
              </div>
            )
          })
        ) : (
          <div className='flex items-center justify-center' style={{ minHeight: '200px' }}>
            <Typography variant='body2' color='text.secondary'>
              No hay productos con bajo stock
            </Typography>
          </div>
        )}
        </Box>
      </CardContent>
    </Card>
  )
}

export default LowStock
