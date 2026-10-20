// Qué vistas dependen del selector de sucursal de la navbar.
//
// Única fuente de verdad: la leen el color del tema (BranchThemeSync) y el
// propio selector (BranchSwitcher), para que no puedan quedar en desacuerdo
// —esconder el selector pero dejar la pantalla teñida, por ejemplo—.
//
// Criterio: una ruta entra en CON_SUCURSAL solo si lo que se MUESTRA cambia al
// mover el selector. No alcanza con que use useBranchContext: Usuarios lee la
// lista de sucursales para un desplegable del formulario, pero el selector de
// arriba no afecta en nada lo que ve.
//
// Cuando una ruta mezcla las dos cosas, la vista de adentro lo corrige con
// `useDeclareBranchScope` (ver BranchScopeContext). Hoy pasa en dos lugares:
// el paso de Variantes del alta de productos (declara true) y la pestaña
// Retiros de Bodega Central (declara false).

const CON_SUCURSAL = [
  '/sales', // ventas y caja de esa sucursal
  '/cash', // historial de caja
  '/central-warehouse', // a qué sucursal se despacha (salvo la pestaña Retiros)
  '/siat/eventos', // evento significativo del punto de venta de la sucursal
  '/siat/facturacion' // facturas emitidas por esa sucursal
]

const GENERALES = [
  '/home',
  '/products', // el alta y el listado son globales; el paso de Variantes se declara aparte
  '/siat/cafc',
  '/siat/paquetes',
  '/users',
  '/branches',
  '/customers',
  '/settings',
  '/category',
  '/receptions',
  '/discounts',
  '/outfits',
  '/banners',
  '/sliders',
  '/advertisement'
]

// El aviso lo disparan dos componentes en cada render: sin esto la consola se
// llena de la misma linea.
const avisadas = new Set<string>()

const matcher = (pathname: string) => (route: string) => pathname === route || pathname.startsWith(`${route}/`)

export const isBranchScoped = (pathname: string): boolean => {
  const match = matcher(pathname)

  if (CON_SUCURSAL.some(match)) return true

  // Una pantalla nueva sin clasificar cae en general: azul y sin selector.
  // Queda sosa, pero nunca miente. El aviso evita que el olvido pase inadvertido.
  if (process.env.NODE_ENV === 'development' && !GENERALES.some(match) && !avisadas.has(pathname)) {
    avisadas.add(pathname)
    console.warn(
      `[branchScope] Ruta sin clasificar: ${pathname} — agregala a CON_SUCURSAL o GENERALES en src/utils/branchScope.ts`
    )
  }

  return false
}
