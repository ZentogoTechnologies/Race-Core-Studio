// La versión que se está ejecutando.
//
// __APP_VERSION__ lo sustituye Vite al compilar, leyendo el archivo
// VERSION de la raíz —el mismo del que la sacan el backend, el
// instalador y el lanzador—. El respaldo es para `vite dev` en un árbol
// donde ese define no haya llegado a definirse.
export const VERSION =
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'
