'use client'

// Impresion de etiquetas en lote, por stock de bodega central.
//
// La idea: en vez de abrir el QR de cada talla una por una, se arma de una sola
// vez el desglose completo del producto (color -> talla -> cuantas hay en
// bodega) y se manda todo a la DP30.
//
// Dos salidas, las mismas del modal de una sola etiqueta: "Imprimir etiqueta"
// (desde la PC, por el driver) y "Termica" (desde el celular, por Bluetooth).
//
// Las cantidades llegan sugeridas desde `centralWarehouseStock` pero todo es
// editable: sirve igual para reimprimir una sola talla que se arruino.

import { useEffect, useMemo, useRef, useState } from 'react'

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
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import { QRCodeCanvas } from 'qrcode.react'

import CustomTextField from '@core/components/mui/TextField'
import type { Variant } from '@/types/api/variants'
import { isLabelPrinterAvailable } from '@/utils/labelPrinter'
import { LABEL_SIZES, printVariantLabelBluetooth, printVariantLabels } from '@/utils/variantLabel'
import type { LabelSize } from '@/utils/variantLabel'

interface Props {
  open: boolean
  onClose: () => void
  variants: Variant[]
  productName?: string
}

type Fila = {
  variantId: number
  sku?: string
  colorName: string
  colorCode: string
  sizeName: string
  stock: number
  cantidad: number
  incluida: boolean
}

