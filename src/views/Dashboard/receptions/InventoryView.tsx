'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { useTransferCount } from '@/hooks/useBranchTransfers'
import BranchStockTable from './BranchStockTable'
import ReceptionsTable from './ReceptionsTable'
import ReturnToWarehouseForm from '@/views/Dashboard/returns/ReturnToWarehouseForm'
import ReturnsTable from '@/views/Dashboard/returns/ReturnsTable'

// Solo la mercaderia de la tienda: lo que tiene y lo que le manda la central.
// Los pedidos entre sucursales y las reposiciones tienen su propio menu.
const InventoryView = () => {
  const [tab, setTab] = useState('stock')

  // La pantalla de devolver y su lista comparten este aviso
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // Sin branchId: el back resuelve la sucursal del usuario
  const toReceive = useTransferCount({ direction: 'incoming', type: 'central_dispatch', status: 'in_transit' })

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab value='stock' label='Stock' />
        <Tab
          value='receptions'
          label={
            <Box className='flex items-center gap-2'>
              <span>Envíos de la central</span>
              {toReceive > 0 && <Chip label={toReceive} size='small' variant='tonal' color='primary' />}
            </Box>
          }
        />
        <Tab value='returns' label='Devolver a bodega' />
      </TabList>

      <TabPanel value='stock' sx={{ p: 0 }}>
        <BranchStockTable />
      </TabPanel>

      <TabPanel value='receptions' sx={{ p: 0 }}>
        <ReceptionsTable kind='central' />
      </TabPanel>
      <TabPanel value='returns' sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ReturnToWarehouseForm showMessage={(message, severity) => setSnackbar({ message, severity })} />
          <ReturnsTable kind='branch' showMessage={(message, severity) => setSnackbar({ message, severity })} />
        </Box>
      </TabPanel>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar?.severity} onClose={() => setSnackbar(null)}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </TabContext>
  )
}

export default InventoryView
