'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { usePendingCount } from '@/hooks/useBranchTransfers'
import AwaitingPickupTable from './AwaitingPickupTable'
import BranchStockTable from './BranchStockTable'
import RefundsTable from './RefundsTable'
import ReceptionsTable from './ReceptionsTable'
import ToDispatchTable from './ToDispatchTable'

const InventoryView = () => {
  const [tab, setTab] = useState('stock')

  // Sin branchId: el back resuelve la sucursal del usuario
  const { data: pending } = usePendingCount()

  const toReceive = pending?.toReceive || 0
  const toDispatch = pending?.toDispatch || 0
  const awaitingPickup = pending?.awaitingPickup || 0
  const pendingRefunds = pending?.pendingRefunds || 0

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab value='stock' label='Stock' />
        <Tab
          value='receptions'
          label={
            <Box className='flex items-center gap-2'>
              <span>Envios desde bodega Central</span>
              {toReceive > 0 && <Chip label={toReceive} size='small' variant='tonal' color='primary' />}
            </Box>
          }
        />
        <Tab
          value='dispatch'
          label={
            <Box className='flex items-center gap-2'>
              <span>Por enviar</span>
              {toDispatch > 0 && <Chip label={toDispatch} size='small' variant='tonal' color='warning' />}
            </Box>
          }
        />
        <Tab
          value='pickup'
          label={
            <Box className='flex items-center gap-2'>
              <span>Para entregar</span>
              {awaitingPickup > 0 && <Chip label={awaitingPickup} size='small' variant='tonal' color='success' />}
            </Box>
          }
        />
        <Tab
          value='refunds'
          label={
            <Box className='flex items-center gap-2'>
              <span>Devoluciones</span>
              {pendingRefunds > 0 && <Chip label={pendingRefunds} size='small' variant='tonal' color='error' />}
            </Box>
          }
        />
      </TabList>

      <TabPanel value='stock' sx={{ p: 0 }}>
        <BranchStockTable />
      </TabPanel>

      <TabPanel value='receptions' sx={{ p: 0 }}>
        <ReceptionsTable />
      </TabPanel>

      <TabPanel value='dispatch' sx={{ p: 0 }}>
        <ToDispatchTable />
      </TabPanel>

      <TabPanel value='pickup' sx={{ p: 0 }}>
        <AwaitingPickupTable />
      </TabPanel>

      <TabPanel value='refunds' sx={{ p: 0 }}>
        <RefundsTable />
      </TabPanel>
    </TabContext>
  )
}

export default InventoryView