const BulkLabelPrintDialog = ({ open, onClose, variants, productName }: Props) => {
  const [filas, setFilas] = useState<Fila[]>([])
  const [incluirSinStock, setIncluirSinStock] = useState(false)
  const [size, setSize] = useState<LabelSize>(LABEL_SIZES[0])
  const [imprimiendo, setImprimiendo] = useState(false)
  const [progreso, setProgreso] = useState(0)
  const [resultado, setResultado] = useState<{ texto: string; ok: boolean } | null>(null)

  // Cancelar se consulta dentro del bucle: un estado no se veria actualizado ahi
  const cancelar = useRef(false)

  // Todas las tallas del producto, con o sin stock. Las de stock 0 se muestran
  // solo si se piden, pero se calculan siempre para no rehacer la lista al tildar
  const todas = useMemo<Fila[]>(() => {
    const filas: Fila[] = []

    for (const variant of variants) {
      const colorName = variant.color?.name || variant.colorName || ''
      const colorCode = variant.color?.code || variant.colorCode || '#000'

      for (const variantSize of variant.variants) {
        if (!variantSize.id) continue

        const sizeName =
          typeof variantSize.size === 'object' ? (variantSize.size as any)?.name : String(variantSize.size || '')

        const stock = variantSize.centralWarehouseStock ?? 0

        filas.push({
          variantId: Number(variantSize.id),
          sku: variantSize.sku,
          colorName,
          colorCode,
          sizeName,
          stock,
          cantidad: stock,

          // Arranca tildado lo que tiene stock: el caso normal es etiquetar lo
          // que hay. El resto se tilda a mano
          incluida: stock > 0
        })
      }
    }

    return filas
  }, [variants])

  // Las cantidades se cargan UNA vez por apertura. La lista de variantes se
  // refresca sola (la query es staleTime 0), y sin esta guarda un refetch en
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

  const visibles = useMemo(() => filas.filter(fila => incluirSinStock || fila.stock > 0), [filas, incluirSinStock])

  const aImprimir = visibles.filter(fila => fila.incluida && fila.cantidad > 0)
  const total = aImprimir.reduce((acc, fila) => acc + fila.cantidad, 0)

  // Agrupado por color: es como se piensa el pedido ("de negro, 5 M y 6 XL")
  const porColor = useMemo(() => {
    const grupos = new Map<string, Fila[]>()

    for (const fila of visibles) {
      const actual = grupos.get(fila.colorName)

      if (actual) actual.push(fila)
      else grupos.set(fila.colorName, [fila])
    }

    return [...grupos.entries()]
  }, [visibles])

  // Tallas distintas del producto, para poder decir "solo las M" de un toque
  const tallas = useMemo(() => [...new Set(visibles.map(fila => fila.sizeName))], [visibles])

  // Sin stock en ninguna talla: o el producto esta agotado o el backend no manda
  // el dato en esta pantalla. Conviene decirlo en vez de mostrar una lista vacia
  const sinDatos = todas.length > 0 && todas.every(fila => fila.stock === 0)

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

  // Un color entero, una talla en todos los colores, o una sola fila: si ya esta
  // todo tildado el toque lo destilda, y si no, lo tilda. Al tildar algo que
  // quedo en 0 se le pone 1, porque una etiqueta de cantidad cero no significa nada
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
    const canvas = document.getElementById(`bulk-qr-${variantId}`) as HTMLCanvasElement | null

    return canvas ? canvas.toDataURL('image/png') : ''
  }

  // Una entrada por etiqueta: la talla con 5 unidades aparece 5 veces
  const expandir = () =>
    aImprimir.flatMap(fila =>
      Array.from({ length: fila.cantidad }, () => ({
        variantId: fila.variantId,
        sku: fila.sku,
        productName,
        colorName: fila.colorName,
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
    let hechas = 0

    try {
      for (const etiqueta of etiquetas) {
        if (cancelar.current) {
          setResultado({ texto: `Cancelado. Se imprimieron ${hechas} de ${total} etiquetas.`, ok: false })

          return
        }

        await printVariantLabelBluetooth(etiqueta, size)
        hechas++
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
      <DialogTitle>Imprimir etiquetas {productName ? `· ${productName}` : ''}</DialogTitle>
      <DialogContent>
        {sinDatos && (
          <Alert severity='warning' sx={{ mb: 2 }}>
            Ninguna talla tiene stock en bodega central. Si sabés que sí hay, puede ser que esta pantalla no esté
            recibiendo el dato: activá &quot;incluir tallas sin stock&quot; y poné las cantidades a mano.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <CustomTextField
            select
            size='small'
            label='Tamaño de etiqueta'
            value={size.id}
            onChange={e => setSize(LABEL_SIZES.find(s => s.id === e.target.value) || LABEL_SIZES[0])}
            disabled={imprimiendo}
            sx={{ minWidth: 160 }}
          >
            {LABEL_SIZES.map(s => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </CustomTextField>

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
        </Box>

        {/* Atajos: una talla en todos los colores de un toque. Para un color
            entero esta el checkbox de su cabecera, abajo */}
        {visibles.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 0.5 }}>
              Talla en todos los colores
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
              No hay tallas con stock. Activá &quot;incluir tallas sin stock&quot; para verlas todas.
            </Typography>
          ) : (
            porColor.map(([colorName, delColor]) => {
              const todoTildado = delColor.every(fila => fila.incluida)
              const algoTildado = delColor.some(fila => fila.incluida)

              return (
                <Box key={colorName} sx={{ mb: 1 }}>
                  {/* Cabecera del color: tilda o destilda todas sus tallas */}
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
                      onChange={() => alternarGrupo(fila => fila.colorName === colorName)}
                      sx={{ p: 0.5 }}
                    />
                    <Box
                      sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        backgroundColor: delColor[0]?.colorCode,
                        border: '1px solid #ddd',
                        flexShrink: 0
                      }}
                    />
                    <Typography variant='body2' fontWeight='bold' noWrap>
                      {colorName}
                    </Typography>
                  </Box>

                  {delColor.map(fila => (
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
                          Talla {fila.sizeName}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {fila.sku || `ID ${fila.variantId}`} · {fila.stock} en bodega
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

            // 3 s por etiqueta es lo que tarda la termica entre envio, impresion
            // y avance; por el driver de la PC va mucho mas rapido
            <Typography variant='caption' color='text.secondary'>
              Por térmica va a tardar unos {Math.max(1, Math.round((total * 3) / 60))} min. No bloquees la pantalla: al
              suspenderse se corta el Bluetooth.
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
              id={`bulk-qr-${fila.variantId}`}
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

export default BulkLabelPrintDialog
