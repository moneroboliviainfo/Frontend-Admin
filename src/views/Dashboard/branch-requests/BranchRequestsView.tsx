'use client'

import { useEffect, useRef, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'

import { useBranchRequestAlerts } from '@/hooks/useBranchRequestAlerts'
import { useUserRole } from '@/hooks/useUserRole'
import AwaitingPickupTable from '@/views/Dashboard/receptions/AwaitingPickupTable'
import ReceptionsTable from '@/views/Dashboard/receptions/ReceptionsTable'
import RefundsTable from '@/views/Dashboard/receptions/RefundsTable'
import ToDispatchTable from '@/views/Dashboard/receptions/ToDispatchTable'
import AdminRequestsTable from './AdminRequestsTable'

type StoreTab = 'mine' | 'dispatch' | 'pickup' | 'refunds'

const TabLabel = ({
  text,
  count,
  color,
  hint
}: {
  text: string
  count: number
  color: 'primary' | 'warning' | 'success' | 'error'
  hint: string
}) => (
  <Box className='flex items-center gap-2'>
    <span>{text}</span>
    {count > 0 && (
      <Tooltip title={hint} arrow>
        <Chip label={count} size='small' variant='tonal' color={color} />
      </Tooltip>
    )}
  </Box>
)

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// Las cuatro pestañas son etapas del mismo tramite: un pedido de tienda a tienda para un cliente
const StoreRequestsView = () => {
  const [tab, setTab] = useState<StoreTab>('mine')
  const userPicked = useRef(false)

  const { toDispatch, toReceive, pendingRefunds, awaitingPickup } = useBranchRequestAlerts()

  // Al entrar se abre sola la pestaña que espera una accion, por urgencia: otra tienda
  // espera mi despacho > llego lo que pedi > le debo plata a un cliente.
  // Una sola vez, y nunca despues de que el usuario eligio una pestaña
  const urgent: StoreTab | null =
    toDispatch > 0 ? 'dispatch' : toReceive > 0 ? 'mine' : pendingRefunds > 0 ? 'refunds' : null

  useEffect(() => {
    if (userPicked.current || !urgent) return

    userPicked.current = true
    setTab(urgent)
  }, [urgent])

  return (
    <TabContext value={tab}>
      <TabList
        onChange={(_, value) => {
          userPicked.current = true
          setTab(value)
        }}
        sx={{ mb: 4 }}
      >
        <Tab
          value='mine'
          label={
            <TabLabel
              text='Mis pedidos'
              count={toReceive}
              color='primary'
              hint={`${plural(toReceive, 'pedido viene', 'pedidos vienen')} en camino: recíbalos al llegar.`}
            />
          }
        />
        <Tab
          value='dispatch'
          label={
            <TabLabel
              text='Pedidos de Sucursales'
              count={toDispatch}
              color='warning'
              hint={`${plural(toDispatch, 'pedido', 'pedidos')} de otras tiendas por despachar.`}
            />
          }
        />
        <Tab
          value='pickup'
          label={
            <TabLabel
              text='Pedidos Para Entregar'
              count={awaitingPickup}
              color='success'
              hint={`${plural(awaitingPickup, 'pedido espera', 'pedidos esperan')} que el cliente lo retire.`}
            />
          }
        />
        <Tab
          value='refunds'
          label={
            <TabLabel
              text='Devoluciones'
              count={pendingRefunds}
              color='error'
              hint={`${plural(pendingRefunds, 'cliente espera', 'clientes esperan')} la devolución de su anticipo.`}
            />
          }
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
