'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid2'
import Skeleton from '@mui/material/Skeleton'

// Type Imports
import type { ThemeColor } from '@core/types'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Hooks
import {
  useDashboardOrdersCount,
  useDashboardCustomersCount,
  useDashboardProductsCount
} from '@/hooks/useDashboard'

type DataType = {
  icon: string
  stats: string | number
  title: string
  color: ThemeColor
  isLoading?: boolean
}

const TarjetaEstadisticas = () => {
  const { data: ordersCount, isLoading: isLoadingOrders } = useDashboardOrdersCount()
  const { data: customersCount, isLoading: isLoadingCustomers } = useDashboardCustomersCount()
  const { data: productsCount, isLoading: isLoadingProducts } = useDashboardProductsCount()

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`

    return num.toString()
  }

  const data: DataType[] = [
    {
      stats: ordersCount ? formatNumber(ordersCount) : '0',
      title: 'Órdenes',
      color: 'primary',
      icon: 'tabler-chart-pie-2',
      isLoading: isLoadingOrders
    },
    {
      color: 'info',
      stats: customersCount ? formatNumber(customersCount) : '0',
      title: 'Clientes',
      icon: 'tabler-users',
      isLoading: isLoadingCustomers
    },
    {
      color: 'error',
      stats: productsCount ? formatNumber(productsCount) : '0',
      title: 'Productos',
      icon: 'tabler-shopping-cart',
      isLoading: isLoadingProducts
    },
    {
      stats: ordersCount ? formatNumber(ordersCount) : '0',
      color: 'success',
      title: 'Ventas',
      icon: 'tabler-currency-dollar',
      isLoading: isLoadingOrders
    }
  ]

  return (
    <Card>
      <CardHeader
        title='Estadísticas'
        action={
          <Typography variant='subtitle2' color='text.disabled'>
            Actualizado ahora
          </Typography>
        }
      />
      <CardContent className='flex justify-between flex-wrap gap-4 md:pbs-10 max-md:pbe-6 max-[1060px]:pbe-[74px] max-[1200px]:pbe-[52px] max-[1320px]:pbe-[74px] max-[1501px]:pbe-[52px]'>
        <Grid container spacing={4} sx={{ inlineSize: '100%' }}>
          {data.map((item, index) => (
            <Grid key={index} size={{ xs: 6, sm: 3 }} className='flex items-center gap-4'>
              <CustomAvatar color={item.color} variant='rounded' size={40} skin='light'>
                <i className={item.icon}></i>
              </CustomAvatar>
              <div className='flex flex-col'>
                {item.isLoading ? (
                  <>
                    <Skeleton variant='text' width={60} height={32} />
                    <Skeleton variant='text' width={80} height={20} />
                  </>
                ) : (
                  <>
                    <Typography variant='h5'>{item.stats}</Typography>
                    <Typography variant='body2'>{item.title}</Typography>
                  </>
                )}
              </div>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}

export default TarjetaEstadisticas
