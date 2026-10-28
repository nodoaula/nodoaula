import { useState } from 'react'

import TextInput from './TextInput.jsx'

/**
 * Campo de contraseña con «Mostrar» dentro. Sin recuperación de contraseña,
 * un error al escribirla deja la cuenta inaccesible; poder verla ayuda a
 * evitarlo. Mientras se ve, el teclado del celular no la corrige ni le pone
 * mayúscula, como haría con texto normal.
 */
export default function PasswordInput({ id, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <TextInput
      id={id}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      adornment={
        <button
          type="button"
          aria-controls={id}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          onClick={() => setVisible(!visible)}
          className="absolute inset-y-0.5 right-0.5 rounded-[10px] px-3.5 text-label font-medium text-content-muted hover:text-content"
        >
          {visible ? 'Ocultar' : 'Mostrar'}
        </button>
      }
      {...props}
    />
  )
}
