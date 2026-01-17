'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'
import CircularProgress from '@mui/material/CircularProgress'
import Button from '@mui/material/Button'

import { useOrders } from '@/hooks/useSales'
import { authService } from '@/services/authService'
import { getRoleFromEmail } from '@/utils/menuPermissions'
import { cartService } from '@/services/salesService'
import OrderDetailsModal from './SaleDetailsModal'
import TableFilters from './TableFilters'
import type { Order } from '@/types/api/sales'

const getEstadoColor = (estado: string): 'primary' | 'error' | 'success' | 'warning' => {
  switch (estado) {
    case 'pending':
      return 'warning'
    case 'cancelled':
      return 'error'
    case 'paid':
    case 'completed':
      return 'success'
    case 'confirmed':
      return 'primary'
    case 'sent':
      return 'success'
    case 'expired':
      return 'error'
    case 'cancelled_for_edit':
      return 'warning'
    default:
      return 'primary'
  }
}

const getEstadoLabel = (estado: string): string => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    cancelled: 'Cancelado',
    paid: 'Pagado',
    completed: 'Completado',
    confirmed: 'Confirmado',
    sent: 'Enviado',
    expired: 'Expirado',
    cancelled_for_edit: 'En Edición'
  }

  return labels[estado] || estado
}

const getRowBackgroundColor = (estado: string): string => {
  switch (estado) {
    case 'sent':
    case 'completed':
      return 'bg-green-50 hover:bg-green-100'
    case 'paid':
      return 'bg-yellow-50 hover:bg-yellow-100'
    case 'cancelled':
    case 'expired':
      return 'bg-red-50 hover:bg-red-100'
    case 'cancelled_for_edit':
      return 'bg-orange-50 hover:bg-orange-100'
    case 'pending':
      return 'bg-amber-50 hover:bg-amber-100'
    case 'confirmed':
      return 'bg-blue-50 hover:bg-blue-100'
    default:
      return 'hover:bg-actionHover'
  }
}

const getPaymentLabel = (paymentType: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    qr: 'QR'
  }

  return labels[paymentType] || paymentType
}

const getTipoLabel = (tipo: string): string => {
  return tipo === 'in_store' ? 'En Tienda' : 'En Línea'
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)

  return date.toLocaleDateString('es-BO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const OrdersListTable = () => {
  const userEmail = authService.getUserEmail()
  const userRole = getRoleFromEmail(userEmail)
  const isCashier = userRole === 'CASHIER'

  const [page, setPage] = useState(0)
  const [limit, setLimit] = useState(10)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [typeFilter, setTypeFilter] = useState(isCashier ? 'online' : 'all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)

  const { data, isLoading, isError } = useOrders({
    page: page + 1,
    limit,
    type: typeFilter === 'all' ? undefined : (typeFilter as 'in_store' | 'online'),
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    paymentType: paymentTypeFilter === 'all' ? undefined : (paymentTypeFilter as 'cash' | 'card' | 'qr')
  })

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setSelectedOrder(null)
  }

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleExportToExcel = async () => {
    try {
      setIsExporting(true)

      const blob = await cartService.exportToExcel({
        type: typeFilter === 'all' ? undefined : (typeFilter as 'in_store' | 'online'),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        paymentType: paymentTypeFilter === 'all' ? undefined : (paymentTypeFilter as 'cash' | 'card' | 'qr')
      })

      // Crear un URL para el blob y descargar el archivo
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = `ventas_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error al exportar a Excel:', error)
      alert('Error al generar el reporte de Excel')
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <Card className='flex justify-center items-center p-10'>
        <CircularProgress />
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className='p-6'>
        <Typography color='error'>Error al cargar las órdenes</Typography>
      </Card>
    )
  }

  const orders = data?.data || []
  const meta = data?.meta

  return (
    <>
      <Card>
        <CardHeader
          title='Filtros y Acciones'
          className='pbe-4'
          action={
            !isCashier && (
              <Button variant='contained' color='primary' onClick={handleExportToExcel} disabled={isExporting}>
                {isExporting ? 'Generando...' : 'Generar Reporte Excel '}
              </Button>
            )
          }
        />

        <TableFilters
          typeFilter={typeFilter}
          setTypeFilter={setTypeFilter}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          paymentTypeFilter={paymentTypeFilter}
          setPaymentTypeFilter={setPaymentTypeFilter}
        />

        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead>
              <tr className='border-b border-t'>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    ID
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Estado
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Tipo
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Método de Pago
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Fecha de Creación
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Total
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Items
                  </Typography>
                </th>
                <th className='text-left p-4'>
                  <Typography variant='body2' className='font-semibold'>
                    Cliente
                  </Typography>
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className='text-center p-8'>
                    <Typography color='text.secondary'>No hay órdenes disponibles</Typography>
                  </td>
                </tr>
              ) : (
                orders.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => handleRowClick(order)}
                    className={`border-b cursor-pointer transition-colors ${getRowBackgroundColor(order.status)}`}
                  >
                    <td className='p-4'>
                      <Typography variant='body2' className='font-medium'>
                        #{order.id}
                      </Typography>
                    </td>
                    <td className='p-4'>
                      <Chip
                        label={getEstadoLabel(order.status)}
                        variant='tonal'
                        color={getEstadoColor(order.status)}
                        size='small'
                      />
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2'>{getTipoLabel(order.type)}</Typography>
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2'>
                        {order.payment_type ? getPaymentLabel(order.payment_type) : '-'}
                      </Typography>
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2' color='text.secondary'>
                        {order.createdAt ? formatDate(order.createdAt) : '-'}
                      </Typography>
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2' className='font-semibold'>
                        Bs. {parseFloat(order.totalPrice).toFixed(2)}
                      </Typography>
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2'>{order.items.length} productos</Typography>
                    </td>
                    <td className='p-4'>
                      <Typography variant='body2' color='text.secondary'>
                        {order.customer?.name || 'N/A'}
                      </Typography>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          component='div'
          count={meta?.total || 0}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={limit}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage='Filas por página:'
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
        />
      </Card>

      <OrderDetailsModal open={modalOpen} onClose={handleCloseModal} order={selectedOrder} />
    </>
  )
}

export default OrdersListTable
