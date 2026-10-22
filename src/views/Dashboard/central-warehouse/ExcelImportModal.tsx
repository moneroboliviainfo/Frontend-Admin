'use client'

import { useEffect, useRef, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

import CustomTextField from '@core/components/mui/TextField'
import tableStyles from '@core/styles/table.module.css'
import { variantService } from '@/services/variantService'
import { branchTransferService } from '@/services/branchTransferService'
import type { ImportRowError, ImportStockResponse } from '@/types/api/variants'

export type ImportMode = 'stock' | 'dispatch'

type Props = {
  mode: ImportMode | null
  destinationBranch?: { id: number; name: string } | null
  onClose: () => void
  onDispatchCreated?: (transferId: number) => void
  showMessage: (message: string, severity: 'success' | 'error' | 'warning') => void
}

const download = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  window.URL.revokeObjectURL(url)
}

// El 400 con filas mal trae `errors`; el resto (archivo invalido, encabezados,
// limite de 300, 413 por tamaño) solo `message`.
const parseError = (error: any): { message: string; rows: ImportRowError[] } => {
  const data = error?.response?.data

  return {
    message: data?.message || 'No se pudo procesar el archivo',
    rows: Array.isArray(data?.errors) ? data.errors : []
  }
}

const ExcelImportModal = ({ mode, destinationBranch, onClose, onDispatchCreated, showMessage }: Props) => {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<ImportStockResponse | null>(null)
  const [error, setError] = useState<{ message: string; rows: ImportRowError[] } | null>(null)
  const [isWorking, setIsWorking] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)

  // Los services se llaman directo, sin useMutation: la invalidacion va a mano.
  // Las dos importaciones mueven stock de la bodega; el envio ademas crea un
  // traslado, que cambia listas y contadores.
  const queryClient = useQueryClient()

  const isDispatch = mode === 'dispatch'

  useEffect(() => {
    setFile(null)
    setNote('')
    setPreview(null)
    setError(null)
  }, [mode])

  const handleTemplate = async () => {
    setIsWorking(true)

    try {
      // La plantilla pide token: se baja como blob, no sirve un enlace directo
      const blob = isDispatch
        ? await branchTransferService.getDispatchImportTemplate(destinationBranch!.id)
        : await variantService.getImportStockTemplate()

      download(blob, isDispatch ? `envio-${destinationBranch!.name}.xlsx` : 'ingreso-stock.xlsx')
    } catch {
      showMessage('No se pudo descargar la plantilla', 'error')
    } finally {
      setIsWorking(false)
    }
  }

  const run = async (dryRun: boolean) => {
    if (!file) return

    setIsWorking(true)
    setError(null)

    try {
      const result = isDispatch
        ? await branchTransferService.importCentralDispatch(file, destinationBranch!.id, dryRun, note)
        : await variantService.importStock(file, dryRun)

      if (dryRun) {
        setPreview(result)

        return
      }

      ;['variants', 'variant', 'central-warehouse', 'variant-movements', 'branch-stock', 'branch-transfers'].forEach(
        key => queryClient.invalidateQueries({ queryKey: [key] })
      )

      showMessage(
        isDispatch
          ? `Envío creado con ${result.totalUnits} prendas`
          : `Ingresaron ${result.totalUnits} prendas a la bodega`,
        'success'
      )

      // Tras confirmar se sale de la pantalla: volver a subir el mismo archivo
      // duplica, y el backend no detecta repetidos
      if (isDispatch && result.transfer?.id) onDispatchCreated?.(result.transfer.id)
      onClose()
    } catch (err) {
      setError(parseError(err))
      setPreview(null)
    } finally {
      setIsWorking(false)
    }
  }

  const pickFile = (selected: File | null) => {
    setFile(selected)
    setPreview(null)
    setError(null)
  }

  return (
    <Dialog open={!!mode} onClose={isWorking ? undefined : onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        {isDispatch ? 'Enviar por Excel' : 'Ingresar stock por Excel'}
        {isDispatch && destinationBranch && (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            A {destinationBranch.name}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        <Alert severity='info' sx={{ mb: 4 }}>
          Descargue la plantilla, complete la última columna y súbala. Primero verá qué se va a grabar.
        </Alert>

        <Box className='flex flex-wrap items-center gap-3' sx={{ mb: 4 }}>
          <Button
            variant='outlined'
            startIcon={<i className='tabler-download' />}
            onClick={handleTemplate}
            disabled={isWorking}
          >
            Descargar plantilla
          </Button>

          <Button
            variant='outlined'
            startIcon={<i className='tabler-file-spreadsheet' />}
            onClick={() => inputRef.current?.click()}
            disabled={isWorking}
          >
            {file ? 'Cambiar archivo' : 'Elegir archivo'}
          </Button>

          <input
            ref={inputRef}
            type='file'
            accept='.xlsx'
            hidden
            onChange={e => pickFile(e.target.files?.[0] || null)}
          />

          {file && <Chip label={file.name} onDelete={isWorking ? undefined : () => pickFile(null)} />}
        </Box>

        {isDispatch && (
          <CustomTextField
            fullWidth
            label='Nota (opcional)'
            placeholder='Reposición de temporada'
            value={note}
            onChange={e => setNote(e.target.value)}
            sx={{ mb: 4 }}
          />
        )}

        {error && (
          <Alert severity='error' sx={{ mb: 4 }}>
            <AlertTitle>{error.message}</AlertTitle>
            {error.rows.length > 0 && (
              <div className='overflow-x-auto'>
                <table className={tableStyles.table}>
                  <thead>
                    <tr>
                      <th>Fila</th>
                      <th>Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {error.rows.map(row => (
                      <tr key={`${row.row}-${row.message}`}>
                        <td>{row.row}</td>
                        <td>{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Alert>
        )}

        {preview && (
          <>
            <Alert severity='success' sx={{ mb: 3 }}>
              <AlertTitle>
                {preview.totalUnits} prendas en {preview.lines.length} variantes
              </AlertTitle>
              Todavía no se grabó nada. Revise y confirme.
            </Alert>

            {preview.warnings?.map(warning => (
              <Alert key={warning} severity='warning' sx={{ mb: 2 }}>
                {warning}
              </Alert>
            ))}

            <div className='overflow-x-auto'>
              <table className={tableStyles.table}>
                <thead>
                  <tr>
                    <th>Prenda</th>
                    <th>Talla</th>
                    <th>Cantidad</th>
                    {isDispatch && <th>En bodega</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview.lines.map(line => (
                    <tr key={line.variantId}>
                      <td>
                        <Typography variant='body2'>
                          {line.product} · {line.color}
                        </Typography>
                      </td>
                      <td>{line.size}</td>
                      <td>
                        <Typography variant='body2' className='font-medium'>
                          {line.quantity}
                        </Typography>
                      </td>
                      {isDispatch && <td>{line.available ?? '—'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 4, gap: 2 }}>
        <Button onClick={onClose} color='secondary' disabled={isWorking}>
          Volver
        </Button>

        {preview ? (
          <Button
            variant='contained'
            color='success'
            onClick={() => run(false)}
            disabled={isWorking}
            startIcon={isWorking ? <CircularProgress size={16} /> : <i className='tabler-check' />}
          >
            {isWorking ? 'Grabando...' : isDispatch ? 'Crear el envío' : 'Confirmar ingreso'}
          </Button>
        ) : (
          <Button
            variant='contained'
            onClick={() => run(true)}
            disabled={!file || isWorking}
            startIcon={isWorking ? <CircularProgress size={16} /> : <i className='tabler-eye' />}
          >
            {isWorking ? 'Revisando...' : 'Ver qué se va a grabar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ExcelImportModal
