// "linea" es jerga de factura: en la tienda se cuentan prendas y variantes (producto+color+talla)
export const prendas = (quantity: number) => `${quantity} ${quantity === 1 ? 'prenda' : 'prendas'}`

export const variantes = (count: number) => `${count} ${count === 1 ? 'variante' : 'variantes'}`
