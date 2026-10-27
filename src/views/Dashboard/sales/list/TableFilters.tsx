'use client'


import { MenuItem } from '@mui/material'

import CustomTextField from '@core/components/mui/TextField'

interface TableFiltersProps {
  typeFilter: string
  setTypeFilter: (value: string) => void
  startDate: string
  setStartDate: (value: string) => void
  endDate: string
  setEndDate: (value: string) => void
  paymentTypeFilter: string
  setPaymentTypeFilter: (value: string) => void
}

const TableFilters = ({
  typeFilter,
  setTypeFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  paymentTypeFilter,
  setPaymentTypeFilter
}: TableFiltersProps) => {
  const today = new Date().toISOString().split('T')[0]

  const handleStartDateChange = (value: string) => {
    setStartDate(value)

    if (endDate && value && endDate < value) {
      setEndDate('')
    }
  }

  return (
    <div className='flex flex-wrap gap-4 p-6 pbs-0'>
      <CustomTextField
        select
        fullWidth
        id='type-filter'
        value={typeFilter}
        onChange={e => setTypeFilter(e.target.value)}
        className='max-sm:is-full sm:is-[200px]'
        label='Tipo de Venta'
      >
        <MenuItem value='all'>Todos</MenuItem>
        <MenuItem value='in_store'>En Tienda</MenuItem>
        <MenuItem value='online'>En Línea</MenuItem>
      </CustomTextField>

      <CustomTextField
        select
        fullWidth
        id='payment-type-filter'
        value={paymentTypeFilter}
        onChange={e => setPaymentTypeFilter(e.target.value)}
        className='max-sm:is-full sm:is-[200px]'
        label='Método de Pago'
      >
        <MenuItem value='all'>Todos</MenuItem>
        <MenuItem value='cash'>Efectivo</MenuItem>
        <MenuItem value='card'>Tarjeta</MenuItem>
        <MenuItem value='qr'>QR</MenuItem>
      </CustomTextField>

      <CustomTextField
        type='date'
        fullWidth
        id='start-date'
        value={startDate}
        onChange={e => handleStartDateChange(e.target.value)}
        className='max-sm:is-full sm:is-[200px]'
        label='Fecha Inicio'
        InputLabelProps={{ shrink: true }}
        inputProps={{
          max: today
        }}
      />

      <CustomTextField
        type='date'
        fullWidth
        id='end-date'
        value={endDate}
        onChange={e => setEndDate(e.target.value)}
        className='max-sm:is-full sm:is-[200px]'
        label='Fecha Fin'
        InputLabelProps={{ shrink: true }}
        disabled={!startDate}
        inputProps={{
          min: startDate || undefined,
          max: today
        }}
      />
    </div>
  )
}

export default TableFilters
