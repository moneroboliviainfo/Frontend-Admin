'use client'

// React Imports
import { useEffect, useState } from 'react'

// MUI Imports
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Typography from '@mui/material/Typography'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'

// Component Imports
import CustomTextField from '@core/components/mui/TextField'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useAuth } from '@/hooks/useAuth'

// Carrusel del panel izquierdo. Poné tus 3 imágenes en public/images/illustrations/auth/
// con estos nombres (o cambiá las rutas de acá). Se pueden agregar o quitar entradas:
// el carrusel usa el largo del array, no está fijado en 3.
const SIGN_IN_SLIDES = [
  '/images/illustrations/auth/slide1.webp',
  '/images/illustrations/auth/slide2.webp',
  '/images/illustrations/auth/slide3.webp'
]

// Cada cuántos ms cambia de imagen
const SLIDE_INTERVAL = 4000
const SIGN_UP_ILLUSTRATION = '/images/illustrations/auth/register.svg'

// El logo cambia según el tema: el normal en claro, la versión para fondo oscuro en oscuro
const LOGO_LIGHT = '/images/illustrations/auth/LogoMonero.webp'
const LOGO_DARK = '/images/illustrations/auth/logoblack.webp'

const SUPPORT_EMAIL = 'soporte@monero.bo'

// Lo que se destaca del negocio en el panel lateral
const STORE_HIGHLIGHTS = [
  { icon: 'tabler-shirt', label: 'Catálogo de productos y variantes' },
  { icon: 'tabler-building-warehouse', label: 'Inventario por sucursal' },
  { icon: 'tabler-cash-register', label: 'Ventas en tienda ' },
  { icon: 'tabler-file-invoice', label: 'Facturación electrónica SIAT' }
]

// Mismo degradé del diseño original (-45deg); lo único que cambia es que el color sale
// del primary del tema en vez del azul fijo, así sigue a Vuexy y al color por sucursal.
const gradient = 'bg-[linear-gradient(-45deg,var(--mui-palette-primary-dark)_0%,var(--mui-palette-primary-main)_100%)]'

// .panel .content — transition: transform 0.9s ease-in-out; delay 0.6s (0.8s en móvil)
const panelContentClasses =
  'flex flex-col items-center text-white transition-transform duration-[900ms] delay-[600ms] ease-in-out max-[870px]:delay-[800ms] max-[570px]:px-4 max-[570px]:py-2'

// .image — transition: transform 1.1s ease-in-out; delay 0.4s (0.9s / 0.6s en móvil)
const panelImageClasses =
  'is-full transition-transform duration-[1100ms] delay-[400ms] ease-in-out max-[870px]:is-[200px] max-[870px]:duration-[900ms] max-[570px]:hidden max-[870px]:delay-[600ms]'

// .btn.transparent
const panelButtonClasses = 'border-white text-white hover:border-white hover:bg-white/15'

