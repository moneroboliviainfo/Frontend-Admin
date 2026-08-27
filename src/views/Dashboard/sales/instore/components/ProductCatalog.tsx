import React from 'react'

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
  StepLabel
} from '@mui/material'

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
  onProductClick
}) => {
  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(numAmount)
  }

  return (
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
                    <Chip
                      label={`Stock: ${item.stock}`}
                      size='small'
                      color={item.stock > 10 ? 'success' : item.stock > 0 ? 'warning' : 'error'}
                    />
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
  )
}

export default ProductCatalog
