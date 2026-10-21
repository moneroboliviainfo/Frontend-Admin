import React, { useState } from 'react'

import {
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Box,
  Chip,
  Badge,
  InputAdornment,
  CircularProgress,
  TablePagination,
  Stepper,
  Step,
  StepLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material'

import { toast } from 'react-toastify'

import { useTransferStock } from '@/hooks/useVariants'
import RequestFromBranchModal from './RequestFromBranchModal'
import RequestQrDialog from './RequestQrDialog'
import type { RequestTarget } from './RequestFromBranchModal'
import { useBranchContext } from '@/contexts/BranchContext'

interface ProductCatalogProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  cartItemsCount: number
  activeStepIndex: number
  steps: string[]
  isLoading: boolean
  variants: any[]
  variantsPage: number
  variantsLimit: number
  totalVariants: number
  onPageChange: (event: unknown, newPage: number) => void
  onProductClick: (item: any) => void
  pickupByVariant?: Record<number, { id: number; customerName: string | null }>
  linkedTransferId?: number | null
  onToggleLink?: (transferId: number) => void
}

const ProductCatalog: React.FC<ProductCatalogProps> = ({
  searchTerm,
  onSearchChange,
  cartItemsCount,
  activeStepIndex,
  steps,
  isLoading,
  variants,
  variantsPage,
  variantsLimit,
  totalVariants,
  onPageChange,
  onProductClick,
  pickupByVariant = {},
  linkedTransferId = null,
  onToggleLink
}) => {
  const [transferTarget, setTransferTarget] = useState<any | null>(null)
  const [requestTarget, setRequestTarget] = useState<RequestTarget | null>(null)
  const [qrTransferId, setQrTransferId] = useState<number | null>(null)
  const [transferQty, setTransferQty] = useState<string>('')
  const transferStock = useTransferStock()

  // Solo aplica si algún día un ADMIN entra al POS; MANAGER/CASHIER se resuelven solos
  const { selectedBranchId, isAdmin } = useBranchContext()
  const branchId = isAdmin ? (selectedBranchId ?? undefined) : undefined

  const handleOpenTransfer = (e: React.MouseEvent, item: any) => {
    e.stopPropagation()
    setTransferTarget(item)
    setTransferQty('')
  }

  const handleCloseTransfer = () => {
    setTransferTarget(null)
    setTransferQty('')
  }

  const handleConfirmTransfer = async () => {
    const quantity = Math.min(parseInt(transferQty) || 0, transferTarget?.warehouseStock || 0)

    if (!transferTarget || quantity <= 0) {
      toast.warning('Ingresa una cantidad mayor a 0')

      return
    }

    try {
      await transferStock.mutateAsync({
        variantId: transferTarget.variantSizeId,
        quantity,
        direction: 'warehouse_to_floor',
        branchId
      })
      toast.success('Stock enviado a tienda exitosamente')
      handleCloseTransfer()
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al enviar stock a tienda')
    }
  }

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount)
  }

  return (
    <>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant='h6'>Catálogo de Productos</Typography>
            <Badge badgeContent={cartItemsCount} color='primary'>
              <span style={{ fontSize: '1.2em' }}>🛒</span>
            </Badge>
          </Box>
          {cartItemsCount > 0 && (
            <Box sx={{ flex: 1, maxWidth: '400px', ml: 0 }}>
              <Stepper
                activeStep={activeStepIndex}
                sx={{
                  p: 0,
                  justifyContent: 'flex-start',
                  '& .MuiStep-root': { paddingLeft: 0 },
                  '& .MuiStepLabel-label': { textAlign: 'left', marginLeft: 0 }
                }}
              >
                {steps.map((label, index) => (
                  <Step key={index}>
                    <StepLabel>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>
            </Box>
          )}
        </Box>
        <TextField
          fullWidth
          placeholder='Buscar producto...'
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <span>🔍</span>
              </InputAdornment>
            )
          }}
        />
      </Box>
      <CardContent sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : variants.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
            <Typography sx={{ fontSize: '3rem', mb: 2, opacity: 0.5 }}>🔍</Typography>
            <Typography variant='h6'>No se encontraron productos</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {variants.map(item => (
              <Grid item xs={6} sm={4} md={3} lg={2.4} key={`${item.variantSizeId}-${item.colorVariant.id}`}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '100%',
                    opacity: isLoading ? 0.6 : 1,
                    pointerEvents: isLoading ? 'none' : 'auto',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                  onClick={() => onProductClick(item)}
                >
                  <CardContent sx={{ textAlign: 'center', p: 2 }}>
                    <Box
                      component='img'
                      src={item.multimedia?.[0] || 'https://via.placeholder.com/150'}
                      alt={item.displayName}
                      sx={{
                        width: 60,
                        height: 60,
                        objectFit: 'cover',
                        borderRadius: 1,
                        mb: 1,
                        mx: 'auto',
                        display: 'block'
                      }}
                    />
                    <Typography variant='body2' fontWeight='bold' sx={{ mb: 1, minHeight: '2.4em' }}>
                      {item.displayName}
                    </Typography>
                    <Chip label={`ID: ${item.variantSizeId}`} size='small' sx={{ mb: 1 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: item.color?.code || '#ccc',
                          border: 1,
                          borderColor: 'divider'
                        }}
                      />
                      <Typography variant='caption' color='text.secondary'>
                        {item.color?.name}
                      </Typography>
                    </Box>
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                      Talla: {item.size}
                    </Typography>
                    {item.product?.discount && item.product.discount.appliesInStore ? (
                      <Box sx={{ mb: 1 }}>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          sx={{ textDecoration: 'line-through', display: 'block' }}
                        >
                          {item.price ? formatCurrency(item.price) : '-'}
                        </Typography>
                        <Chip
                          label={`-${item.product.discount.value}%`}
                          size='small'
                          color='error'
                          sx={{ mb: 0.5 }}
                        />
                        <Typography variant='h6' color='success.main' fontWeight='bold'>
                          {item.price
                            ? formatCurrency(parseFloat(item.price) * (1 - item.product.discount.value / 100))
                            : '-'}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant='h6' color='primary' fontWeight='bold' sx={{ mb: 1 }}>
                        {item.price ? formatCurrency(item.price) : '-'}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                      <Chip
                        label={`Stock: ${item.stock}`}
                        size='small'
                        color={item.stock > 10 ? 'success' : item.stock > 0 ? 'warning' : 'error'}
                      />
                      {item.warehouseStock > 0 && (
                        <>
                          <Typography
                            variant='caption'
                            color='text.secondary'
                            sx={{ fontSize: '0.68rem', lineHeight: 1.2 }}
                          >
                            Depósito: {item.warehouseStock} disp.
                          </Typography>
                          <Button
                            size='small'
                            variant='outlined'
                            color='info'
                            onClick={e => handleOpenTransfer(e, item)}
                            startIcon={<i className='tabler-transfer' style={{ fontSize: '12px' }} />}
                            sx={{ fontSize: '0.68rem', lineHeight: 1.2, py: 0.25, px: 1, minWidth: 0 }}
                          >
                            Traer a tienda
                          </Button>
                        </>
                      )}
                      {pickupByVariant[item.variantSizeId] && (
                        <>
                          <Typography
                            variant='caption'
                            color='warning.main'
                            sx={{ fontSize: '0.68rem', lineHeight: 1.2, textAlign: 'center' }}
                          >
                            Pedido #{pickupByVariant[item.variantSizeId].id}
                            {pickupByVariant[item.variantSizeId].customerName
                              ? ` · ${pickupByVariant[item.variantSizeId].customerName}`
                              : ''}
                          </Typography>
                          <Button
                            size='small'
                            variant={
                              linkedTransferId === pickupByVariant[item.variantSizeId].id ? 'contained' : 'outlined'
                            }
                            color={
                              linkedTransferId === pickupByVariant[item.variantSizeId].id ? 'success' : 'warning'
                            }
                            onClick={e => {
                              e.stopPropagation()
                              onToggleLink?.(pickupByVariant[item.variantSizeId].id)
                            }}
                            startIcon={
                              <i
                                className={
                                  linkedTransferId === pickupByVariant[item.variantSizeId].id
                                    ? 'tabler-check'
                                    : 'tabler-link'
                                }
                                style={{ fontSize: '12px' }}
                              />
                            }
                            sx={{ fontSize: '0.68rem', lineHeight: 1.2, py: 0.25, px: 1, minWidth: 0 }}
                          >
                            {linkedTransferId === pickupByVariant[item.variantSizeId].id
                              ? 'Entrega este pedido'
                              : 'Entregar este pedido'}
                          </Button>
                        </>
                      )}
                      {item.stock === 0 && item.warehouseStock === 0 && !pickupByVariant[item.variantSizeId] && (
                        <Button
                          size='small'
                          variant='outlined'
                          color='warning'
                          onClick={e => {
                            e.stopPropagation()
                            setRequestTarget({
                              variantSizeId: item.variantSizeId,
                              label: `${item.displayName} · ${item.color?.name || ''} · Talla ${item.size}`
                            })
                          }}
                          startIcon={<i className='tabler-building-store' style={{ fontSize: '12px' }} />}
                          sx={{ fontSize: '0.68rem', lineHeight: 1.2, py: 0.25, px: 1, minWidth: 0 }}
                        >
                          Pedir a otra sucursal
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
      {variants.length > 0 && (
        <TablePagination
          component='div'
          count={totalVariants}
          page={variantsPage - 1}
          onPageChange={onPageChange}
          rowsPerPage={variantsLimit}
          rowsPerPageOptions={[]}
          labelRowsPerPage=''
          labelDisplayedRows={({ page, count }) => {
            const lastPage = Math.ceil(count / variantsLimit)

            return `Página ${page + 1} de ${lastPage} - Mostrando ${variants.length} productos (${count} variantes de color)`
          }}
        />
      )}
      </Card>

      <Dialog open={!!transferTarget} onClose={handleCloseTransfer} maxWidth='xs' fullWidth>
        <DialogTitle>Traer stock a tienda</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
            {transferTarget?.displayName} · {transferTarget?.color?.name} · Talla {transferTarget?.size}
          </Typography>
          <Typography variant='body2' sx={{ mb: 2 }}>
            Disponible en el depósito: {transferTarget?.warehouseStock}
          </Typography>
          <TextField
            fullWidth
            type='number'
            size='small'
            label='Cantidad a traer'
            placeholder='0'
            value={transferQty}
            onChange={e => setTransferQty(e.target.value)}
            inputProps={{ max: transferTarget?.warehouseStock || 0, min: 0 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTransfer} color='secondary' disabled={transferStock.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmTransfer}
            variant='contained'
            disabled={transferStock.isPending}
            startIcon={transferStock.isPending ? <CircularProgress size={16} /> : <i className='tabler-check' />}
          >
            {transferStock.isPending ? 'Enviando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <RequestFromBranchModal
        target={requestTarget}
        onClose={() => setRequestTarget(null)}
        onAwaitingQr={transferId => {
          setRequestTarget(null)
          setQrTransferId(transferId)
        }}
        showMessage={(message, severity) => (severity === 'error' ? toast.error(message) : toast.success(message))}
      />

      <RequestQrDialog
        transferId={qrTransferId}
        onClose={() => setQrTransferId(null)}
        showMessage={(message, severity) => (severity === 'error' ? toast.error(message) : toast.success(message))}
      />
    </>
  )
}

export default ProductCatalog