const LoginV2 = ({ mode }: { mode: SystemMode }) => {
  const [isRequestMode, setIsRequestMode] = useState(false)
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { login, isLoggingIn, loginError } = useAuth()

  // Sigue al tema activo (incluido "system") y al toggle del customizer
  const logo = useImageVariant(mode, LOGO_LIGHT, LOGO_DARK)

  // Rota el carrusel del panel izquierdo
  useEffect(() => {
    if (SIGN_IN_SLIDES.length < 2) return

    const id = setInterval(() => setActiveSlide(current => (current + 1) % SIGN_IN_SLIDES.length), SLIDE_INTERVAL)

    return () => clearInterval(id)
  }, [])

  const getErrorMessage = () => {
    if (!loginError) return ''

    const axiosError = loginError as any

    if (axiosError?.response?.data?.message) {
      const message = axiosError.response.data.message

      return Array.isArray(message) ? message.join(', ') : message
    }

    if (loginError instanceof Error) return loginError.message

    return 'Error al iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.'
  }

  const isFormValid = Boolean(email.trim() && password)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid || isLoggingIn) return

    login({ email: email.trim(), password })
  }

  return (
    <div className='flex min-bs-[100dvh] is-full items-center justify-center bg-backgroundDefault p-4 sm:p-6'>
      {/* .container */}
      <div
        className={classnames(
          'relative is-full overflow-hidden rounded-xl bg-backgroundPaper shadow-lg',
          'bs-[660px] max-is-[1000px]',
          'max-[870px]:bs-[800px] max-[870px]:max-is-[520px]'
        )}
      >
        {/* .container:before — círculo del degradé. transition 1.8s (2s en móvil) */}
        <div
          aria-hidden
          className={classnames(
            gradient,
            'pointer-events-none absolute z-[6] bs-[2000px] is-[2000px] rounded-full transition-all duration-[1800ms] ease-in-out',
            'top-[-10%] -translate-y-1/2',
            'max-[870px]:bottom-[68%] max-[870px]:left-[30%] max-[870px]:right-auto max-[870px]:top-auto max-[870px]:bs-[1500px] max-[870px]:is-[1500px] max-[870px]:-translate-x-1/2 max-[870px]:translate-y-0 max-[870px]:duration-[2000ms]',
            'max-[570px]:bottom-[72%] max-[570px]:left-1/2',
            isRequestMode
              ? 'right-[52%] translate-x-full max-[870px]:bottom-[32%] max-[870px]:-translate-x-1/2 max-[870px]:translate-y-full max-[570px]:bottom-[28%]'
              : 'right-[48%] translate-x-0'
          )}
        />

        {/* .forms-container */}
        <div className='absolute inset-0'>
          {/* .signin-signup — transition 1s delay 0.7s (delay 0.8s en móvil) */}
          <div
            className={classnames(
              'absolute top-1/2 z-[5] grid is-1/2 -translate-x-1/2 -translate-y-1/2 grid-cols-1 transition-all delay-700 duration-1000 ease-in-out',
              'max-[870px]:left-1/2 max-[870px]:is-full max-[870px]:delay-[800ms]',
              isRequestMode
                ? 'left-1/4 max-[870px]:top-[5%] max-[870px]:translate-y-0'
                : 'left-3/4 max-[870px]:top-[95%] max-[870px]:-translate-y-full'
            )}
          >
            {/* form.sign-in-form — transition all 0.2s delay 0.7s */}
            <form
              noValidate
              autoComplete='off'
              onSubmit={handleLogin}
              className={classnames(
                'col-start-1 row-start-1 flex flex-col items-center justify-center gap-4 overflow-hidden px-20 transition-all delay-700 duration-200 max-[570px]:px-6',
                isRequestMode ? 'z-[1] opacity-0' : 'z-[2] opacity-100'
              )}
            >
              <img
                src={logo}
                alt='Monero'
                className='bs-[200px] is-auto max-is-[320px] object-contain max-[570px]:bs-[180px]'
              />
              <Typography variant='h4'>Iniciar sesión</Typography>

              {loginError && (
                <Alert severity='error' className='is-full max-is-[380px]'>
                  {getErrorMessage()}
                </Alert>
              )}

              <CustomTextField
                autoFocus
                fullWidth
                type='email'
                label='Correo electrónico'
                placeholder='nombre@monero.bo'
                autoComplete='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={!!loginError}
                disabled={isLoggingIn}
                className='max-is-[380px]'
              />

              <CustomTextField
                fullWidth
                label='Contraseña'
                placeholder='············'
                type={isPasswordShown ? 'text' : 'password'}
                autoComplete='current-password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={!!loginError}
                disabled={isLoggingIn}
                className='max-is-[380px]'
                InputProps={{
                  endAdornment: (
                    <InputAdornment position='end'>
                      <IconButton
                        edge='end'
                        onClick={() => setIsPasswordShown(show => !show)}
                        onMouseDown={e => e.preventDefault()}
                        disabled={isLoggingIn}
                        aria-label={isPasswordShown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        <i className={isPasswordShown ? 'tabler-eye-off' : 'tabler-eye'} />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Button
                fullWidth
                variant='contained'
                type='submit'
                size='large'
                disabled={isLoggingIn || !isFormValid}
                className='max-is-[380px]'
              >
                {isLoggingIn ? 'Iniciando sesión...' : 'Iniciar sesión'}
              </Button>

              <Typography variant='body2' color='text.disabled' className='max-is-[380px] text-center'>
                El uso de este panel es responsabilidad del administrador. Sigue las políticas de seguridad y
                privacidad.
              </Typography>
            </form>

            {/* form.sign-up-form — misma celda del grid, crossfade */}
            <div
              className={classnames(
                'col-start-1 row-start-1 flex flex-col items-center justify-center gap-4 overflow-hidden px-20 transition-all delay-700 duration-200 max-[570px]:px-6',
                isRequestMode ? 'z-[2] opacity-100' : 'z-[1] opacity-0'
              )}
            >
              <Typography variant='h4'>Solicitar acceso</Typography>
              <Typography color='text.secondary' className='max-is-[380px] text-center'>
                Las cuentas del panel (Administrador, Encargado y Cajero) las crea un administrador. No hay registro
                automático.
              </Typography>

              <div className='flex is-full max-is-[380px] items-center gap-3 rounded-md border border-solid border-[var(--mui-palette-divider)] p-4'>
                <i className='tabler-user-shield text-[1.5rem] text-primary' />
                <div className='flex flex-col'>
                  <Typography variant='body2' className='font-medium'>
                    Pídeselo a tu administrador
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Te asignará el rol y la sucursal.
                  </Typography>
                </div>
              </div>

              <div className='flex is-full max-is-[380px] items-center gap-3 rounded-md border border-solid border-[var(--mui-palette-divider)] p-4'>
                <i className='tabler-mail text-[1.5rem] text-primary' />
                <div className='flex min-is-0 flex-col'>
                  <Typography variant='body2' className='font-medium'>
                    Soporte
                  </Typography>
                  <Typography variant='body2' color='text.secondary' className='truncate'>
                    {SUPPORT_EMAIL}
                  </Typography>
                </div>
              </div>

              <Typography variant='body2' color='text.disabled' className='max-is-[380px] text-center'>
                ¿Olvidaste tu contraseña? Un administrador puede restablecerla desde el módulo de Usuarios.
              </Typography>
            </div>
          </div>
        </div>

        {/* .panels-container */}
        <div className='absolute inset-0 grid grid-cols-2 max-[870px]:grid-cols-1 max-[870px]:grid-rows-[1fr_2fr_1fr]'>
          {/* .left-panel */}
          <div
            className={classnames(
              'z-[6] flex flex-col items-center justify-center gap-6 pbs-12 pbe-8 px-[12%] text-center',
              'max-[870px]:col-start-1 max-[870px]:row-start-1 max-[870px]:flex-row max-[870px]:items-center max-[870px]:justify-around max-[870px]:px-[8%] max-[870px]:py-10',
              isRequestMode ? 'pointer-events-none' : 'pointer-events-auto'
            )}
          >
            <div
              className={classnames(
                panelContentClasses,
                isRequestMode ? '-translate-x-[800px] max-[870px]:translate-x-0 max-[870px]:-translate-y-[300px]' : ''
              )}
            >
              <Typography variant='h5' className='font-semibold text-inherit max-[870px]:text-[1.2rem]'>
                MONERO ADMIN 2.0
              </Typography>
              <Typography
                variant='body2'
                className='max-is-[320px] py-[0.7rem] text-inherit opacity-85 max-[870px]:text-[0.7rem]'
              >
                Tienda de ropa administrada por sucursales. Desde este panel se gestiona todo el negocio en un solo
                lugar.
              </Typography>
              <div className='flex flex-col gap-2 text-start max-[870px]:hidden'>
                {STORE_HIGHLIGHTS.map(item => (
                  <div key={item.label} className='flex items-center gap-2.5'>
                    <i className={classnames(item.icon, 'text-[1.25rem] opacity-90')} />
                    <Typography variant='body2' className='text-inherit opacity-85'>
                      {item.label}
                    </Typography>
                  </div>
                ))}
              </div>
              {/* Botón para ir a "Solicitar acceso". Comentado por ahora — al descomentarlo
                  vuelve a habilitarse esa cara del panel, que sigue construida más abajo.
              <Button variant='outlined' onClick={() => setIsRequestMode(true)} className={panelButtonClasses}>
                Solicitar acceso
              </Button>
              */}
            </div>
            {/* Carrusel: las imágenes se apilan y se cruzan por opacidad. El wrapper
                conserva el translate original del panel. */}
            <div
              className={classnames(
                panelImageClasses,
                'relative aspect-[4/3]',
                isRequestMode ? '-translate-x-[800px] max-[870px]:translate-x-0 max-[870px]:-translate-y-[300px]' : ''
              )}
            >
              {SIGN_IN_SLIDES.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=''
                  className={classnames(
                    'absolute inset-0 is-full bs-full object-contain transition-opacity duration-1000 ease-in-out',
                    index === activeSlide ? 'opacity-100' : 'opacity-0'
                  )}
                />
              ))}
            </div>
          </div>

          {/* .right-panel */}
          <div
            className={classnames(
              'z-[6] flex flex-col items-center justify-center gap-6 pbs-12 pbe-8 px-[12%] text-center',
              'max-[870px]:col-start-1 max-[870px]:row-start-3 max-[870px]:flex-row max-[870px]:items-center max-[870px]:justify-around max-[870px]:px-[8%] max-[870px]:py-10',
              isRequestMode ? 'pointer-events-auto' : 'pointer-events-none'
            )}
          >
            <div
              className={classnames(
                panelContentClasses,
                isRequestMode
                  ? 'translate-x-0 max-[870px]:translate-y-0'
                  : 'translate-x-[800px] max-[870px]:translate-x-0 max-[870px]:translate-y-[300px]'
              )}
            >
              <Typography variant='h5' className='font-semibold text-inherit max-[870px]:text-[1.2rem]'>
                ¿Ya tienes cuenta?
              </Typography>
              <Typography
                variant='body2'
                className='max-is-[320px] py-[0.7rem] text-inherit opacity-85 max-[870px]:text-[0.7rem]'
              >
                Ingresa con el correo y la contraseña que te asignó el administrador del sistema.
              </Typography>
              <Button variant='outlined' onClick={() => setIsRequestMode(false)} className={panelButtonClasses}>
                Iniciar sesión
              </Button>
            </div>
            <img
              src={SIGN_UP_ILLUSTRATION}
              alt=''
              className={classnames(
                panelImageClasses,
                isRequestMode
                  ? 'translate-x-0 max-[870px]:translate-y-0'
                  : 'translate-x-[800px] max-[870px]:translate-x-0 max-[870px]:translate-y-[300px]'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
