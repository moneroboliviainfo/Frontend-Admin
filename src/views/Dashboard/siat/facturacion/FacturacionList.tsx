'use client'

import { useState, useMemo } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import TablePagination from '@mui/material/TablePagination'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import InputAdornment from '@mui/material/InputAdornment'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Tooltip from '@mui/material/Tooltip'
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import { useFacturas, useBranches, useAnularFactura, useRevertirAnulacion } from '@/hooks/useSales'
import { useUserRole } from '@/hooks/useUserRole'
import type { Factura, Branch } from '@/types/api/sales'
import FacturacionForm from './FacturacionForm'
import { printInvoice } from '@/utils/invoicePrinter'
import { printInvoiceBluetooth, isBluetoothAvailable, isBluetoothConnected, getConnectedDeviceName } from '@/utils/bluetoothPrinter'

const getEstadoColor = (estado: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
  switch (estado) {
    case 'VALIDADA':
      return 'success'
    case 'PENDIENTE':
      return 'warning'
    case 'ANULADA':
      return 'error'
    case 'REVERTIDA':
      return 'info'
    default:
      return 'default'
  }
}

const FacturacionList = () => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('')
  const [selectedFactura, setSelectedFactura] = useState<Factura | null>(null)
  const [showAnularConfirm, setShowAnularConfirm] = useState(false)
  const [showRevertirConfirm, setShowRevertirConfirm] = useState(false)
  const [motivoAnulacion, setMotivoAnulacion] = useState<number>(1)
  const [fechaInicio, setFechaInicio] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [fechaFin, setFechaFin] = useState<string>('')

  // Estados para impresión Bluetooth
  const [btPrinting, setBtPrinting] = useState<number | null>(null)
  const [btMessage, setBtMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const { data: branchesData, isLoading: isLoadingBranches } = useBranches()
  const { excludedBranchCodes } = useUserRole()
  const anularFacturaMutation = useAnularFactura()
  const revertirAnulacionMutation = useRevertirAnulacion()

  // Filtrar sucursales según el rol del usuario
  const filteredBranches = useMemo(() => {
    if (!branchesData) return []

    return branchesData.filter(
      (b: Branch) => b.active && !excludedBranchCodes.includes(b.codigoSucursal)
    )
  }, [branchesData, excludedBranchCodes])

  // Obtener sucursal seleccionada
  const selectedBranch = useMemo(() => {
    if (!branchesData || !selectedBranchId) return null

    return branchesData.find((b: Branch) => b.id === selectedBranchId)
  }, [branchesData, selectedBranchId])

  const {
    data: facturasData,
    isLoading,
    error,
    refetch
  } = useFacturas(
    {
      codigoSucursal: selectedBranch?.codigoSucursal ?? 0,
      codigoPuntoVenta: 0,
      search: search || undefined,
      page: page + 1,
      limit: rowsPerPage,
      fechaInicio: fechaInicio || undefined,
      fechaFin: fechaFin || undefined
    },
    !!selectedBranch
  )

  const handleSuccess = () => {
    setShowForm(false)
    setPage(0)
    refetch()
  }

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(0)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handlePrintInvoice = (factura: Factura) => {
    // Parsear detalles desde el XML si no existen
    let detalles = factura.detalles

    if (!detalles || detalles.length === 0) {
      // Parsear XML para extraer detalles
      const parser = new DOMParser()
      const xmlDoc = parser.parseFromString(factura.xml || '', 'text/xml')
      const detalleNodes = xmlDoc.querySelectorAll('detalle')

      detalles = Array.from(detalleNodes).map((node, index) => ({
        id: index + 1,
        actividadEconomica: node.querySelector('actividadEconomica')?.textContent || '',
        codigoProductoSin: parseInt(node.querySelector('codigoProductoSin')?.textContent || '0'),
        codigoProducto: node.querySelector('codigoProducto')?.textContent || '',
        descripcion: node.querySelector('descripcion')?.textContent || '',
        cantidad: parseFloat(node.querySelector('cantidad')?.textContent || '0'),
        unidadMedida: parseInt(node.querySelector('unidadMedida')?.textContent || '57'),
        precioUnitario: parseFloat(node.querySelector('precioUnitario')?.textContent || '0'),
        montoDescuento: parseFloat(node.querySelector('montoDescuento')?.textContent || '0'),
        subTotal: parseFloat(node.querySelector('subTotal')?.textContent || '0'),
        numeroSerie: node.querySelector('numeroSerie')?.textContent || null,
        numeroImei: node.querySelector('numeroImei')?.textContent || null
      }))
    }

    // Preparar factura con valores numéricos
    const facturaParaImprimir: Factura = {
      ...factura,
      montoTotal: parseFloat(String(factura.montoTotal)) || 0,
      montoTotalSujetoIva: parseFloat(String(factura.montoTotalSujetoIva)) || 0,
      descuentoAdicional: parseFloat(String(factura.descuentoAdicional)) || 0,
      montoGiftCard: parseFloat(String(factura.montoGiftCard)) || 0,
      codigoEmision: parseInt(String(factura.codigoEmision)) || 1,
      detalles
    }

    printInvoice(facturaParaImprimir)
  }

  const handlePrintBluetoothInvoice = async (factura: Factura) => {
    if (!isBluetoothAvailable()) {
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost'

      if (!isSecure) {
        setBtMessage({ text: 'Requiere HTTPS. Sube a producción o usa localhost.', type: 'error' })
      } else {
        setBtMessage({ text: 'Bluetooth no disponible en este navegador.', type: 'error' })
      }

      return
    }

    setBtPrinting(factura.id)
    setBtMessage(null)

    try {
      let detalles = factura.detalles

      if (!detalles || detalles.length === 0) {
        const parser = new DOMParser()
        const xmlDoc = parser.parseFromString(factura.xml || '', 'text/xml')
        const detalleNodes = xmlDoc.querySelectorAll('detalle')

        detalles = Array.from(detalleNodes).map((node, index) => ({
          id: index + 1,
          actividadEconomica: node.querySelector('actividadEconomica')?.textContent || '',
          codigoProductoSin: parseInt(node.querySelector('codigoProductoSin')?.textContent || '0'),
          codigoProducto: node.querySelector('codigoProducto')?.textContent || '',
          descripcion: node.querySelector('descripcion')?.textContent || '',
          cantidad: parseFloat(node.querySelector('cantidad')?.textContent || '0'),
          unidadMedida: parseInt(node.querySelector('unidadMedida')?.textContent || '57'),
          precioUnitario: parseFloat(node.querySelector('precioUnitario')?.textContent || '0'),
          montoDescuento: parseFloat(node.querySelector('montoDescuento')?.textContent || '0'),
          subTotal: parseFloat(node.querySelector('subTotal')?.textContent || '0'),
          numeroSerie: node.querySelector('numeroSerie')?.textContent || null,
          numeroImei: node.querySelector('numeroImei')?.textContent || null
        }))
      }

      const facturaParaImprimir: Factura = {
        ...factura,
        montoTotal: parseFloat(String(factura.montoTotal)) || 0,
        montoTotalSujetoIva: parseFloat(String(factura.montoTotalSujetoIva)) || 0,
        descuentoAdicional: parseFloat(String(factura.descuentoAdicional)) || 0,
        montoGiftCard: parseFloat(String(factura.montoGiftCard)) || 0,
        codigoEmision: parseInt(String(factura.codigoEmision)) || 1,
        detalles
      }

      await printInvoiceBluetooth(facturaParaImprimir)

      const deviceName = getConnectedDeviceName()

      setBtMessage({ text: `Impreso en ${deviceName || 'impresora BT'}`, type: 'success' })
    } catch (error) {
      console.error('Error imprimiendo via Bluetooth:', error)
      setBtMessage({
        text: error instanceof Error ? error.message : 'Error al imprimir',
        type: 'error'
      })
    } finally {
      setBtPrinting(null)
    }
  }

  const handleAnularFactura = () => {
    if (!selectedFactura) return

    anularFacturaMutation.mutate(
      { facturaId: selectedFactura.id, codigoMotivo: motivoAnulacion },
      {
        onSuccess: () => {
          setShowAnularConfirm(false)
          setSelectedFactura(null)
          refetch()
        }
      }
    )
  }

  const handleRevertirAnulacion = () => {
    if (!selectedFactura) return

    revertirAnulacionMutation.mutate(selectedFactura.id, {
      onSuccess: () => {
        setShowRevertirConfirm(false)
        setSelectedFactura(null)
        refetch()
      }
    })
  }

  const facturas = facturasData?.data ?? []

  if (isLoadingBranches) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant='rectangular' height={400} />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Facturación Online'
          subheader='Emita facturas para otras sucursales'
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => setShowForm(true)}
              disabled={!selectedBranch}
            >
              Nueva Factura
            </Button>
          }
        />
        <CardContent>
          {/* Filtros */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl size='small' sx={{ minWidth: 200 }}>
              <InputLabel>Sucursal *</InputLabel>
              <Select
                value={selectedBranchId}
                label='Sucursal *'
                onChange={e => {
                  setSelectedBranchId(e.target.value as number)
                  setPage(0)
                }}
              >
                {filteredBranches.map((branch: Branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.alias} (Sucursal {branch.codigoSucursal})
                </MenuItem>
              ))}
              </Select>
            </FormControl>

            <TextField
              size='small'
              placeholder='Buscar por NIT, nombre...'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!selectedBranch}
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <IconButton size='small' onClick={handleSearch} disabled={!selectedBranch}>
                      <i className='tabler-search' />
                    </IconButton>
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 250 }}
            />

            <TextField
              size='small'
              type='date'
              label='Fecha Inicio'
              value={fechaInicio}
              onChange={e => {
                setFechaInicio(e.target.value)
                setPage(0)
              }}
              disabled={!selectedBranch}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />

            <TextField
              size='small'
              type='date'
              label='Fecha Fin'
              value={fechaFin}
              onChange={e => {
                setFechaFin(e.target.value)
                setPage(0)
              }}
              disabled={!selectedBranch}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
          </Box>

          {!selectedBranch ? (
            <Alert severity='info'>Seleccione una sucursal para ver las facturas</Alert>
          ) : isLoading ? (
            <Skeleton variant='rectangular' height={300} />
          ) : error ? (
            <Alert severity='error'>Error al cargar las facturas</Alert>
          ) : facturas.length === 0 ? (
            <Alert severity='info'>No hay facturas para mostrar</Alert>
          ) : (
            <>
              <Box sx={{ mb: 2, p: 2, bgcolor: 'primary.main', borderRadius: 1 }}>
                <Typography variant='h6' color='white'>
                  Total Facturado: Bs. {facturasData?.totalFacturado?.toFixed(2) ?? '0.00'}
                </Typography>
              </Box>
              <div className='overflow-x-auto'>
                <table className='w-full'>
                  <thead>
                    <tr className='border-b border-t'>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Nro. Factura
                        </Typography>
                      </th>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Fecha Emisión
                        </Typography>
                      </th>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Cliente
                        </Typography>
                      </th>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Monto
                        </Typography>
                      </th>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Estado
                        </Typography>
                      </th>
                      <th className='text-left p-4'>
                        <Typography variant='body2' className='font-semibold'>
                          Acciones
                        </Typography>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map((factura: Factura) => (
                      <tr key={factura.id} className='border-b hover:bg-actionHover transition-colors'>
                        <td className='p-4'>
                          <Typography variant='body2' fontWeight='bold'>
                            #{factura.numeroFactura}
                          </Typography>
                        </td>
                        <td className='p-4'>
                          <Typography variant='body2'>
                            {dayjs(factura.fechaEmision).format('DD/MM/YYYY HH:mm')}
                          </Typography>
                        </td>
                        <td className='p-4'>
                          <Box>
                            <Typography variant='body2' fontWeight='medium'>
                              {factura.nombreRazonSocial}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {factura.numeroDocumento}
                            </Typography>
                          </Box>
                        </td>
                        <td className='p-4'>
                          <Typography variant='body2' fontWeight='bold' color='primary'>
                            Bs. {parseFloat(String(factura.montoTotal)).toFixed(2)}
                          </Typography>
                        </td>
                        <td className='p-4'>
                          <Chip
                            label={factura.estado}
                            color={getEstadoColor(factura.estado)}
                            size='small'
                            variant='tonal'
                          />
                        </td>
                        <td className='p-4'>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title='Imprimir (navegador)'>
                              <IconButton
                                size='small'
                                color='primary'
                                onClick={() => handlePrintInvoice(factura)}
                              >
                                <i className='tabler-printer' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isBluetoothConnected() ? `Imprimir BT (${getConnectedDeviceName()})` : 'Imprimir Bluetooth'}>
                              <span>
                                <IconButton
                                  size='small'
                                  color='secondary'
                                  onClick={() => handlePrintBluetoothInvoice(factura)}
                                  disabled={btPrinting === factura.id}
                                >
                                  {btPrinting === factura.id ? (
                                    <CircularProgress size={18} />
                                  ) : (
                                    <i className='tabler-bluetooth' />
                                  )}
                                </IconButton>
                              </span>
                            </Tooltip>
                            {factura.estado === 'VALIDADA' && (
                              <IconButton
                                size='small'
                                color='error'
                                onClick={() => {
                                  setSelectedFactura(factura)
                                  setShowAnularConfirm(true)
                                }}
                                title='Anular'
                              >
                                <i className='tabler-x' />
                              </IconButton>
                            )}
                            {factura.estado === 'ANULADA' && (
                              <IconButton
                                size='small'
                                color='warning'
                                onClick={() => {
                                  setSelectedFactura(factura)
                                  setShowRevertirConfirm(true)
                                }}
                                title='Revertir Anulación'
                              >
                                <i className='tabler-restore' />
                              </IconButton>
                            )}
                          </Box>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                component='div'
                count={facturasData?.meta?.total ?? 0}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage='Filas por página'
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de Nueva Factura */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth='md' fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box component='span' sx={{ fontWeight: 'bold' }}>
            Nueva Factura
          </Box>
          <IconButton onClick={() => setShowForm(false)} size='small'>
            <i className='tabler-x' />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedBranch && (
            <FacturacionForm branch={selectedBranch} onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de anulación */}
      <Dialog open={showAnularConfirm} onClose={() => setShowAnularConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Anular Factura</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>¿Está seguro de anular la factura #{selectedFactura?.numeroFactura}?</Typography>

          <FormControl fullWidth size='small'>
            <InputLabel>Motivo de Anulación *</InputLabel>
            <Select
              value={motivoAnulacion}
              label='Motivo de Anulación *'
              onChange={e => setMotivoAnulacion(e.target.value as number)}
            >
              <MenuItem value={1}>FACTURA MAL EMITIDA</MenuItem>
              <MenuItem value={2}>NOTA DE CREDITO-DEBITO MAL EMITIDA</MenuItem>
              <MenuItem value={3}>DATOS DE EMISION INCORRECTOS</MenuItem>
              <MenuItem value={4}>FACTURA O NOTA DE CREDITO-DEBITO DEVUELTA</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant='outlined'
              fullWidth
              onClick={() => setShowAnularConfirm(false)}
              disabled={anularFacturaMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant='contained'
              color='error'
              fullWidth
              onClick={handleAnularFactura}
              disabled={anularFacturaMutation.isPending}
            >
              {anularFacturaMutation.isPending ? 'Anulando...' : 'Anular'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de reversión */}
      <Dialog open={showRevertirConfirm} onClose={() => setShowRevertirConfirm(false)} maxWidth='xs' fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'warning.main' }}>Revertir Anulación</DialogTitle>
        <DialogContent>
          <Alert severity='error' sx={{ mb: 2 }}>
            Una vez revertida la factura, no podrá volver a anularla.
          </Alert>
          <Typography>
            ¿Está seguro de revertir la anulación de la factura #{selectedFactura?.numeroFactura}?
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant='outlined'
              fullWidth
              onClick={() => setShowRevertirConfirm(false)}
              disabled={revertirAnulacionMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              variant='contained'
              color='warning'
              fullWidth
              onClick={handleRevertirAnulacion}
              disabled={revertirAnulacionMutation.isPending}
            >
              {revertirAnulacionMutation.isPending ? 'Revirtiendo...' : 'Revertir'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Snackbar para mensajes de impresión Bluetooth */}
      <Snackbar
        open={!!btMessage}
        autoHideDuration={4000}
        onClose={() => setBtMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setBtMessage(null)}
          severity={btMessage?.type === 'success' ? 'success' : 'error'}
          sx={{ width: '100%' }}
        >
          {btMessage?.text}
        </Alert>
      </Snackbar>
    </>
  )
}

export default FacturacionList
