'use client'

import { useMemo, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TablePagination from '@mui/material/TablePagination'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'

import CustomTextField from '@core/components/mui/TextField'
import { useBranchesAdmin } from '@/hooks/useBranchAdmin'
import tableStyles from '@core/styles/table.module.css'
import BranchFormDialog from './BranchFormDialog'
import BranchEditDialog from './BranchEditDialog'

const BranchListTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null)

  const queryParams = useMemo(() => ({ limit: pageSize, page }), [pageSize, page])

  const { data, isLoading, isError, error, refetch } = useBranchesAdmin(queryParams)

  const branches = data?.branches || []
  const total = data?.total || 0

  if (isError) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            Error al cargar las sucursales: {error instanceof Error ? error.message : 'Error desconocido'}
          </Alert>
        </Box>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Sucursales'
        action={
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setCreateOpen(true)}>
            Nueva Sucursal
          </Button>
        }
      />

      <Box className='flex flex-wrap justify-end gap-4 p-6'>
        <CustomTextField
          select
          value={pageSize}
          onChange={e => {
            setPageSize(Number(e.target.value))
            setPage(1)
          }}
          className='is-[70px]'
          size='small'
        >
          <MenuItem value={10}>10</MenuItem>
          <MenuItem value={25}>25</MenuItem>
          <MenuItem value={50}>50</MenuItem>
        </CustomTextField>
      </Box>

      <div className='overflow-x-auto'>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Facturación SIAT</th>
              <th>Acciones</th>
            </tr>
          </thead>
          {isLoading ? (
            <tbody>
              {Array.from({ length: pageSize }).map((_, index) => (
                <tr key={index}>
                  {Array.from({ length: 5 }).map((_, colIndex) => (
                    <td key={colIndex} className='p-4'>
                      <Skeleton variant='text' width='100%' height={20} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : branches.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={5} className='text-center'>
                  <Typography color='text.secondary' sx={{ py: 4 }}>
                    No hay sucursales registradas
                  </Typography>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {branches.map(branch => (
                <tr key={branch.id}>
                  <td className={tableStyles.cell}>
                    <Typography color='text.primary'>{branch.id}</Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Typography className='font-medium' color='text.primary'>
                      {branch.name}
                    </Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Chip
                      label={branch.active ? 'Activa' : 'Inactiva'}
                      color={branch.active ? 'success' : 'error'}
                      size='small'
                    />
                  </td>
                  <td className={tableStyles.cell}>
                    <Chip
                      label={branch.siatBranch ? 'Configurada' : 'Sin configurar'}
                      color={branch.siatBranch ? 'info' : 'default'}
                      size='small'
                      variant='tonal'
                    />
                  </td>
                  <td className={tableStyles.cell}>
                    <IconButton size='small' color='primary' onClick={() => setEditingBranchId(branch.id)}>
                      <i className='tabler-edit' />
                    </IconButton>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>

      <TablePagination
        component='div'
        count={total}
        rowsPerPage={pageSize}
        page={page - 1}
        onPageChange={(_, newPage) => setPage(newPage + 1)}
        onRowsPerPageChange={event => {
          setPageSize(parseInt(event.target.value, 10))
          setPage(1)
        }}
        rowsPerPageOptions={[10, 25, 50]}
        labelRowsPerPage='Filas por página:'
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
      />

      <BranchFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={refetch} />
      <BranchEditDialog branchId={editingBranchId} onClose={() => setEditingBranchId(null)} onSuccess={refetch} />
    </Card>
  )
}

export default BranchListTable
