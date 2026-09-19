import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // El código del frontend llama a la API con rutas relativas bajo /api y
      // nunca contiene la dirección del backend (ADR-006 §5). En producción esa
      // dirección vive en la regla de reescritura del sitio estático; aquí, en
      // este reenvío. Así el mismo código funciona en los dos entornos.
      // El backend local es el de Docker Compose más ./mvnw spring-boot:run.
      '/api': 'http://localhost:8080',
    },
  },
})
