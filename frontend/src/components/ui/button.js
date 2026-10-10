const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTS = {
  primary: 'bg-accent text-surface hover:-translate-y-px hover:bg-[#6ee0d5] hover:shadow-[0_8px_18px_-8px_rgb(0_0_0/0.65)]',
  secondary: 'border border-border-strong font-medium text-content hover:border-content-muted',
}

const SIZES = {
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-body',
}

/**
 * Clases de un botón de la identidad: píldora turquesa para la acción
 * principal y borde para las demás. Son clases y no un componente porque se
 * aplican tanto a un <button> como a un <Link>.
 */
export function buttonClasses(variant = 'primary', size = 'md') {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`
}
