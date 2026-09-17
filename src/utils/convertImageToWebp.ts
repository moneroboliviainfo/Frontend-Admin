// El backend solo acepta imágenes en WEBP. Esto convierte cualquier imagen
// (jpg, jpeg, png, etc.) a webp del lado del cliente antes de subirla.

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })

export const convertImageToWebp = async (file: File, quality = 0.85): Promise<File> => {
  // Ya es webp, o no es una imagen (video/pdf) — se manda tal cual
  if (file.type === 'image/webp' || !file.type.startsWith('image/')) {
    return file
  }

  const objectUrl = URL.createObjectURL(file)

  try {
    const image = await loadImage(objectUrl)

    const canvas = document.createElement('canvas')

    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight

    const ctx = canvas.getContext('2d')

    if (!ctx) return file

    ctx.drawImage(image, 0, 0)

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality))

    if (!blob) return file

    const webpName = file.name.replace(/\.[^/.]+$/, '') + '.webp'

    return new File([blob], webpName, { type: 'image/webp' })
  } catch {
    // Si algo falla en la conversión, mandamos el original antes que bloquear la subida
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
