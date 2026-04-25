import { useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'

import type { Variant } from '@/types/api/variants'
import VariantQRModal from './VariantQRModal'

type Props = {
  variants: Variant[]
  isLoading: boolean
  editingVariantId: number | null
  onVariantClick: (variant: Variant) => void
}

const VariantsList = ({ variants, isLoading, editingVariantId, onVariantClick }: Props) => {
  const [qrModalOpen, setQrModalOpen] = useState(false)

  const [selectedVariant, setSelectedVariant] = useState<{
    id: number
    colorName: string
    sizeName: string
  } | null>(null)

  const handleOpenQR = (e: React.MouseEvent, variantSizeId: number, colorName: string, sizeName: string) => {
    e.stopPropagation()
    setSelectedVariant({ id: variantSizeId, colorName, sizeName })
    setQrModalOpen(true)
  }

  const handleCloseQR = () => {
    setQrModalOpen(false)
    setSelectedVariant(null)
  }

  return (
    <Card sx={{ height: 'fit-content', position: 'sticky', top: 20 }}>
      <CardHeader
        title={`Variantes Creadas (${variants?.length || 0})`}
        subheader='Click para editar'
        titleTypographyProps={{ variant: 'h6' }}
      />
      <CardContent sx={{ p: 0, maxHeight: '500px', overflow: 'auto' }}>
        {isLoading ? (
          <Box display='flex' justifyContent='center' alignItems='center' py={4}>
            <CircularProgress size={24} />
            <Typography variant='body2' sx={{ ml: 2 }}>
              Cargando variantes...
            </Typography>
          </Box>
        ) : variants?.length ? (
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Color</TableCell>
                  <TableCell>Talla</TableCell>

                  <TableCell>Imagen</TableCell>
                  <TableCell align='center'>QR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...variants].sort((a, b) => Number(a.id) - Number(b.id)).map(variant => {
                  const colorName = variant.color?.name || variant.colorName || ''
                  const colorCode = variant.color?.code || variant.colorCode || '#000'

                  return variant.variants.map((variantSize, sizeIndex) => {
                    const sizeName =
                      typeof variantSize.size === 'object' ? (variantSize.size as any).name : variantSize.size

                    const sizeId = variantSize.id

                    return (
                      <TableRow
                        key={`${variant.id}-${sizeId || sizeIndex}`}
                        hover
                        sx={{
                          cursor: 'pointer',
                          backgroundColor: editingVariantId === Number(variant.id) ? 'action.selected' : 'transparent'
                        }}
                        onClick={() => onVariantClick(variant)}
                      >
                        {sizeIndex === 0 ? (
                          <TableCell rowSpan={variant.variants.length}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Box
                                sx={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: '50%',
                                  backgroundColor: colorCode,
                                  border: '1px solid #ddd'
                                }}
                              />
                              <Typography variant='caption'>{colorName}</Typography>
                            </Box>
                          </TableCell>
                        ) : null}

                        <TableCell>
                          <Typography variant='caption'>{sizeName}</Typography>
                        </TableCell>

                        {sizeIndex === 0 ? (
                          <TableCell rowSpan={variant.variants.length}>
                            <div className='flex items-center gap-1'>
                              {variant.multimedia
                                .filter(url => {
                                  const ext = url.split('.').pop()?.toLowerCase() || ''

                                  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
                                })
                                .slice(0, 3)
                                .map((url, idx) => (
                                  <Box
                                    key={idx}
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: 0.5,
                                      overflow: 'hidden',
                                      border: '1px solid',
                                      borderColor: 'divider'
                                    }}
                                  >
                                    <img
                                      src={url}
                                      alt=''
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                  </Box>
                                ))}
                              {variant.multimedia.length > 3 && (
                                <Typography variant='caption' sx={{ fontSize: '10px', color: 'text.secondary' }}>
                                  +{variant.multimedia.length - 3}
                                </Typography>
                              )}
                              {variant.multimedia.length === 0 && (
                                <Typography variant='caption' color='text.secondary'>
                                  Sin imagen
                                </Typography>
                              )}
                            </div>
                          </TableCell>
                        ) : null}

                        <TableCell align='center'>
                          {sizeId ? (
                            <IconButton
                              size='small'
                              color='primary'
                              onClick={e => handleOpenQR(e, Number(sizeId), colorName, sizeName)}
                            >
                              <i className='tabler-qrcode' />
                            </IconButton>
                          ) : (
                            <Typography variant='caption' color='text.disabled'>
                              N/A
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                })}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Box textAlign='center' py={4} color='text.secondary'>
            <i className='tabler-package' style={{ fontSize: '2rem', opacity: 0.3 }} />
            <Typography variant='body2' sx={{ mt: 1 }}>
              No hay variantes creadas
            </Typography>
            <Typography variant='caption'>Crea la primera variante del producto</Typography>
          </Box>
        )}
      </CardContent>

      {selectedVariant && (
        <VariantQRModal
          open={qrModalOpen}
          onClose={handleCloseQR}
          variantId={selectedVariant.id}
          colorName={selectedVariant.colorName}
          sizeName={selectedVariant.sizeName}
        />
      )}
    </Card>
  )
}

export default VariantsList
