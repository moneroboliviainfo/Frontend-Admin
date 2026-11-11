'use client'

// Impresion de etiquetas en lote: el nucleo que comparten las pantallas que
// etiquetan varias prendas de una vez.
//
// Salio de Productos → Variantes (impresion por stock de bodega central) y se
// generalizo para poder usarlo tambien al mandar prendas de la bodega central a
// una sucursal, donde las filas no son "las tallas de un producto" sino "lo que
// va en el envio", de varios productos a la vez.
//
// Lo que NO cambia entre pantallas, y por eso vive aca: las dos salidas
// ("Imprimir etiqueta" por el driver de la PC y "Termica" por Bluetooth desde el
// celular), el selector de tamaño, el desglose editable, los QR ocultos, el
// progreso con cancelacion y el wake lock.
//
// Lo que cambia lo pone cada pantalla: las filas (`rows`), como se agrupan y si
// tiene sentido filtrar por stock.

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import { QRCodeCanvas } from 'qrcode.react'

import CustomTextField from '@core/components/mui/TextField'
import { isLabelPrinterAvailable } from '@/utils/labelPrinter'
import { LABEL_SIZES, printVariantLabelBluetooth, printVariantLabels } from '@/utils/variantLabel'
import type { LabelSize } from '@/utils/variantLabel'

// Una talla concreta de un producto: lo minimo para imprimir su etiqueta
export type LabelBatchRow = {
  variantId: number
  sku?: string
  productName?: string
  colorName?: string
  colorCode?: string
  sizeName: string

  // Cantidad sugerida al abrir. Editable despues
  quantity: number

  // Solo informativo, y lo que mira el filtro de "sin stock" cuando esta activo
  stock?: number

  // Linea chica bajo la fila ("5 en bodega", "3 en el envio")
  hint?: string
}

type Props = {
  open: boolean
  onClose: () => void
  title: string
  rows: LabelBatchRow[]

  // 'color': las tallas de UN producto, agrupadas por color (Productos →
  // Variantes). 'product': varios productos, agrupados por producto (un envio)
  groupBy?: 'color' | 'product'

  // La casilla "incluir tallas sin stock" y el aviso de que no hay stock en
  // ninguna: solo tienen sentido cuando las filas vienen del stock de bodega
  stockFilter?: boolean
}

type Fila = LabelBatchRow & { cantidad: number; incluida: boolean }

