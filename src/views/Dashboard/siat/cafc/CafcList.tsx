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
import LinearProgress from '@mui/material/LinearProgress'
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

import { useCafcs } from '@/hooks/useSales'
import type { Cafc } from '@/types/api/sales'
import CafcForm from './CafcForm'

import tableStyles from '@core/styles/table.module.css'

const columnHelper = createColumnHelper<Cafc>()

const CafcList = () => {
  const { data: cafcs, isLoading, error, refetch } = useCafcs()
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

  const columns = useMemo<ColumnDef<Cafc, any>[]>(
    () => [
      columnHelper.accessor('codigo', {
        header: 'Código CAFC',
        cell: ({ row }) => (
          <Typography variant='body2' fontWeight='medium'>
            {row.original.codigo}
          </Typography>
        )
      }),
      columnHelper.accessor('numeroInicial', {
        header: 'Rango Inicial',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.numeroInicial}
          </Typography>
        )
      }),
      columnHelper.accessor('numeroFinal', {
        header: 'Rango Final',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {row.original.numeroFinal}
          </Typography>
        )
      }),
      columnHelper.accessor('ultimoNumero', {
        header: 'Uso',
        cell: ({ row }) => {
          const usado = parseInt(row.original.ultimoNumero)
          const total = parseInt(row.original.numeroFinal)
          const porcentajeUsado = (usado / total) * 100

          return (
            <Box sx={{ minWidth: 120 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant='caption'>{usado} / {total}</Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={porcentajeUsado}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: porcentajeUsado > 90 ? 'error.main' : porcentajeUsado > 70 ? 'warning.main' : 'success.main'
                  }
                }}
              />
            </Box>
          )
        }
      }),
      columnHelper.display({
        id: 'disponibles',
        header: 'Disponibles',
        cell: ({ row }) => {
          const usado = parseInt(row.original.ultimoNumero)
          const total = parseInt(row.original.numeroFinal)
          const disponible = total - usado

          return (
            <Typography variant='body2' fontWeight='medium' color={disponible > 0 ? 'success.main' : 'error.main'}>
              {disponible}
            </Typography>
          )
        }
      }),
      columnHelper.display({
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => {
          const usado = parseInt(row.original.ultimoNumero)
          const total = parseInt(row.original.numeroFinal)
          const disponible = total - usado

          if (disponible > 100) {
            return <Chip label='DISPONIBLE' color='success' size='small' />
          }

          if (disponible > 0) {
            return <Chip label='POCOS' color='warning' size='small' />
          }

          return <Chip label='AGOTADO' color='error' size='small' />
        }
      }),
      columnHelper.accessor('createdAt', {
        header: 'Fecha Registro',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {dayjs(row.original.createdAt).format('DD/MM/YYYY')}
          </Typography>
        )
      })
    ],
    []
  )

  // Paginación en el cliente
  const paginatedData = useMemo(() => {
    if (!cafcs) return []

    const start = page * rowsPerPage
    const end = start + rowsPerPage

    return cafcs.slice(start, end)
  }, [cafcs, page, rowsPerPage])

  const table = useReactTable({
    data: paginatedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  const totalRecords = cafcs?.length || 0

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
          <Alert severity='error'>Error al cargar códigos CAFC</Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardContent className='flex justify-between flex-wrap max-sm:flex-col sm:items-center gap-4'>
          <Typography variant='h6'>Códigos CAFC</Typography>
          <Button variant='contained' color='primary' onClick={() => setShowForm(true)}>
            + Registrar CAFC
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
                    No hay códigos CAFC registrados
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

        <CardContent>
          <Alert severity='info'>
            Los códigos CAFC son autorizaciones para facturar en modo contingencia (offline). Cuando los números se agoten, deberás solicitar un nuevo CAFC al SIAT.
          </Alert>
        </CardContent>
      </Card>

      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth='sm' fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant='h6'>Registrar Código CAFC</Typography>
            <IconButton onClick={() => setShowForm(false)} size='small'>
              <i className='tabler-x' />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <CafcForm onSuccess={handleSuccess} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CafcList
