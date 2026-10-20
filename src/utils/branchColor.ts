// Verde reservado para las vistas generales (las que no dependen del selector
// de sucursal). Por eso no hay ningún verde entre los colores de abajo.
export const GENERAL_COLOR = '#15803D'

// REGLA: ninguna sucursal puede usar un color cercano a los semánticos de la
// plantilla, porque el color de sucursal es el `primary` del tema y tiñe todos
// los botones. Una sucursal en rojo hace que cada botón primario parezca de
// peligro, y una en naranja, de advertencia.
//
//   error   #FF4C51 (rojo coral)     warning #FF9F43 (naranja)
//   info    #00BAD1 (cian)           success #28C76F (verde)
//
// Quedan libres los azules, púrpuras, magentas y tierras. Están ordenados para
// que las primeras sucursales sean las más distintas entre sí.
const BRANCH_COLORS = [
  '#1882FD', // azul
  '#BE185D', // magenta oscuro
  '#7E22CE', // púrpura
  '#92400E', // marrón
  '#1E3A8A', // azul marino
  '#A21CAF', // fucsia
  '#4338CA', // índigo profundo
  '#0369A1' // azul acero
]

export const getBranchColor = (branchIndex: number): string => {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length]
}
