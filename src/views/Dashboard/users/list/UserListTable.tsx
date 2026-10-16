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
import { useUsers } from '@/hooks/useUsers'
import type { StaffUser } from '@/types/api/staffUser'
import tableStyles from '@core/styles/table.module.css'
import UserFormDialog from './UserFormDialog'
import UserEditDialog from './UserEditDialog'

const roleLabels: Record<StaffUser['rol'], string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  manager: 'Encargado',
  cashier: 'Cajero'
}

const roleColors: Record<StaffUser['rol'], 'primary' | 'info' | 'secondary' | 'warning'> = {
  admin: 'primary',
  supervisor: 'warning',
  manager: 'info',
  cashier: 'secondary'
}

const UserListTable = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)

  const queryParams = useMemo(() => ({ limit: pageSize, page }), [pageSize, page])

  const { data, isLoading, isError, error, refetch } = useUsers(queryParams)

  const users = data?.users || []
  const total = data?.total || 0

  if (isError) {
    return (
      <Card>
        <Box sx={{ p: 4 }}>
          <Alert severity='error'>
            Error al cargar los usuarios: {error instanceof Error ? error.message : 'Error desconocido'}
          </Alert>
        </Box>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='Usuarios'
        action={
          <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setCreateOpen(true)}>
            Nuevo Usuario
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
              <th>Email</th>
              <th>Rol</th>
              <th>Sucursal</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          {isLoading ? (
            <tbody>
              {Array.from({ length: pageSize }).map((_, index) => (
                <tr key={index}>
                  {Array.from({ length: 7 }).map((_, colIndex) => (
                    <td key={colIndex} className='p-4'>
                      <Skeleton variant='text' width='100%' height={20} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : users.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={7} className='text-center'>
                  <Typography color='text.secondary' sx={{ py: 4 }}>
                    No hay usuarios registrados
                  </Typography>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td className={tableStyles.cell}>
                    <Typography color='text.primary'>{user.id}</Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Typography className='font-medium' color='text.primary'>
                      {user.name}
                    </Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Typography color='text.secondary'>{user.email}</Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Chip label={roleLabels[user.rol]} color={roleColors[user.rol]} size='small' variant='tonal' />
                  </td>
                  <td className={tableStyles.cell}>
                    <Typography color='text.secondary'>{user.branch?.name || '—'}</Typography>
                  </td>
                  <td className={tableStyles.cell}>
                    <Chip
                      label={user.enabled ? 'Activo' : 'Inactivo'}
                      color={user.enabled ? 'success' : 'error'}
                      size='small'
                    />
                  </td>
                  <td className={tableStyles.cell}>
                    <IconButton size='small' color='primary' onClick={() => setEditingUserId(user.id)}>
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

      <UserFormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={refetch} />
      <UserEditDialog userId={editingUserId} onClose={() => setEditingUserId(null)} onSuccess={refetch} />
    </Card>
  )
}

export default UserListTable
