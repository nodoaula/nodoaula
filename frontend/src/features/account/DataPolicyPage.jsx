const CONTACT_EMAIL = 'brahian.ocampo@udea.edu.co'

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-lead font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  )
}

function List({ children }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-content-faint">{children}</ul>
}

// Subrayado porque va dentro del texto: el color solo no lo distingue de lo
// que lo rodea (WCAG 1.4.1).
function ContactEmail() {
  return (
    <a
      href={`mailto:${CONTACT_EMAIL}`}
      className="text-accent underline underline-offset-3 wrap-anywhere hover:decoration-2"
    >
      {CONTACT_EMAIL}
    </a>
  )
}

/**
 * Política de tratamiento de datos personales que exige la Ley 1581 de 2012.
 * Se enlaza desde la casilla de autorización del registro. Si cambia en algo
 * importante, hay que avisar a las cuentas antes de aplicar el cambio y
 * actualizar la fecha de vigencia: la fecha de autorización de cada cuenta
 * indica qué versión aceptó.
 */
export default function DataPolicyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 pt-9 pb-18 sm:px-6">
      <article className="max-w-140 text-body leading-relaxed text-pretty text-content">
        <h1 className="text-[1.875rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-display">
          Política de tratamiento de datos
        </h1>
        <p className="mt-3 font-mono text-label text-content-muted">
          Vigente desde el <time dateTime="2026-10-30">30 de octubre de 2026</time>
        </p>

        <p className="mt-6">
          NodoAula es un proyecto estudiantil del Proyecto Integrador I de la Universidad de Antioquia. Aquí te contamos
          qué datos tuyos guardamos, para qué y qué puedes hacer con ellos, como lo pide la Ley 1581 de 2012.
        </p>

        <Section title="Quién responde por tus datos">
          <p>
            Brahian Ocampo, Juan Diego Portillo y María del Carmen Segura, el equipo que opera NodoAula, en Medellín.
            Escríbenos a <ContactEmail />.
          </p>
        </Section>

        <Section title="Qué datos guardamos">
          <p>Para consultar el catálogo no necesitas cuenta y no te pedimos ningún dato. Si creas una cuenta, guardamos:</p>
          <List>
            <li>Tu correo, con el que inicias sesión. Nadie más lo ve.</li>
            <li>Tu contraseña, guardada de forma que nadie, ni siquiera el equipo, puede leerla.</li>
            <li>La fecha en que creaste la cuenta y la fecha en que diste esta autorización.</li>
            <li>Lo que publicas: los recursos y apuntes que aportas, y tus preguntas y respuestas en el foro.</li>
          </List>
        </Section>

        <Section title="Para qué los usamos">
          <p>
            Solo para que NodoAula funcione: iniciar tu sesión, mostrar lo que publicas y saber qué aportaste, para que
            solo tú, o el equipo al moderar, pueda corregirlo o retirarlo. No los vendemos, no se los entregamos a
            terceros y no te enviamos publicidad.
          </p>
        </Section>

        <Section title="Solo mayores de 18 años">
          <p>
            Las cuentas son solo para mayores de 18 años. Si eres menor, puedes buscar en el catálogo, ver los videos y
            leer la vista previa de los apuntes sin crear una cuenta.
          </p>
        </Section>

        <Section title="Tus derechos">
          <List>
            <li>Conocer, actualizar y corregir tus datos.</li>
            <li>Pedir prueba de que nos diste la autorización.</li>
            <li>Saber qué uso les hemos dado.</li>
            <li>Revocar la autorización o pedir que borremos tus datos.</li>
            <li>Consultarlos gratis.</li>
            <li>
              Presentar una queja ante la Superintendencia de Industria y Comercio, después de hacer tu solicitud con
              nosotros.
            </li>
          </List>
        </Section>

        <Section title="Cómo ejercerlos">
          <p>
            Escribe a <ContactEmail /> desde el correo de tu cuenta y dinos qué necesitas. Respondemos una consulta en
            máximo 10 días hábiles y un reclamo (corregir, borrar o revocar) en máximo 15. Si necesitamos más tiempo, te
            avisamos antes con el motivo.
          </p>
        </Section>

        <Section title="Vigencia">
          <p>
            Guardamos tus datos mientras tengas la cuenta y NodoAula esté en funcionamiento. Si cambiamos esta política
            en algo importante, te avisaremos antes de aplicar el cambio.
          </p>
        </Section>
      </article>
    </main>
  )
}
