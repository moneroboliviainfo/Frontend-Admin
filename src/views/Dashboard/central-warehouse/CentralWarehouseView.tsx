'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import { pendingReviewHint, useCentralWarehouseAlerts } from '@/hooks/useCentralWarehouseAlerts'
import CentralWarehouseTable from './CentralWarehouseTable'
import DispatchHistoryTable from './DispatchHistoryTable'
import ReturnsTable from '@/views/Dashboard/returns/ReturnsTable'

const CentralWarehouseView = () => {
  const [tab, setTab] = useState('stock')

  // Las devoluciones avisan desde acá: la tabla es compartida con la tienda y
  // no trae su propio snackbar
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null)

  // Solo los faltantes por revisar: es lo unico de Envios que espera al admin
  const { pendingReview, returnsToReceive } = useCentralWarehouseAlerts()

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab value='stock' label='Stock Bodega Central' />
        <Tab
          value='dispatches'
          label={
            <Box className='flex items-center gap-2'>
              <span>Envíos</span>
              {pendingReview > 0 && (
                <Tooltip title={pendingReviewHint(pendingReview)} arrow>
                  <Chip label={pendingReview} size='small' variant='tonal' color='warning' />
                </Tooltip>
              )}
            </Box>
          }
        />
        <Tab
          value='returns'
          label={
            <Box className='flex items-center gap-2'>
              <span>Devoluciones</span>
              {returnsToReceive > 0 && (
                <Chip label={returnsToReceive} size='small' variant='tonal' color='warning' />
              )}
            </Box>
          }
        />
      </TabList>

      <TabPanel value='stock' sx={{ p: 0 }}>
        <CentralWarehouseTable />
      </TabPanel>

      <TabPanel value='returns' sx={{ p: 0 }}>
        <ReturnsTable kind='central' showMessage={(message, severity) => setSnackbar({ message, severity })} />
      </TabPanel>

      <TabPanel value='dispatches' sx={{ p: 0 }}>
        <DispatchHistoryTable />
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

export default CentralWarehouseView
