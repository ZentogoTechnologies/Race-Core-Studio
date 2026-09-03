/* ==========================================================================
   IDIOMA DE LA INTERFAZ

   La clave del diccionario es el texto en español tal cual aparece en el
   código. No son claves inventadas a propósito: una cadena que todavía no
   esté traducida sale en español, que es legible, en vez de mostrar
   "ajustes.titulo.cronometraje" al aire.

   `t` es una función de módulo y no un hook. Con un hook habría que
   añadirlo dentro de cada componente del panel; así basta con importarla
   donde se use. El precio es que cambiar de idioma no rerenderiza solo:
   de eso se encarga el proveedor, que remonta el árbol.
========================================================================== */

import es from './es.json'
import en from './en.json'

const DICCIONARIOS = { es, en }

let idiomaActual = 'es'

export function fijarIdioma(id) {
  idiomaActual = DICCIONARIOS[id] ? id : 'es'
  return idiomaActual
}

export function idiomaDeAhora() {
  return idiomaActual
}

export function t(texto) {
  if (idiomaActual === 'es') return texto
  const dic = DICCIONARIOS[idiomaActual]
  return (dic && dic[texto]) || texto
}
