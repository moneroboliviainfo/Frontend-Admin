'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { useCentralWarehouse, usePendingCount } from '@/hooks/useBranchTransfers'
import CentralWarehouseTable from './CentralWarehouseTable'
import DispatchHistoryTable from './DispatchHistoryTable'

const CentralWarehouseView = () => {
  const [tab, setTab] = useState('stock')

  const { data: warehouse } = useCentralWarehouse()
  const { data: pending } = usePendingCount(warehouse?.id, !!warehouse?.id)

  // inTransit = salio de la bodega y nadie lo recibio todavia
  const inTransit = pending?.inTransit || 0
  const pendingReview = pending?.pendingReview || 0

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab value='stock' label='Stock' />
        <Tab
          value='dispatches'
          label={
            <Box className='flex items-center gap-2'>
              <span>Envíos</span>
              {inTransit > 0 && <Chip label={inTransit} size='small' variant='tonal' color='primary' />}
              {pendingReview > 0 && <Chip label={pendingReview} size='small' variant='tonal' color='warning' />}
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
