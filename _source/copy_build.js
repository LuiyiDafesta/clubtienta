import fs from 'fs'
import path from 'path'

const sourceDir = './dist'
const destDir = '../'

console.log('--- SCRIPT DE COPIADO DE BUILD PARA FEROZO HOSTING ---')

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src)
  const stats = exists && fs.statSync(src)
  const isDirectory = exists && stats.isDirectory()

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true })
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      )
    })
  } else {
    // Si es un archivo de código fuente, no copiarlo para evitar sobrescribir carpetas de desarrollo
    // Solo copiamos los archivos de compilación
    const fileName = path.basename(src)
    if (fileName === 'package.json' || fileName === 'copy_build.js') {
      return
    }
    
    // Evitar que la carpeta _source o .git se vean afectadas
    if (dest.includes('/_source') || dest.includes('/.git')) {
      return
    }

    fs.copyFileSync(src, dest)
  }
}

try {
  if (!fs.existsSync(sourceDir)) {
    console.error(`✖ La carpeta de compilación ${sourceDir} no existe. Por favor corre "npm run build" primero.`)
    process.exit(1)
  }

  console.log(`Copiando contenidos de ${sourceDir} a ${destDir}...`)
  copyRecursiveSync(sourceDir, destDir)
  console.log('✓ ¡Compilación copiada exitosamente a la raíz del repositorio!')
} catch (err) {
  console.error('✖ Error al copiar los archivos de compilación:', err.message)
  process.exit(1)
}
