'use client'

import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

import { useRouter } from 'next/navigation'

import { styled } from '@mui/material/styles'
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'

import { useSettings } from '@core/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types/api/auth'
import ChangePasswordDialog from './ChangePasswordDialog'

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador',
  SUPERVISOR: 'Supervisor',
  MANAGER: 'Encargado',
  CASHIER: 'Cajero'
}

const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

const UserDropdown = () => {
  const [open, setOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  const anchorRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { settings } = useSettings()
  const { logout, isLoggingOut, user } = useAuth()

  const handleDropdownOpen = () => {
    setOpen(!open)
  }

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent), url?: string) => {
    if (url) {
      router.push(url)
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleUserLogout = async () => {
    setOpen(false)
    logout()
  }

  return (
    <>
      <Badge
        ref={anchorRef}
        overlap='circular'
        badgeContent={<BadgeContentSpan onClick={handleDropdownOpen} />}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        className='mis-2'
      >
        <Avatar
          ref={anchorRef}
          alt='John Doe'
          src='/images/avatars/1.png'
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        />
      </Badge>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-3 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-6 gap-2' tabIndex={-1}>
                    <Avatar alt={user?.name || 'Usuario'} src='/images/avatars/1.png' />
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {user?.name || 'Usuario'}
                      </Typography>
                      <Typography variant='caption'>{user?.email || ''}</Typography>
                      {user?.role && (
                        <Chip
                          label={roleLabels[user.role]}
                          size='small'
                          color='primary'
                          variant='tonal'
                          className='mbs-1'
                        />
                      )}
                    </div>
                  </div>
                  <Divider className='mlb-1' />

                  <MenuItem
                    className='mli-2 gap-3'
                    onClick={() => {
                      setOpen(false)
                      setChangePasswordOpen(true)
                    }}
                  >
                    <i className='tabler-key' />
                    <Typography color='text.primary'>Cambiar Contraseña</Typography>
                  </MenuItem>

                  <div className='flex items-center plb-2 pli-3'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      disabled={isLoggingOut}
                      endIcon={
                        isLoggingOut ? <CircularProgress size={16} color='inherit' /> : <i className='tabler-logout' />
                      }
                      onClick={handleUserLogout}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      {isLoggingOut ? 'Cerrando...' : 'Cerrar Sesión'}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
      <ChangePasswordDialog open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
    </>
  )
}

export default UserDropdown
