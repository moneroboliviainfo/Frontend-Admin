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

import { usePaquetes, useValidarPaquete } from '@/hooks/useSales'
import type { Paquete } from '@/types/api/sales'
import PaqueteForm from './PaqueteForm'

import tableStyles from '@core/styles/table.module.css'

const columnHelper = createColumnHelper<Paquete>()

const PaquetesList = () => {
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [showForm, setShowForm] = useState(false)
  const [validandoPaqueteId, setValidandoPaqueteId] = useState<number | null>(null)

  const { data: paquetesData, isLoading, error, refetch } = usePaquetes({
    page: page + 1,
    limit: rowsPerPage
  })

  const validarPaqueteMutation = useValidarPaquete()

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

  const handleValidarPaquete = (paquete: Paquete) => {
    setValidandoPaqueteId(paquete.id)
    validarPaqueteMutation.mutate(paquete.id, {
      onSuccess: () => {
        refetch()
        setValidandoPaqueteId(null)
      },
      onError: () => {
        setValidandoPaqueteId(null)
      }
    })
  }

  const columns = useMemo<ColumnDef<Paquete, any>[]>(
    () => [
      columnHelper.accessor('id', {
        header: 'ID',
        cell: ({ row }) => (
          <Typography variant='body2' fontWeight='medium'>
            #{row.original.id}
          </Typography>
        )
      }),
      columnHelper.accessor('fechaEnvio', {
        header: 'Fecha Envío',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {dayjs(row.original.fechaEnvio).format('DD/MM/YYYY HH:mm')}
          </Typography>
        )
      }),
      columnHelper.accessor('cantidadFacturas', {
        header: 'Facturas',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.cantidadFacturas}
          </Typography>
        )
      }),
      columnHelper.accessor('codigoEvento', {
        header: 'Evento',
        cell: ({ row }) => (
          <Typography variant='body2'>
            #{row.original.codigoEvento}
          </Typography>
        )
      }),
      columnHelper.accessor('cafc', {
        header: 'CAFC',
        cell: ({ row }) => (
          <Typography variant='body2' sx={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.original.cafc}
          </Typography>
        )
      }),
      columnHelper.accessor('codigoDescripcion', {
        header: 'Estado',
        cell: ({ row }) => {
          const isValidada = row.original.codigoDescripcion === 'VALIDADA'
          const isPendiente = !row.original.codigoEstado

          if (isValidada) {
            return <Chip label='VALIDADA' color='success' size='small' />
          }

          if (isPendiente) {
            return <Chip label='PENDIENTE ENVÍO' color='warning' size='small' />
          }

          return <Chip label={row.original.codigoDescripcion || 'PROCESANDO'} color='info' size='small' />
        }
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const isValidada = row.original.codigoDescripcion === 'VALIDADA'

          if (!isValidada) {
            return (
              <Button
                variant='contained'
                color='primary'
                size='small'
                onClick={() => handleValidarPaquete(row.original)}
                disabled={validandoPaqueteId === row.original.id}
              >
                {validandoPaqueteId === row.original.id ? 'Validando...' : 'Validar'}
              </Button>
            )
          }

          return <Typography variant='body2' color='text.disabled'>-</Typography>
        }
      })
    ],
    [validandoPaqueteId]
  )

  const paquetes = paquetesData?.data || []
  const meta = paquetesData?.meta
  const totalRecords = meta?.total || 0

  const table = useReactTable({
    data: paquetes,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: meta?.lastPage || 1
  })

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
          <Alert severity='error'>Error al cargar paquetes</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className='flex justify-between flex-wrap max-sm:flex-col sm:items-center gap-4'>
          <Typography variant='h6'>Paquetes de Contingencia</Typography>
          <Button variant='contained' color='primary' onClick={() => setShowForm(true)}>
            + Crear Paquete
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
            ) : paquetes.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={columns.length} className='text-center p-8'>
                    No hay paquetes creados
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
            <Typography variant='h6'>Crear Paquete de Contingencia</Typography>
            <IconButton onClick={() => setShowForm(false)} size='small'>
              <i className='tabler-x' />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <PaqueteForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default PaquetesList
