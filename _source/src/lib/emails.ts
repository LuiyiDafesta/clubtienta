import { supabase } from './supabase'

// Colores oficiales de Tienta
const COLOR_TEAL = '#026163'
const COLOR_TEAL_DARK = '#01494a'
const COLOR_GOLD = '#caa870'
const COLOR_GOLD_DARK = '#b59469'
const COLOR_CREMA = '#FAF8F5'
const COLOR_CARBON = '#1C1C1C'

function generarTemplateHtml(
  titulo: string,
  subtitulo: string,
  contenidoPrincipal: string,
  callToActionText?: string,
  callToActionUrl?: string
) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: ${COLOR_CREMA};
      color: ${COLOR_CARBON};
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: ${COLOR_CREMA};
      padding: 40px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 32px;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(2, 97, 99, 0.06);
      border: 1px solid rgba(2, 97, 99, 0.04);
    }
    .header {
      background-color: ${COLOR_TEAL};
      background-image: linear-gradient(135deg, ${COLOR_TEAL} 0%, ${COLOR_TEAL_DARK} 100%);
      padding: 48px 32px;
      text-align: center;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 6px;
      background: linear-gradient(90deg, ${COLOR_GOLD} 0%, ${COLOR_GOLD_DARK} 50%, ${COLOR_GOLD} 100%);
    }
    .header-logo {
      font-family: 'Montserrat', sans-serif;
      font-size: 34px;
      font-weight: 900;
      letter-spacing: 0.3em;
      color: #ffffff;
      margin: 0;
      text-transform: uppercase;
      text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header-subtitle {
      font-family: 'Montserrat', sans-serif;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.4em;
      color: #fad08c;
      text-transform: uppercase;
      margin-top: 10px;
    }
    .content {
      padding: 48px 40px;
      text-align: left;
      line-height: 1.6;
    }
    .welcome-badge {
      display: inline-block;
      background-color: rgba(202, 168, 112, 0.12);
      color: ${COLOR_GOLD_DARK};
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      padding: 6px 16px;
      border-radius: 50px;
      margin-bottom: 24px;
      font-family: 'Montserrat', sans-serif;
    }
    .title {
      font-family: 'Playfair Display', 'Montserrat', serif;
      font-size: 28px;
      font-weight: 800;
      color: ${COLOR_TEAL};
      margin-top: 0;
      margin-bottom: 12px;
      line-height: 1.25;
    }
    .subtitle {
      font-size: 15px;
      color: rgba(28, 28, 28, 0.55);
      margin-bottom: 32px;
      font-weight: 600;
      font-family: 'Outfit', sans-serif;
    }
    .paragraph {
      font-size: 15px;
      color: rgba(28, 28, 28, 0.7);
      margin-bottom: 24px;
      font-weight: 400;
    }
    
    /* VIRTUAL LOYALTY CARD */
    .loyalty-card {
      background: linear-gradient(135deg, ${COLOR_TEAL} 0%, ${COLOR_TEAL_DARK} 100%);
      border-radius: 20px;
      padding: 28px;
      color: #ffffff;
      box-shadow: 0 12px 30px rgba(2, 97, 99, 0.2);
      margin-bottom: 36px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .loyalty-card::before {
      content: '';
      position: absolute;
      top: -100px;
      right: -100px;
      width: 250px;
      height: 250px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(202, 168, 112, 0.15) 0%, transparent 70%);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }
    .card-brand {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
    .card-tier {
      background: linear-gradient(135deg, #ffd700 0%, #caa870 100%);
      color: ${COLOR_TEAL_DARK};
      font-size: 10px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      padding: 4px 12px;
      border-radius: 30px;
      font-family: 'Montserrat', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .card-tier.platinum {
      background: linear-gradient(135deg, #e5e5e5 0%, #b0b0b0 100%);
      color: #1a1a1a;
    }
    .card-balance-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: rgba(255, 255, 255, 0.6);
      font-weight: 600;
      margin-bottom: 4px;
    }
    .card-balance {
      font-size: 38px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1;
      font-family: 'Montserrat', sans-serif;
    }
    .card-balance span {
      font-size: 18px;
      font-weight: 600;
      color: #fad08c;
      margin-left: 6px;
    }
    .card-footer {
      display: flex;
      justify-content: space-between;
      margin-top: 32px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 16px;
    }
    .card-meta-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 2px;
    }
    .card-meta-value {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    /* PREMIUM CARD DETAILS */
    .detail-card {
      background-color: ${COLOR_CREMA};
      border: 1px solid rgba(2, 97, 99, 0.06);
      border-radius: 20px;
      padding: 28px;
      margin-bottom: 32px;
    }
    .detail-card-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: ${COLOR_TEAL};
      margin-top: 0;
      margin-bottom: 20px;
      border-bottom: 2px solid rgba(2, 97, 99, 0.08);
      padding-bottom: 10px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 14px;
      font-size: 14px;
      align-items: center;
    }
    .detail-row:last-child {
      margin-bottom: 0;
    }
    .detail-label {
      font-weight: 600;
      color: rgba(28, 28, 28, 0.5);
    }
    .detail-value {
      font-weight: 700;
      color: ${COLOR_CARBON};
    }
    .detail-value.highlight-green {
      color: #10b981;
      font-size: 16px;
      font-weight: 800;
      font-family: 'Montserrat', sans-serif;
    }
    .detail-value.highlight-red {
      color: #ef4444;
      font-size: 16px;
      font-weight: 800;
      font-family: 'Montserrat', sans-serif;
    }
    
    .btn-container {
      text-align: center;
      margin-top: 36px;
      margin-bottom: 20px;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, ${COLOR_GOLD} 0%, ${COLOR_GOLD_DARK} 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 16px 36px;
      border-radius: 50px;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      box-shadow: 0 10px 25px rgba(202, 168, 112, 0.3);
      transition: all 0.3s;
      font-family: 'Montserrat', sans-serif;
    }
    .footer {
      background-color: #ffffff;
      padding: 40px 32px;
      text-align: center;
      border-top: 1px solid rgba(2, 97, 99, 0.05);
    }
    .footer-text {
      font-size: 11px;
      color: rgba(28, 28, 28, 0.4);
      margin-bottom: 10px;
      font-weight: 500;
    }
    .footer-divider {
      height: 1px;
      width: 50px;
      background-color: rgba(2, 97, 99, 0.1);
      margin: 24px auto;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1 class="header-logo">Tienta</h1>
        <div class="header-subtitle">Club de Fidelidad</div>
      </div>
      <div class="content">
        <div class="welcome-badge">${subtitulo}</div>
        ${contenidoPrincipal}
        
        ${callToActionText && callToActionUrl ? `
          <div class="btn-container">
            <a href="${callToActionUrl}" class="btn" target="_blank">${callToActionText}</a>
          </div>
        ` : ''}
      </div>
      <div class="footer">
        <p class="footer-text">Este correo electrónico transaccional fue generado y enviado automáticamente por el sistema de Club Tienta.</p>
        <p class="footer-text">© ${new Date().getFullYear()} Tienta Helados Artesanales. Todos los derechos reservados.</p>
        <div class="footer-divider"></div>
        <p class="footer-text" style="font-size: 10px; font-weight: 600;">Por favor, no respondas directamente a este mensaje.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `
}

export async function enviarEmailTransaccional(
  evento: 'registro_usuario' | 'cambio_contrasena' | 'suma_puntos' | 'canje_premio' | 'ajuste_manual',
  clienteId: string,
  detalles: any,
  clientePreloaded?: {
    id: string
    nombre: string
    apellido: string
    email: string
    dni: string
    telefono: string
    puntos_actuales: number
    nivel: string
    activo?: boolean
  }
) {
  try {
    console.log('[emails.ts] Iniciando enviarEmailTransaccional. Evento:', evento, 'ClienteID:', clienteId)
    // 1. Obtener la URL del webhook de emails transaccionales
    const { data: webhookConfig, error: configError } = await supabase
      .from('configuraciones')
      .select('valor')
      .eq('clave', 'webhook_emails')
      .maybeSingle()

    if (configError) {
      console.error('[emails.ts] Error al leer webhook_emails de configuraciones:', configError)
      return
    }

    if (!webhookConfig || !webhookConfig.valor) {
      console.warn('[emails.ts] Webhook de emails transaccionales no configurado en la DB o vacío.')
      return
    }

    console.log('[emails.ts] URL de webhook obtenido:', webhookConfig.valor)

    let cliente = clientePreloaded

    // 2. Obtener datos detallados del cliente si no vienen pre-cargados
    if (!cliente) {
      console.log('[emails.ts] Cliente no precargado. Buscando en DB para ID:', clienteId)
      const { data: dbCliente, error: clientError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clienteId)
        .maybeSingle()

      if (clientError) {
        console.error('[emails.ts] Error al obtener datos del cliente de la DB:', clientError)
        return
      }
      if (!dbCliente) {
        console.error('[emails.ts] No se encontró el cliente en profiles de la DB.')
        return
      }
      cliente = dbCliente
    } else {
      console.log('[emails.ts] Utilizando datos de cliente precargados:', cliente)
    }

    if (!cliente) {
      console.error('[emails.ts] Error: cliente no definido.')
      return
    }

    let subject = ''
    let htmlContent = ''
    const appUrl = window.location.origin
    const isPlatinum = cliente.nivel === 'Platinum'
    const tierClass = isPlatinum ? 'platinum' : ''

    switch (evento) {
      case 'registro_usuario':
        subject = `¡Te damos la bienvenida al Club Tienta, ${cliente.nombre}! 🍦`
        htmlContent = generarTemplateHtml(
          'Bienvenido al Club',
          'ASOCIACIÓN EXITOSA',
          `
            <h2 class="title">¡Hola, ${cliente.nombre}!</h2>
            <p class="paragraph">Nos hace inmensamente felices darte la bienvenida a <strong>Club Tienta</strong>. A partir de este momento, cada compra de nuestros helados y postres artesanales sumará puntos en tu cuenta para que puedas canjearlos por exquisitas dulzuras de nuestra carta.</p>
            
            <!-- Virtual Card Mockup -->
            <div class="loyalty-card">
              <div class="card-header">
                <span class="card-brand">TIENTA</span>
                <span class="card-tier ${tierClass}">${cliente.nivel}</span>
              </div>
              <div class="card-balance-label">Puntos Disponibles</div>
              <div class="card-balance">${cliente.puntos_actuales} <span>pts</span></div>
              <div class="card-footer">
                <div>
                  <div class="card-meta-label">Socio</div>
                  <div class="card-meta-value">${cliente.nombre} ${cliente.apellido}</div>
                </div>
                <div>
                  <div class="card-meta-label">DNI</div>
                  <div class="card-meta-value">${cliente.dni}</div>
                </div>
              </div>
            </div>

            <div class="detail-card">
              <div class="detail-card-title">Beneficio de Bienvenida</div>
              <div class="detail-row">
                <span class="detail-label">Puntos de Regalo</span>
                <span class="detail-value highlight-green">+${detalles.puntos_bienvenida || 0} pts</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha de Alta</span>
                <span class="detail-value">${new Date().toLocaleDateString('es-AR')}</span>
              </div>
            </div>
            
            <p class="paragraph">Ingresá a tu portal de socio para consultar el catálogo de premios disponibles y ver cómo seguir sumando con tus compras.</p>
          `,
          'Acceder a mi Tarjeta Virtual',
          appUrl
        )
        break

      case 'cambio_contrasena':
        subject = 'Tu contraseña ha sido actualizada - Club Tienta 🔒'
        htmlContent = generarTemplateHtml(
          'Contraseña Actualizada',
          'SEGURIDAD DE LA CUENTA',
          `
            <h2 class="title">Hola, ${cliente.nombre}</h2>
            <p class="paragraph">Te notificamos que la contraseña de acceso a tu portal de <strong>Club Tienta</strong> ha sido restablecida y modificada con éxito recientemente.</p>
            
            <div class="detail-card">
              <div class="detail-card-title">Detalles de Seguridad</div>
              <div class="detail-row">
                <span class="detail-label">Acción</span>
                <span class="detail-value">Cambio de Contraseña</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha y Hora</span>
                <span class="detail-value">${new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })} hs</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Estado</span>
                <span class="detail-value" style="color: #10b981; font-weight: bold;">Exitosa / Protegida</span>
              </div>
            </div>
            
            <p class="paragraph" style="font-size: 13px; color: rgba(28, 28, 28, 0.45); line-height: 1.5;">Si no fuiste vos quien realizó esta modificación, por favor ponete en contacto urgente con el soporte o la administración de Tienta para asegurar tu cuenta.</p>
          `,
          'Ingresar al Portal',
          appUrl
        )
        break

      case 'suma_puntos':
        subject = `¡Sumaste ${detalles.puntos} puntos en Club Tienta! 🎉`
        htmlContent = generarTemplateHtml(
          '¡Puntos Sumados!',
          'COMPRA REGISTRADA',
          `
            <h2 class="title">¡Nueva Compra en Sucursal!</h2>
            <p class="paragraph">¡Qué gran elección! Registramos una nueva compra en tu cuenta y tus puntos ya han sido acreditados. Te mostramos los detalles de la operación:</p>
            
            <!-- Virtual Card Mockup -->
            <div class="loyalty-card">
              <div class="card-header">
                <span class="card-brand">TIENTA</span>
                <span class="card-tier ${tierClass}">${cliente.nivel}</span>
              </div>
              <div class="card-balance-label">Nuevo Balance de Puntos</div>
              <div class="card-balance">${cliente.puntos_actuales} <span>pts</span></div>
              <div class="card-footer">
                <div>
                  <div class="card-meta-label">Socio</div>
                  <div class="card-meta-value">${cliente.nombre} ${cliente.apellido}</div>
                </div>
                <div>
                  <div class="card-meta-label">DNI</div>
                  <div class="card-meta-value">${cliente.dni}</div>
                </div>
              </div>
            </div>

            <div class="detail-card">
              <div class="detail-card-title">Detalles del Ticket</div>
              <div class="detail-row">
                <span class="detail-label">Número de Ticket</span>
                <span class="detail-value">#${detalles.ticket_factura || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Monto Neto Cobrado</span>
                <span class="detail-value">$${Number(detalles.importe || 0).toLocaleString('es-AR')}</span>
              </div>
              ${detalles.descuento_aplicado ? `
              <div class="detail-row">
                <span class="detail-label">Descuento Promocional</span>
                <span class="detail-value" style="color: #ef4444; font-weight: 700;">-$${Number(detalles.descuento_aplicado).toLocaleString('es-AR')}</span>
              </div>
              ` : ''}
              ${detalles.promo_titulo ? `
              <div class="detail-row">
                <span class="detail-label">Promoción Aplicada</span>
                <span class="detail-value" style="color: ${COLOR_GOLD_DARK};">${detalles.promo_titulo}</span>
              </div>
              ` : ''}
              <div class="detail-row" style="border-top: 1px dashed rgba(2, 97, 99, 0.15); margin-top: 14px; padding-top: 14px;">
                <span class="detail-label">Puntos Acreditados</span>
                <span class="detail-value highlight-green">+${detalles.puntos} pts</span>
              </div>
            </div>
            
            <p class="paragraph">¡Muchas gracias por tu visita! Seguí disfrutando de la cremosidad y sumando momentos mágicos en Tienta.</p>
          `,
          'Ver mis Movimientos',
          `${appUrl}/movimientos`
        )
        break

      case 'canje_premio':
        subject = `¡Canje de premio exitoso! Disfrutá tu ${detalles.premio_nombre} 🎁`
        htmlContent = generarTemplateHtml(
          'Canje Confirmado',
          'CANJE DE BENEFICIOS',
          `
            <h2 class="title">¡Muchas gracias por canjear!</h2>
            <p class="paragraph">¡Felicitaciones! Canjeaste tus puntos de fidelidad acumulados por un exquisito beneficio de nuestra carta. Tu felicidad es nuestra prioridad.</p>
            
            <!-- Virtual Card Mockup -->
            <div class="loyalty-card">
              <div class="card-header">
                <span class="card-brand">TIENTA</span>
                <span class="card-tier ${tierClass}">${cliente.nivel}</span>
              </div>
              <div class="card-balance-label">Balance de Puntos Restante</div>
              <div class="card-balance">${cliente.puntos_actuales} <span>pts</span></div>
              <div class="card-footer">
                <div>
                  <div class="card-meta-label">Socio</div>
                  <div class="card-meta-value">${cliente.nombre} ${cliente.apellido}</div>
                </div>
                <div>
                  <div class="card-meta-label">DNI</div>
                  <div class="card-meta-value">${cliente.dni}</div>
                </div>
              </div>
            </div>

            <div class="detail-card">
              <div class="detail-card-title">Premio Canjeado</div>
              <div class="detail-row">
                <span class="detail-label">Premio</span>
                <span class="detail-value" style="color: ${COLOR_TEAL}; font-weight: 800; font-size: 15px;">${detalles.premio_nombre}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Puntos Utilizados</span>
                <span class="detail-value highlight-red">-${Math.abs(detalles.puntos)} pts</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha del Canje</span>
                <span class="detail-value">${new Date().toLocaleDateString('es-AR')}</span>
              </div>
            </div>
            
            <p class="paragraph">Que disfrutes muchísimo de tu momento Tienta. ¡Te esperamos en tu próxima visita para seguir compartiendo sabores increíbles!</p>
          `,
          'Ingresar a mi Portal',
          appUrl
        )
        break

      case 'ajuste_manual':
        const esSuma = detalles.puntos >= 0
        subject = `Actualización de puntos en tu cuenta - Club Tienta 🌟`
        htmlContent = generarTemplateHtml(
          'Actualización de Cuenta',
          'AJUSTE DE PUNTOS',
          `
            <h2 class="title">Novedades en tu Tarjeta</h2>
            <p class="paragraph">Hola, ${cliente.nombre}. Te notificamos que la administración de Tienta ha realizado una actualización de puntos en tu cuenta.</p>
            
            <!-- Virtual Card Mockup -->
            <div class="loyalty-card">
              <div class="card-header">
                <span class="card-brand">TIENTA</span>
                <span class="card-tier ${tierClass}">${cliente.nivel}</span>
              </div>
              <div class="card-balance-label">Nuevo Balance de Puntos</div>
              <div class="card-balance">${cliente.puntos_actuales} <span>pts</span></div>
              <div class="card-footer">
                <div>
                  <div class="card-meta-label">Socio</div>
                  <div class="card-meta-value">${cliente.nombre} ${cliente.apellido}</div>
                </div>
                <div>
                  <div class="card-meta-label">DNI</div>
                  <div class="card-meta-value">${cliente.dni}</div>
                </div>
              </div>
            </div>

            <div class="detail-card">
              <div class="detail-card-title">Detalles de la Actualización</div>
              <div class="detail-row">
                <span class="detail-label">Concepto / Detalle</span>
                <span class="detail-value">${detalles.detalle || 'Ajuste administrativo'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Ajuste de Puntos</span>
                <span class="detail-value ${esSuma ? 'highlight-green' : 'highlight-red'}">${esSuma ? '+' : ''}${detalles.puntos} pts</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Fecha</span>
                <span class="detail-value">${new Date().toLocaleDateString('es-AR')}</span>
              </div>
            </div>
            
            <p class="paragraph">Si tenés alguna inquietud, no dudes en consultar con nuestro equipo de atención en cualquier sucursal.</p>
          `,
          'Ingresar al Portal',
          appUrl
        )
        break
    }

    console.log('[emails.ts] Generando payload para evento:', evento)
    // 3. Lanzar la petición HTTP POST al Webhook con los datos estructurados
    const payload = {
      tipo_evento: evento,
      subject,
      html_content: htmlContent,
      cliente_datos: {
        id: cliente.id,
        dni: cliente.dni,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        email: cliente.email,
        telefono: cliente.telefono,
        puntos_actuales: cliente.puntos_actuales,
        nivel: cliente.nivel,
        activo: cliente.activo
      },
      detalles_evento: detalles,
      timestamp: new Date().toISOString()
    }

    console.log('[emails.ts] Enviando POST al webhook:', webhookConfig.valor)
    
    // Usar fetch asincrónico directo
    fetch(webhookConfig.valor, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        console.log('[emails.ts] Webhook respondió con código:', res.status)
        if (!res.ok) {
          console.error('[emails.ts] Error del webhook de emails transaccionales status:', res.status)
        }
      })
      .catch((err) => {
        console.error('[emails.ts] Error al enviar email transaccional al webhook (CORS o de red):', err)
      })

  } catch (err) {
    console.error('[emails.ts] Error general en enviarEmailTransaccional:', err)
  }
}
