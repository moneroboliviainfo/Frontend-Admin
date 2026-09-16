const BRANCH_COLORS = [
  '#F97316', // naranja
  '#1882FD', // azul

  '#6366F1', // índigo
  '#F59E0B', // ámbar
  '#8B5CF6', // violeta
  '#EC4899', // rosa
  '#06B6D4', // cian
  '#84CC16', // lima
  '#EF4444', // rojo
  '#22C55E' // verde
]

export const getBranchColor = (branchIndex: number): string => {
  return BRANCH_COLORS[branchIndex % BRANCH_COLORS.length]
}