const LabelBatchDialog = ({ open, onClose, title, rows, groupBy = 'color', stockFilter = false }: Props) => {
  const [filas, setFilas] = useState<Fila[]>([])
  const [incluirSinStock, setIncluirSinStock] = useState(false)
  const [size, setSize] = useState<LabelSize>(LABEL_SIZES[0])
  const [sizeAnchor, setSizeAnchor] = useState<null | HTMLElement>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null)

  // Cancelar se consulta dentro del bucle: un estado no se veria actualizado ahi
  const cancelar = useRef(false)

  // Dos instancias de este dialogo pueden tener la misma variante: los canvas
  // del QR se buscan por id, asi que el prefijo tiene que ser propio
  const qrPrefix = useId()

  const todas = useMemo<Fila[]>(
    () =>
      rows.map(row => ({
        ...row,
        cantidad: row.quantity,

        // Arranca tildado lo que tiene algo que imprimir. El resto, a mano
        incluida: row.quantity > 0
      })),
    [rows]
  )

  // Las cantidades se cargan UNA vez por apertura. La lista de origen se
  // refresca sola (las queries son staleTime 0), y sin esta guarda un refetch en
  // mitad de la edicion borraria lo que el usuario acababa de escribir.
  const inicializado = useRef(false)

  useEffect(() => {
    if (!open) {
      inicializado.current = false

      return
    }

    if (inicializado.current) return

    inicializado.current = true
    setFilas(todas)
    setIncluirSinStock(false)
    setProgreso(0)
    setResultado(null)
    cancelar.current = false
  }, [open, todas])

  const visibles = useMemo(
    () => filas.filter(fila => !stockFilter || incluirSinStock || (fila.stock ?? 0) > 0),
    [filas, incluirSinStock, stockFilter]
  )

  const aImprimir = visibles.filter(fila => fila.incluida && fila.cantidad > 0)
  const total = aImprimir.reduce((acc, fila) => acc + fila.cantidad, 0)

  // Por color es como se piensa el pedido de un producto ("de negro, 5 M y 6
  // XL"); por producto, como se piensa un envio ("de la camisa van 4")
  const grupos = useMemo(() => {
    const mapa = new Map<string, Fila[]>()

    for (const fila of visibles) {
      const clave = (groupBy === 'product' ? fila.productName : fila.colorName) || ''
      const actual = mapa.get(clave)

      if (actual) actual.push(fila)
      else mapa.set(clave, [fila])
    }

    return [...mapa.entries()]
  }, [visibles, groupBy])

  // Tallas distintas, para poder decir "solo las M" de un toque
  const tallas = useMemo(() => [...new Set(visibles.map(fila => fila.sizeName))], [visibles])

  // Sin stock en ninguna talla: o esta agotado o el backend no manda el dato en
  // esta pantalla. Conviene decirlo en vez de mostrar una lista vacia
  const sinDatos = stockFilter && todas.length > 0 && todas.every(fila => (fila.stock ?? 0) === 0)

  const actualizar = (test: (fila: Fila) => boolean, cambio: (fila: Fila) => Fila) => {
    setFilas(actuales => actuales.map(fila => (test(fila) ? cambio(fila) : fila)))
  }

  const cambiarCantidad = (variantId: number, valor: number) => {
    const cantidad = Math.max(0, Math.min(99, Math.round(valor) || 0))

    // Poner una cantidad es querer esa etiqueta: se tilda sola, y en 0 se destilda
    actualizar(
      fila => fila.variantId === variantId,
      fila => ({ ...fila, cantidad, incluida: cantidad > 0 })
    )
  }

  // Un grupo entero, una talla en todos los grupos, o una sola fila: si ya esta
  // todo tildado el toque lo destilda, y si no, lo tilda. Al tildar algo que
  // quedo en 0 se le pone 1, porque una etiqueta de cantidad cero no significa
  // nada
  const alternarGrupo = (test: (fila: Fila) => boolean) => {
    const grupo = visibles.filter(test)
    const todoTildado = grupo.length > 0 && grupo.every(fila => fila.incluida)

    const ids = new Set(grupo.map(fila => fila.variantId))

    actualizar(
      fila => ids.has(fila.variantId),
      fila => ({
        ...fila,
        incluida: !todoTildado,
        cantidad: !todoTildado && fila.cantidad === 0 ? 1 : fila.cantidad
      })
    )
  }

  const marcarTodo = (incluida: boolean) => {
    const ids = new Set(visibles.map(fila => fila.variantId))

    actualizar(
      fila => ids.has(fila.variantId),
      fila => ({ ...fila, incluida, cantidad: incluida && fila.cantidad === 0 ? 1 : fila.cantidad })
    )
  }

  const qrDataUrl = (variantId: number): string => {
    const canvas = document.getElementById(`${qrPrefix}-${variantId}`) as HTMLCanvasElement | null

    return canvas ? canvas.toDataURL('image/png') : ''
  }

  // Una entrada por etiqueta: la talla con 5 unidades aparece 5 veces
  const expandir = () =>
    aImprimir.flatMap(fila =>
      Array.from({ length: fila.cantidad }, () => ({
        variantId: fila.variantId,
        sku: fila.sku,
        productName: fila.productName,
        colorName: fila.colorName || '',
        sizeName: fila.sizeName,
        qrDataUrl: qrDataUrl(fila.variantId)
      }))
    )

  // Desde la PC: ventana de impresion del navegador -> driver de la DP30. Van
  // todas en una sola ventana, cada etiqueta en su pagina
  const imprimirDesdePC = () => {
    setResultado(null)

    try {
      printVariantLabels(expandir(), size)
      setResultado({ texto: `${total} etiqueta(s) enviadas a la impresora.`, ok: true })
    } catch (error: any) {
      setResultado({ texto: error?.message || 'No se pudo abrir la ventana de impresion', ok: false })
    }
  }

  // Desde el celular: Bluetooth directo a la DP30, una etiqueta por vez
  const imprimirTermica = async () => {
    cancelar.current = false
    setImprimiendo(true)
    setProgreso(0)
    setResultado(null)

    // La pantalla no se puede apagar a mitad del lote: al suspenderse se corta
    // el Bluetooth y quedaria sin saber por donde iba
    let wakeLock: any = null

    try {
      wakeLock = await (navigator as any).wakeLock?.request('screen')
    } catch {
      // Sin wake lock se imprime igual; solo hay que no bloquear la pantalla
    }

    const etiquetas = expandir()

    // En un rollo doble entran dos etiquetas distintas por avance de papel: se
    // mandan de a pares y el lote tarda la mitad. Con rollo simple, de a una
    const porFila = size.perRow ?? 1
    let hechas = 0

    try {
      for (let i = 0; i < etiquetas.length; i += porFila) {
        if (cancelar.current) {
          setResultado({ texto: `Cancelado. Se imprimieron ${hechas} de ${total} etiquetas.`, ok: false })

          return
        }

        const fila = etiquetas.slice(i, i + porFila)

        // Solo la primera arranca en frio: de ahi en mas el papel queda parado
        // por el sensor de la impresora, y compensarlo igual las corria hacia
        // arriba (ver OFFSET_VERTICAL_MM en variantLabel.ts)
        await printVariantLabelBluetooth(fila, size, hechas === 0)
        hechas += fila.length
        setProgreso(hechas)
      }

      setResultado({ texto: `Listo: ${hechas} etiqueta(s) impresas.`, ok: true })
    } catch (error: any) {
      // Se dice cuantas salieron: sin eso no se sabe desde donde reimprimir
      setResultado({
        texto: `${error?.message || 'Error al imprimir'}. Se alcanzaron a imprimir ${hechas} de ${total}.`,
        ok: false
      })
    } finally {
      setImprimiendo(false)

      try {
        await wakeLock?.release()
      } catch {
        // Ya liberado o no soportado
      }
    }
  }

  return (
    <Dialog open={open} onClose={imprimiendo ? undefined : onClose} maxWidth='sm' fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {sinDatos && (
          <Alert severity='warning' sx={{ mb: 2 }}>
            Ninguna talla tiene stock en bodega central. Si sabés que sí hay, puede ser que esta pantalla no esté
            recibiendo el dato: activá &quot;incluir tallas sin stock&quot; y poné las cantidades a mano.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          {/* Boton + Menu en vez de un <select>: el desplegable de MUI no se
              abria dentro de este dialogo. Es el mismo patron del modal de una
              sola etiqueta, que si funciona */}
          <Button
            variant='outlined'
            size='small'
            disabled={imprimiendo}
            onClick={e => setSizeAnchor(e.currentTarget)}
            endIcon={<i className='tabler-chevron-down' />}
          >
            Tamaño: {size.label}
          </Button>

          <Menu anchorEl={sizeAnchor} open={!!sizeAnchor} onClose={() => setSizeAnchor(null)}>
            <MenuItem disabled sx={{ opacity: '1 !important', fontSize: '0.75rem' }}>
              Tamaño de la etiqueta
            </MenuItem>
            <Divider />
            {LABEL_SIZES.map(s => (
              <MenuItem
                key={s.id}
                selected={s.id === size.id}
                onClick={() => {
                  setSize(s)
                  setSizeAnchor(null)
                }}
              >
                {s.label}
              </MenuItem>
            ))}
          </Menu>

          {stockFilter && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={incluirSinStock}
                  onChange={e => setIncluirSinStock(e.target.checked)}
                  disabled={imprimiendo}
                />
              }
              label='Incluir tallas sin stock'
            />
          )}
        </Box>

        {/* Atajos: una talla en todos los grupos de un toque. Para un grupo
            entero esta el checkbox de su cabecera, abajo */}
        {visibles.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.5 }}>
              {groupBy === 'product' ? 'Talla en todo el envío' : 'Talla en todos los colores'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {tallas.map(talla => {
                const grupo = visibles.filter(fila => fila.sizeName === talla)
                const activa = grupo.length > 0 && grupo.every(fila => fila.incluida)

                return (
                  <Chip
                    key={talla}
                    label={talla}
                    size='small'
                    color={activa ? 'primary' : 'default'}
                    variant={activa ? 'filled' : 'outlined'}
                    disabled={imprimiendo}
                    onClick={() => alternarGrupo(fila => fila.sizeName === talla)}
                  />
                )
              })}

              <Box sx={{ flex: 1 }} />

              <Button size='small' disabled={imprimiendo} onClick={() => marcarTodo(true)}>
                Todo
              </Button>
              <Button size='small' color='secondary' disabled={imprimiendo} onClick={() => marcarTodo(false)}>
                Ninguno
              </Button>
            </Box>
          </Box>
        )}

        <Divider sx={{ mb: 1 }} />

        <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
          {visibles.length === 0 ? (
            <Typography variant='body2' color='text.secondary' sx={{ py: 3, textAlign: 'center' }}>
              {stockFilter
                ? 'No hay tallas con stock. Activá "incluir tallas sin stock" para verlas todas.'
                : 'No hay prendas para etiquetar.'}
            </Typography>
          ) : (
            grupos.map(([clave, delGrupo]) => {
              const todoTildado = delGrupo.every(fila => fila.incluida)
              const algoTildado = delGrupo.some(fila => fila.incluida)

              return (
                <Box key={clave} sx={{ mb: 1 }}>
                  {/* Cabecera del grupo: tilda o destilda todas sus filas */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5
                    }}
                  >
                    <Checkbox
                      size='small'
                      checked={todoTildado}
                      indeterminate={algoTildado && !todoTildado}
                      disabled={imprimiendo}
                      onChange={() =>
                        alternarGrupo(fila =>
                          groupBy === 'product' ? (fila.productName || '') === clave : (fila.colorName || '') === clave
                        )
                      }
                      sx={{ p: 0.5 }}
                    />

                    {groupBy === 'color' && (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          backgroundColor: delGrupo[0]?.colorCode,
                          border: '1px solid #ddd',
                          flexShrink: 0
                        }}
                      />
                    )}

                    <Typography variant='body2' fontWeight='bold' noWrap>
                      {clave || 'Sin nombre'}
                    </Typography>
                  </Box>

                  {delGrupo.map(fila => (
                    <Box
                      key={fila.variantId}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5,
                        pl: 1,
                        opacity: fila.incluida ? 1 : 0.45
                      }}
                    >
                      <Checkbox
                        size='small'
                        checked={fila.incluida}
                        disabled={imprimiendo}
                        onChange={() => alternarGrupo(f => f.variantId === fila.variantId)}
                        sx={{ p: 0.5 }}
                      />

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='body2' noWrap>
                          {groupBy === 'product' && fila.colorName ? `${fila.colorName} · ` : ''}Talla {fila.sizeName}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {fila.sku || `ID ${fila.variantId}`}
                          {fila.hint ? ` · ${fila.hint}` : ''}
                        </Typography>
                      </Box>

                      <IconButton
                        size='small'
                        disabled={imprimiendo || fila.cantidad === 0}
                        onClick={() => cambiarCantidad(fila.variantId, fila.cantidad - 1)}
                      >
                        <i className='tabler-minus' />
                      </IconButton>

                      <CustomTextField
                        size='small'
                        value={fila.cantidad}
                        onChange={e => cambiarCantidad(fila.variantId, Number(e.target.value))}
                        disabled={imprimiendo}
                        inputProps={{ inputMode: 'numeric', style: { textAlign: 'center', width: 36 } }}
                      />

                      <IconButton
                        size='small'
                        disabled={imprimiendo}
                        onClick={() => cambiarCantidad(fila.variantId, fila.cantidad + 1)}
                      >
                        <i className='tabler-plus' />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )
            })
          )}
        </Box>

        <Divider sx={{ my: 1 }} />

        <Box>
          <Typography variant='subtitle2'>
            Total: {total} etiqueta{total === 1 ? '' : 's'} · {aImprimir.length} talla
            {aImprimir.length === 1 ? '' : 's'}
          </Typography>

          {total > 0 && !imprimiendo && (
            <Typography variant='caption' color='text.secondary'>
              Por térmica va a tardar unos {Math.max(1, Math.round((Math.ceil(total / (size.perRow ?? 1)) * 3) / 60))}{' '}
              min. No bloquees la pantalla: al suspenderse se corta el Bluetooth.
            </Typography>
          )}
        </Box>

        {imprimiendo && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant='determinate' value={total ? (progreso / total) * 100 : 0} />
            <Typography variant='caption' color='text.secondary'>
              Imprimiendo {progreso} de {total}…
            </Typography>
          </Box>
        )}

        {resultado && (
          <Alert severity={resultado.ok ? 'success' : 'error'} sx={{ mt: 2 }}>
            {resultado.texto}
          </Alert>
        )}

        {/* Los QR se dibujan ocultos, uno por talla (no uno por etiqueta): al
            imprimir se leen de aca como PNG, igual que hace el modal de una sola */}
        <Box sx={{ display: 'none' }}>
          {visibles.map(fila => (
            <QRCodeCanvas
              key={fila.variantId}
              id={`${qrPrefix}-${fila.variantId}`}
              value={`<qr>${fila.variantId}</qr>`}
              size={256}
              level='M'
              marginSize={0}
            />
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        {imprimiendo ? (
          <Button color='error' onClick={() => (cancelar.current = true)}>
            Cancelar
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cerrar</Button>

            <Button
              variant='outlined'
              disabled={total === 0}
              onClick={imprimirDesdePC}
              startIcon={<i className='tabler-printer' />}
            >
              Imprimir etiqueta{total > 0 ? ` (${total})` : ''}
            </Button>

            {isLabelPrinterAvailable() && (
              <Button
                variant='contained'
                disabled={total === 0}
                onClick={imprimirTermica}
                startIcon={<i className='tabler-bluetooth' />}
              >
                Térmica{total > 0 ? ` (${total})` : ''}
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default LabelBatchDialog
