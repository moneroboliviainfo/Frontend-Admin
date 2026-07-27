'use client'

import { useState, useMemo } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
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
import dayjs from 'dayjs'
import 'dayjs/locale/es'

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'
import classnames from 'classnames'

import { useEventosSignificativos } from '@/hooks/useSales'
import type { EventoSignificativo } from '@/types/api/sales'
import EventoForm from './EventoForm'

import tableStyles from '@core/styles/table.module.css'

const columnHelper = createColumnHelper<EventoSignificativo>()

const EventosList = () => {
  const { data: eventos, isLoading, error, refetch } = useEventosSignificativos()
  const [showForm, setShowForm] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

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

  const columns = useMemo<ColumnDef<EventoSignificativo, any>[]>(
    () => [
      columnHelper.accessor('fechaHoraInicioEvento', {
        header: 'Fecha/Hora',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography variant='body2' fontWeight='medium'>
              {dayjs(row.original.fechaHoraInicioEvento).format('DD/MM/YYYY')}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {dayjs(row.original.fechaHoraInicioEvento).format('HH:mm')} - {dayjs(row.original.fechaHoraFinEvento).format('HH:mm')}
            </Typography>
          </div>
        )
      }),
      columnHelper.accessor('descripcion', {
        header: 'Motivo',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.descripcion}
          </Typography>
        )
      }),
      columnHelper.accessor('codigoRecepcionEventoSignificativo', {
        header: 'Código Recepción',
        cell: ({ row }) => (
          <Typography variant='body2' sx={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.original.codigoRecepcionEventoSignificativo || 'N/A'}
          </Typography>
        )
      }),
      columnHelper.accessor('codigoSucursal', {
        header: 'Sucursal/PV',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.codigoSucursal} / {row.original.codigoPuntoVenta}
          </Typography>
        )
      }),
      columnHelper.accessor('transaccion', {
        header: 'Estado',
        cell: ({ row }) => (
          <Chip
            label={row.original.transaccion ? 'REGISTRADO' : 'PENDIENTE'}
            color={row.original.transaccion ? 'success' : 'warning'}
            size='small'
          />
        )
      }),
      columnHelper.accessor('fechaRespuesta', {
        header: 'Respuesta',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.fechaRespuesta
              ? dayjs(row.original.fechaRespuesta).format('DD/MM/YYYY HH:mm')
              : '-'}
          </Typography>
        )
      })
    ],
    []
  )

  // Paginación en el cliente
  const paginatedData = useMemo(() => {
    if (!eventos) return []

    const start = page * rowsPerPage
    const end = start + rowsPerPage

    return eventos.slice(start, end)
  }, [eventos, page, rowsPerPage])

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const totalRecords = eventos?.length || 0

  const renderSkeleton = () => (
    <tbody>
      {Array.from({ length: rowsPerPage }).map((_, index) => (
        <tr key={index}>
          {columns.map((_, colIndex) => (
            <td key={colIndex} className='p-4'>
              <Skeleton variant='text' width='100%' height={20} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity='error'>Error al cargar eventos significativos</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className='flex justify-between flex-wrap max-sm:flex-col sm:items-center gap-4'>
          <Typography variant='h6'>Eventos Significativos</Typography>
          <Button variant='contained' color='primary' onClick={() => setShowForm(true)}>
            + Registrar Evento
          </Button>
        </CardContent>

        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <div
                          className={classnames({
                            'flex items-center': header.column.getIsSorted(),
                            'cursor-pointer select-none': header.column.getCanSort()
                          })}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <i className='tabler-chevron-up text-xl' />,
                            desc: <i className='tabler-chevron-down text-xl' />
                          }[header.column.getIsSorted() as 'asc' | 'desc'] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {isLoading ? (
              renderSkeleton()
            ) : paginatedData.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={columns.length} className='text-center p-8'>
                    No hay eventos significativos registrados
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>

        <div className='flex justify-between items-center flex-wrap pli-6 border-bs bs-auto plb-[12.5px] gap-2'>
          <Typography color='text.disabled'>
            {`Mostrando ${totalRecords === 0 ? 0 : page * rowsPerPage + 1} a ${Math.min((page + 1) * rowsPerPage, totalRecords)} de ${totalRecords} registros`}
          </Typography>
          <TablePagination
            component='div'
            count={totalRecords}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[10, 25, 50]}
            labelRowsPerPage='Filas por página:'
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
          />
        </div>
      </Card>

      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant='h6'>Registrar Evento Significativo</Typography>
            <IconButton onClick={() => setShowForm(false)} size='small'>
              <i className='tabler-x' />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <EventoForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default EventosList
