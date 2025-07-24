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
      return NextResponse.json({ error: 'RESEND_API_KEY no está configurada' }, { status: 500 })
    }

    // Inicializar Resend dentro de la función
    const resend = new Resend(process.env.RESEND_API_KEY)

    // Construir la URL de invitación
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation?token=${token}`

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
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      return NextResponse.json({ error: `Error al enviar el correo desde Resend: ${errorMessage}` }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: `Error interno del servidor: ${errorMessage}` }, { status: 500 })
  }
}