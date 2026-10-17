'use client'

import { useEffect, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import { useRenameCentralWarehouse } from '@/hooks/useBranchTransfers'

type Props = {
  open: boolean
  currentName: string
  onClose: () => void
  showMessage: (message: string, severity: 'success' | 'error') => void
}

const RenameWarehouseModal = ({ open, currentName, onClose, showMessage }: Props) => {
  const [name, setName] = useState(currentName)

  const rename = useRenameCentralWarehouse()

  useEffect(() => {
    if (open) setName(currentName)
  }, [open, currentName])

  const handleConfirm = async () => {
    try {
      await rename.mutateAsync(name.trim())
      showMessage('Nombre actualizado', 'success')
      onClose()
    } catch (error: any) {
      showMessage(error?.response?.data?.message || 'No se pudo cambiar el nombre', 'error')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='xs' fullWidth>
      <DialogTitle>Renombrar bodega</DialogTitle>

      <DialogContent>
        <CustomTextField
          fullWidth
          autoFocus
          label='Nombre'
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) handleConfirm()
          }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color='secondary' disabled={rename.isPending}>
          Volver
        </Button>
        <Button
          onClick={handleConfirm}
          variant='contained'
          disabled={!name.trim() || name.trim() === currentName || rename.isPending}
          startIcon={rename.isPending ? <CircularProgress size={16} /> : undefined}
        >
          {rename.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RenameWarehouseModal
