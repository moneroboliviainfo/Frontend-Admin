'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { usePendingCount, useTransferCount } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'
import AwaitingPickupTable from '@/views/Dashboard/receptions/AwaitingPickupTable'
import ReceptionsTable from '@/views/Dashboard/receptions/ReceptionsTable'
import RefundsTable from '@/views/Dashboard/receptions/RefundsTable'
import ToDispatchTable from '@/views/Dashboard/receptions/ToDispatchTable'
import AdminRequestsTable from './AdminRequestsTable'

const TabLabel = ({
  text,
  count,
  color
}: {
  text: string
  count: number
  color: 'primary' | 'warning' | 'success' | 'error'
}) => (
  <Box className='flex items-center gap-2'>
    <span>{text}</span>
    {count > 0 && <Chip label={count} size='small' variant='tonal' color={color} />}
  </Box>
)

// Las cuatro pestañas son etapas del mismo tramite: un pedido de tienda a tienda para un cliente
const StoreRequestsView = () => {
  const [tab, setTab] = useState('mine')

  // Sin branchId: el back resuelve la sucursal del usuario
  const { data: pending } = usePendingCount()

  // toReceive suma envios de la central y pedidos: aca solo cuentan los pedidos
  const toReceive = useTransferCount({ direction: 'incoming', type: 'branch_request', status: 'in_transit' })

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab value='mine' label={<TabLabel text='Mis pedidos' count={toReceive} color='primary' />} />
        <Tab
          value='dispatch'
          label={<TabLabel text='Pedidos de Sucursales' count={pending?.toDispatch || 0} color='warning' />}
        />
        <Tab
          value='pickup'
          label={<TabLabel text='Para entregar' count={pending?.awaitingPickup || 0} color='success' />}
        />
        <Tab
          value='refunds'
          label={<TabLabel text='Devoluciones' count={pending?.pendingRefunds || 0} color='error' />}
        />
      </TabList>

      <TabPanel value='mine' sx={{ p: 0 }}>
        <ReceptionsTable kind='requests' />
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

const BranchRequestsView = () => {
  const { isAdminLike } = useUserRole()

  // La central no pide ni despacha pedidos: solo los vigila
  return isAdminLike ? <AdminRequestsTable /> : <StoreRequestsView />
}

export default BranchRequestsView
