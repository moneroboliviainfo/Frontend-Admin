'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { pendingReviewHint, useCentralWarehouseAlerts } from '@/hooks/useCentralWarehouseAlerts'
import CentralWarehouseTable from './CentralWarehouseTable'
import DispatchHistoryTable from './DispatchHistoryTable'

const CentralWarehouseView = () => {
  const [tab, setTab] = useState('stock')

  // Solo los faltantes por revisar: es lo unico de Envios que espera al admin
  const { pendingReview } = useCentralWarehouseAlerts()

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
      </TabList>

      <TabPanel value='stock' sx={{ p: 0 }}>
        <CentralWarehouseTable />
      </TabPanel>

      <TabPanel value='dispatches' sx={{ p: 0 }}>
        <DispatchHistoryTable />
      </TabPanel>
    </TabContext>
  )
}

export default CentralWarehouseView
