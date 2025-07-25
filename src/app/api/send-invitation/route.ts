import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(request: Request) {
  try {
    const { email, token, organizationName } = await request.json()

    if (!email || !token || !organizationName) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos: email, token, organizationName' }, { status: 400 })
    }

    // Verificar que la API key esté disponible
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY no está configurada en las variables de entorno')
      return NextResponse.json({ error: 'RESEND_API_KEY no está configurada. Por favor, configura una API key válida de Resend.' }, { status: 500 })
    }

    // Verificar que la API key tenga el formato correcto
    if (!process.env.RESEND_API_KEY.startsWith('re_')) {
      console.error('RESEND_API_KEY no tiene el formato correcto')
      return NextResponse.json({ error: 'RESEND_API_KEY no tiene el formato correcto. Debe comenzar con "re_"' }, { status: 500 })
    }

    // Inicializar Resend dentro de la función
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Verificar que la URL de la app esté configurada
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    
    if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_URL) {
      console.warn('NEXT_PUBLIC_APP_URL no está configurada, usando localhost como fallback')
    }

    // Construir la URL de invitación
    const invitationUrl = `${appUrl}/accept-invitation?token=${token}`
    
    console.log('URL de invitación generada:', invitationUrl)

    const { data, error } = await resend.emails.send({
      from: 'FacturaSaaS <noreply@fu-app.com>',
      to: [email],
      subject: `Invitación para unirte a ${organizationName} en FacturaSaaS`,
      html: `
        <h1>¡Has sido invitado!</h1>
        <p>Has sido invitado a unirte a la organización <strong>${organizationName}</strong> en FacturaSaaS.</p>
        <p>Para aceptar la invitación y crear tu cuenta, haz clic en el siguiente enlace:</p>
        <a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Aceptar Invitación
        </a>
        <p>Si no esperabas esta invitación, puedes ignorar este correo.</p>
        <br>
        <p>El equipo de FacturaSaaS</p>
      `,
    })

    if (error) {
      console.error('Error detallado de Resend:', error)
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      return NextResponse.json({ error: `Error al enviar el correo desde Resend: ${errorMessage}` }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: `Error interno del servidor: ${errorMessage}` }, { status: 500 })
  }
}