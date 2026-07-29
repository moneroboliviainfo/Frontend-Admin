'use client'

import { useState, useEffect, useMemo } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Grid from '@mui/material/Grid2'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Chip from '@mui/material/Chip'

import {
  useFacturarOnline,
  useTiposDocumentoIdentidad,
  useSearchBilling,
  useVerificarNit,
  useCreateOrUpdateBilling
} from '@/hooks/useSales'
import type { Branch, FacturacionOnlineDetalle, TipoDocumentoIdentidad, Factura } from '@/types/api/sales'
import { METODOS_PAGO_SIAT, ACTIVIDADES_ECONOMICAS_SIAT, TIPOS_PRODUCTO_SIAT } from '@/types/api/sales'
import { printInvoice } from '@/utils/invoicePrinter'

interface FacturacionFormProps {
  branch: Branch
  onSuccess: () => void
  onCancel: () => void
}

interface DetalleItem extends FacturacionOnlineDetalle {
  id: string
}

const FacturacionForm = ({ branch, onSuccess, onCancel }: FacturacionFormProps) => {
  // Estados del cliente
  const [codigoTipoDocumentoIdentidad, setCodigoTipoDocumentoIdentidad] = useState<number | ''>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [nombreRazonSocial, setNombreRazonSocial] = useState('')
  const [complemento, setComplemento] = useState('')
  const [email, setEmail] = useState('')

  // Estados de facturación
  const [actividadEconomica, setActividadEconomica] = useState<string>(
    ACTIVIDADES_ECONOMICAS_SIAT[0]?.codigoCaeb || '477110'
  )

  const [codigoMetodoPago, setCodigoMetodoPago] = useState<number>(1)
  const [tipoProducto, setTipoProducto] = useState<string>('P1')

  // Estados de validación NIT
  const [nitValidationStatus, setNitValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [nitValidationMessage, setNitValidationMessage] = useState('')
  const [searchCi, setSearchCi] = useState('')
  const [showBillingResults, setShowBillingResults] = useState(false)

  // Estado para modal de éxito
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [emittedFactura, setEmittedFactura] = useState<Factura | null>(null)

  // Estados de detalles
  const [detalles, setDetalles] = useState<DetalleItem[]>([
    {
      id: 'detalle-1',
      actividadEconomica: '477110',
      codigoProductoSin: 62233,
      codigoProducto: 'PROD-001',
      descripcion: '',
      cantidad: 1,
      unidadMedida: 47,
      precioUnitario: 0,
      montoDescuento: 0
    }
  ])

  const [error, setError] = useState('')

  const facturarMutation = useFacturarOnline()
  const createOrUpdateBillingMutation = useCreateOrUpdateBilling()
  const { data: tiposDocumentoData } = useTiposDocumentoIdentidad()
  const { data: billingSearchData, isFetching: isSearchingBilling } = useSearchBilling(searchCi)
  const verificarNitMutation = useVerificarNit()

  // Extraer tipos de documento
  const tiposDocumento: TipoDocumentoIdentidad[] = useMemo(() => {
    if (tiposDocumentoData?.parametrica?.[0]?.payload) {
      return tiposDocumentoData.parametrica[0].payload
    }

    return []
  }, [tiposDocumentoData])

  // Establecer tipo de documento por defecto cuando se cargan los datos
  useEffect(() => {
    if (tiposDocumento.length > 0 && codigoTipoDocumentoIdentidad === '') {
      // CI por defecto (código 1)
      const ciTipo = tiposDocumento.find(t => t.codigoClasificador === 1)

      setCodigoTipoDocumentoIdentidad(ciTipo ? ciTipo.codigoClasificador : tiposDocumento[0].codigoClasificador)
    }
  }, [tiposDocumento, codigoTipoDocumentoIdentidad])

  const isNitSelected = codigoTipoDocumentoIdentidad === 5
  const requiresOnlyNumbers = codigoTipoDocumentoIdentidad === 1 || codigoTipoDocumentoIdentidad === 5

  // Calcular total
  const total = useMemo(() => {
    return detalles.reduce((acc, item) => {
      const subtotal = item.cantidad * item.precioUnitario - item.montoDescuento

      return acc + subtotal
    }, 0)
  }, [detalles])

  // Verificar NIT automáticamente
  useEffect(() => {
    if (isNitSelected && numeroDocumento.length >= 5 && /^\d+$/.test(numeroDocumento)) {
      setNitValidationStatus('idle')

      const timer = setTimeout(() => {
        verificarNitMutation.mutate(parseInt(numeroDocumento), {
          onSuccess: data => {
            if (data.success && data.data.RespuestaVerificarNit.transaccion) {
              setNitValidationStatus('valid')
              setNitValidationMessage(data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT válido')
            } else {
              setNitValidationStatus('invalid')
              setNitValidationMessage(data.data.RespuestaVerificarNit.mensajesList[0]?.descripcion || 'NIT no válido')
            }
          },
          onError: () => {
            setNitValidationStatus('invalid')
            setNitValidationMessage('Error al verificar NIT')
          }
        })
      }, 500)

      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numeroDocumento, isNitSelected])

  const handleTipoDocumentoChange = (codigo: number) => {
    setCodigoTipoDocumentoIdentidad(codigo)
    setNumeroDocumento('')
    setNombreRazonSocial('')
    setComplemento('')
    setNitValidationStatus('idle')
    setNitValidationMessage('')
    setShowBillingResults(false)
    setSearchCi('')
  }

  const handleDocumentoChange = (value: string) => {
    const newValue = requiresOnlyNumbers ? value.replace(/\D/g, '') : value

    if (newValue.length < numeroDocumento.length || newValue === '') {
      setNombreRazonSocial('')
      setComplemento('')
      setShowBillingResults(false)
      setSearchCi('')
    }

    setNumeroDocumento(newValue)
    setNitValidationStatus('idle')
    setNitValidationMessage('')
  }

  const handleSearchBilling = () => {
    if (numeroDocumento.length >= 5) {
      setSearchCi(numeroDocumento)
      setShowBillingResults(true)
    }
  }

  const handleSelectBilling = () => {
    if (billingSearchData) {
      setNumeroDocumento(billingSearchData.ci)
      setNombreRazonSocial(billingSearchData.name || '')
      setComplemento(billingSearchData.complemento || '')
      setEmail(billingSearchData.email || '')
      setCodigoTipoDocumentoIdentidad(
        billingSearchData.codigoTipoDocumentoIdentidad || codigoTipoDocumentoIdentidad || 1
      )
      setShowBillingResults(false)
      setSearchCi('')
    }
  }

  const handleAddDetalle = () => {
    setDetalles(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        actividadEconomica: '477110',
        codigoProductoSin: 62233,
        codigoProducto: `PROD-${String(prev.length + 1).padStart(3, '0')}`,
        descripcion: '',
        cantidad: 1,
        unidadMedida: 47,
        precioUnitario: 0,
        montoDescuento: 0
      }
    ])
  }

  const handleRemoveDetalle = (id: string) => {
    if (detalles.length > 1) {
      setDetalles(prev => prev.filter(d => d.id !== id))
    }
  }

  const handleDetalleChange = (id: string, field: keyof DetalleItem, value: string | number) => {
    setDetalles(prev =>
      prev.map(d => {
        if (d.id === id) {
          return { ...d, [field]: value }
        }

        return d
      })
    )
  }

  const handlePrintAndClose = () => {
    if (emittedFactura) {
      printInvoice(emittedFactura)
    }

    setShowSuccessModal(false)
    onSuccess()
  }

  const handleCloseWithoutPrint = () => {
    setShowSuccessModal(false)
    onSuccess()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validaciones
    if (!numeroDocumento) {
      setError('Debe ingresar el número de documento')

      return
    }

    if (!nombreRazonSocial) {
      setError('Debe ingresar el nombre o razón social')

      return
    }

    if (isNitSelected && nitValidationStatus !== 'valid') {
      setError('El NIT debe ser válido')

      return
    }

    if (detalles.some(d => d.precioUnitario <= 0)) {
      setError('Todos los productos deben tener un precio válido')

      return
    }

    try {
      // 1. Crear o actualizar billing para obtener el ID
      const billingData = await createOrUpdateBillingMutation.mutateAsync({
        ci: numeroDocumento,
        name: nombreRazonSocial.toUpperCase(),
        email: email || undefined,
        complemento: complemento || undefined,
        codigoTipoDocumentoIdentidad: codigoTipoDocumentoIdentidad || 1
      })

      // 2. Preparar datos de factura con el ID del billing como codigoCliente
      const data = {
        razonSocialEmisor: branch.razonSocial,
        municipio: branch.municipio,
        telefono: branch.telefono,
        nombreSucursal: branch.name,
        tipoFacturaDocumento: 1,
        nombreRazonSocial: nombreRazonSocial.toUpperCase(),
        codigoTipoDocumentoIdentidad: codigoTipoDocumentoIdentidad || 1,
        numeroDocumento,
        complemento: complemento || '',
        codigoCliente: `CLI-${billingData.id}`,
        codigoMetodoPago,
        codigoMoneda: 1,
        tipoCambio: 1,
        descuentoAdicional: 0,
        usuario: 'Admin',
        ...(email ? { emails: [email] } : {}),
        codigoDocumentoSector: 1,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        detalles: detalles.map(({ id, ...rest }) => {
          const productoSeleccionado = TIPOS_PRODUCTO_SIAT.find(t => t.codigo === tipoProducto)

          return {
            ...rest,
            descripcion: rest.descripcion || productoSeleccionado?.descripcion || 'PRENDAS DE VESTIR',
            actividadEconomica,
            codigoProductoSin: productoSeleccionado?.codigoProductoSin || 99100,
            codigoProducto: productoSeleccionado?.codigo || 'P1'
          }
        })
      }

      // 3. Emitir factura
      const result = await facturarMutation.mutateAsync({
        data,
        codigoSucursal: branch.codigoSucursal,
        codigoPuntoVenta: 0
      })

      // El API retorna { response, factura }
      setEmittedFactura(result.factura)
      setShowSuccessModal(true)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al procesar la factura')
    }
  }

  return (
    <>
      <Box component='form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2 }}>
        {error && <Alert severity='error'>{error}</Alert>}

        <Alert severity='info'>
          Sucursal: <strong>{branch.alias}</strong> - {branch.razonSocial}
        </Alert>

        {/* Configuración de Facturación */}
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
            Configuración de Facturación
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Actividad Económica *</InputLabel>
                <Select
                  value={actividadEconomica}
                  label='Actividad Económica *'
                  onChange={e => setActividadEconomica(e.target.value)}
                >
                  {ACTIVIDADES_ECONOMICAS_SIAT.map(act => (
                    <MenuItem key={act.codigoCaeb} value={act.codigoCaeb}>
                      {act.codigoCaeb} - {act.descripcion}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Método de Pago *</InputLabel>
                <Select
                  value={codigoMetodoPago}
                  label='Método de Pago *'
                  onChange={e => setCodigoMetodoPago(e.target.value as number)}
                >
                  {METODOS_PAGO_SIAT.map(metodo => (
                    <MenuItem key={metodo.codigo} value={metodo.codigo}>
                      {metodo.descripcion}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Tipo de Producto *</InputLabel>
                <Select value={tipoProducto} label='Tipo de Producto *' onChange={e => setTipoProducto(e.target.value)}>
                  {TIPOS_PRODUCTO_SIAT.map(tipo => (
                    <MenuItem key={tipo.codigo} value={tipo.codigo}>
                      {tipo.codigo} - {tipo.descripcion}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Datos del Cliente */}
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Typography variant='subtitle2' fontWeight='bold' sx={{ mb: 2 }}>
            Datos del Cliente
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Tipo Documento *</InputLabel>
                <Select
                  value={codigoTipoDocumentoIdentidad}
                  label='Tipo Documento *'
                  onChange={e => handleTipoDocumentoChange(e.target.value as number)}
                >
                  {tiposDocumento.map(tipo => (
                    <MenuItem key={tipo.codigoClasificador} value={tipo.codigoClasificador}>
                      {tipo.descripcion}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size='small'
                  label={isNitSelected ? 'NIT *' : 'CI *'}
                  value={numeroDocumento}
                  onChange={e => handleDocumentoChange(e.target.value)}
                  inputProps={{ maxLength: 15 }}
                  error={isNitSelected && nitValidationStatus === 'invalid'}
                  helperText={isNitSelected && nitValidationStatus !== 'idle' ? nitValidationMessage : ''}
                  InputProps={{
                    endAdornment:
                      isNitSelected && verificarNitMutation.isPending ? (
                        <CircularProgress size={16} />
                      ) : isNitSelected && nitValidationStatus === 'valid' ? (
                        <i className='tabler-check text-success' />
                      ) : null
                  }}
                />
                <Button
                  variant='outlined'
                  size='small'
                  onClick={handleSearchBilling}
                  disabled={numeroDocumento.length < 5 || isSearchingBilling}
                  sx={{ minWidth: 40, px: 1 }}
                >
                  {isSearchingBilling ? <CircularProgress size={16} /> : <i className='tabler-search' />}
                </Button>
              </Box>
            </Grid>

            {showBillingResults && billingSearchData && (
              <Grid size={{ xs: 12 }}>
                <Alert
                  severity='info'
                  action={
                    <Button color='inherit' size='small' onClick={handleSelectBilling}>
                      Usar estos datos
                    </Button>
                  }
                >
                  <Typography variant='caption'>
                    <strong>Encontrado:</strong> {billingSearchData.name || 'Sin nombre'} - {billingSearchData.ci}
                  </Typography>
                </Alert>
              </Grid>
            )}

            {showBillingResults && !billingSearchData && !isSearchingBilling && (
              <Grid size={{ xs: 12 }}>
                <Alert
                  severity='warning'
                  action={
                    <Button color='inherit' size='small' onClick={() => setShowBillingResults(false)}>
                      Crear nuevo
                    </Button>
                  }
                >
                  No se encontró cliente. Complete los datos manualmente para crear uno nuevo.
                </Alert>
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                size='small'
                label='Nombre / Razón Social *'
                value={nombreRazonSocial}
                onChange={e => setNombreRazonSocial(e.target.value)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                size='small'
                label='Complemento'
                value={complemento}
                onChange={e => setComplemento(e.target.value)}
                inputProps={{ maxLength: 5 }}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                fullWidth
                size='small'
                label='Email'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Detalles de la Factura */}
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant='subtitle2' fontWeight='bold'>
              Productos / Servicios
            </Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-plus' />}
              onClick={handleAddDetalle}
            >
              Agregar
            </Button>
          </Box>

          {detalles.map((detalle, index) => (
            <Box key={detalle.id} sx={{ mb: 2 }}>
              {index > 0 && <Divider sx={{ mb: 2 }} />}
              <Grid container spacing={2} alignItems='center'>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField
                    fullWidth
                    size='small'
                    label='Descripción'
                    value={detalle.descripcion}
                    onChange={e => handleDetalleChange(detalle.id, 'descripcion', e.target.value)}
                    placeholder={
                      TIPOS_PRODUCTO_SIAT.find(t => t.codigo === tipoProducto)?.descripcion || 'PRENDAS DE VESTIR'
                    }
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    fullWidth
                    size='small'
                    label='Cantidad *'
                    value={detalle.cantidad}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '')

                      handleDetalleChange(detalle.id, 'cantidad', parseInt(value) || 1)
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    fullWidth
                    size='small'
                    label='Precio Unit. *'
                    value={detalle.precioUnitario}
                    onChange={e => {
                      const value = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')

                      handleDetalleChange(detalle.id, 'precioUnitario', parseFloat(value) || 0)
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 2 }}>
                  <TextField
                    fullWidth
                    size='small'
                    label='Descuento'
                    value={detalle.montoDescuento}
                    onChange={e => {
                      const value = e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')

                      handleDetalleChange(detalle.id, 'montoDescuento', parseFloat(value) || 0)
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 1 }}>
                  <IconButton
                    color='error'
                    onClick={() => handleRemoveDetalle(detalle.id)}
                    disabled={detalles.length === 1}
                    size='small'
                  >
                    <i className='tabler-trash' />
                  </IconButton>
                </Grid>
              </Grid>
            </Box>
          ))}

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Typography variant='h6' fontWeight='bold' color='primary'>
              Total: Bs. {total.toFixed(2)}
            </Typography>
          </Box>
        </Paper>

        {/* Botones */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button
            variant='outlined'
            onClick={onCancel}
            disabled={createOrUpdateBillingMutation.isPending || facturarMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={
              createOrUpdateBillingMutation.isPending ||
              facturarMutation.isPending ||
              (isNitSelected && nitValidationStatus !== 'valid') ||
              codigoTipoDocumentoIdentidad === ''
            }
            startIcon={
              createOrUpdateBillingMutation.isPending || facturarMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                <i className='tabler-file-invoice' />
              )
            }
          >
            {createOrUpdateBillingMutation.isPending
              ? 'Guardando cliente...'
              : facturarMutation.isPending
                ? 'Emitiendo...'
                : 'Emitir Factura'}
          </Button>
        </Box>
      </Box>

      {/* Modal de Éxito */}
      <Dialog open={showSuccessModal} maxWidth='sm' fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'success.main', color: 'white' }}>
          <i className='tabler-check' />
          <span>Factura Emitida Exitosamente</span>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {emittedFactura && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant='h5' fontWeight='bold' color='primary'>
                  Factura #{emittedFactura.numeroFactura}
                </Typography>
                <Chip label={emittedFactura.estado} color='success' variant='tonal' />
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Cliente
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {emittedFactura.nombreRazonSocial}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Documento
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {emittedFactura.numeroDocumento}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Fecha Emisión
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {new Date(emittedFactura.fechaEmision).toLocaleString('es-BO')}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Sucursal
                  </Typography>
                  <Typography variant='body2' fontWeight='medium'>
                    {emittedFactura.nombreSucursal}
                  </Typography>
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Typography variant='caption' color='text.secondary'>
                  Detalle de Productos
                </Typography>
                {emittedFactura.detalles?.map((det, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                    <Typography variant='body2'>
                      {det.cantidad}x {det.descripcion}
                    </Typography>
                    <Typography variant='body2' fontWeight='medium'>
                      Bs. {(det.subTotal || det.cantidad * det.precioUnitario - (det.montoDescuento || 0)).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Divider />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant='h6' fontWeight='bold'>
                  Total
                </Typography>
                <Typography variant='h5' fontWeight='bold' color='primary'>
                  Bs. {parseFloat(String(emittedFactura.montoTotal)).toFixed(2)}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: 'grey.100', p: 1.5, borderRadius: 1 }}>
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                  CUF
                </Typography>
                <Typography variant='caption' sx={{ wordBreak: 'break-all' }}>
                  {emittedFactura.cuf}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant='outlined' onClick={handleCloseWithoutPrint}>
            Cerrar
          </Button>
          <Button variant='contained' startIcon={<i className='tabler-printer' />} onClick={handlePrintAndClose}>
            Imprimir Factura
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default FacturacionForm
