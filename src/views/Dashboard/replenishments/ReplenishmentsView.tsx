'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { usePendingCount } from '@/hooks/useBranchTransfers'
import { useUserRole } from '@/hooks/useUserRole'
import MyReplenishment from './MyReplenishment'
import PendingReplenishmentsTable from './PendingReplenishmentsTable'
import ReplenishmentHistoryTable from './ReplenishmentHistoryTable'

// Una reposicion es un pedido de la tienda a la central: la tienda pide, la central
// atiende o rechaza. Recibir lo que llego no vive aca sino en Inventario, que es el
// unico lugar donde entra mercaderia de la central
const ReplenishmentsView = () => {
  const { isAdminLike } = useUserRole()
  const [tab, setTab] = useState('current')

  // Central (sin branchId): cuantas tiendas esperan. Tienda: 1 si tiene la suya abierta
  const { data: pending } = usePendingCount()
  const replenishmentsPending = pending?.replenishmentsPending || 0

  return (
    <TabContext value={tab}>
      <TabList onChange={(_, value) => setTab(value)} sx={{ mb: 4 }}>
        <Tab
          value='current'
          label={
            <Box className='flex items-center gap-2'>
              <span>{isAdminLike ? 'Por atender' : 'Mi reposición'}</span>
              {replenishmentsPending > 0 && (
                <Chip
                  label={isAdminLike ? replenishmentsPending : 'Pendiente'}
                  size='small'
                  variant='tonal'
                  color='warning'
                />
              )}
            </Box>
          }
        />
        <Tab value='history' label='Historial' />
      </TabList>

      <TabPanel value='current' sx={{ p: 0 }}>
        {isAdminLike ? <PendingReplenishmentsTable /> : <MyReplenishment />}
      </TabPanel>

      <TabPanel value='history' sx={{ p: 0 }}>
        <ReplenishmentHistoryTable isCentral={isAdminLike} />
      </TabPanel>
    </TabContext>
  )
}

export default ReplenishmentsView
