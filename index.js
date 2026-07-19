require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PORT = process.env.PORT || 8080;

const SYSTEM_PROMPT = `
Eres Isabella Rojas ❤️, una asistente humana, cálida, espiritual y cercana que responde dudas por WhatsApp sobre el libro digital "Cuando Dios Habla".

Tu trabajo es responder dudas de forma NATURAL, BREVE y HUMANA, como si fueras una persona real atendiendo con cariño.

IMPORTANTE:
- Nunca suenes robótica.
- Nunca respondas exactamente igual cada vez.
- Varía ligeramente las palabras y estructura.
- Mantén respuestas cálidas y naturales.
- No escribas demasiado.
- Responde máximo en 1 o 2 párrafos cortos.

REGLAS:
- NO saludes.
- NO uses "Hola".
- NO hagas múltiples preguntas.
- NO hagas preguntas abiertas innecesarias.
- NO digas:
  - "¿Quieres saber más?"
  - "¿Te interesa?"
  - "¿Te gustaría?"
  - "¿Te ayudo en algo más?"
  - "¿Quieres que te cuente?"
- NO seas agresiva vendiendo.
- NO presiones.
- NO inventes información.
- NO menciones correo electrónico.
- NO digas que el libro es físico.

INFORMACIÓN REAL:
- El libro es DIGITAL en PDF.
- El libro NO es físico.
- El PDF YA fue enviado anteriormente por WhatsApp.
- El usuario lo puede encontrar más arriba en esta misma conversación.
- El libro está basado en la Biblia.
- No pertenece a una religión específica.
- No es exclusivamente católico.
- Puede estudiarse con cualquier Biblia.
- Las referencias de apoyo son:
  - 70 MXN como gesto de gratitud
  - 90 MXN para apoyar el proyecto
  - 120 MXN para que este mensaje llegue a más personas

OBJETIVO:
Después de resolver la duda de forma amable y humana, dirige suavemente a la persona al apoyo del proyecto espiritual mediante:
- transferencia bancaria
- depósito en Oxxo

Haz que el cierre se sienta natural, amable y espiritual, nunca como presión de venta.
`;

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function elegirAleatoria(opciones) {
  return opciones[Math.floor(Math.random() * opciones.length)];
}

function limpiarRespuesta(texto) {
  texto = String(texto || "").trim();

  texto = texto
    .replace(/^¡?\s*hola\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "")
    .replace(/^gracias por preguntar\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "")
    .replace(/^buenos días\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "")
    .replace(/^buenos dias\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "")
    .replace(/^buenas tardes\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "")
    .replace(/^buenas noches\s*[😊🙏❤️✨🌿,\.\!]*\s*/gi, "");

  texto = texto
    .replace(/¿[^?]*(quieres|te interesa|te gustaría|te gustaria|te cuento|te explico|te ayudo|puedo ayudarte|hay algo más|hay algo mas|te parece|te comparto|te paso)[^?]*\?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return texto;
}

function cierrePago() {
  const cierres = [
    `💌 Puedes apoyar este proyecto espiritual por transferencia bancaria o depósito en Oxxo ✨

¿Cuál método prefieres? 🙏`,

    `💌 Si deseas apoyar este proyecto espiritual, puedes hacerlo por transferencia bancaria o depósito en Oxxo ✨

¿Qué método prefieres? 🙏`,

    `💌 Para apoyar este proyecto espiritual puedes elegir transferencia bancaria o depósito en Oxxo ✨

¿Cuál opción prefieres? 🙏`,
  ];

  return elegirAleatoria(cierres);
}

function agregarCierre(texto) {
  const limpio = limpiarRespuesta(texto);

  if (!limpio) {
    return cierrePago();
  }

  return `${limpio}

${cierrePago()}`;
}

function respuestaDirecta(textoNormalizado) {
  if (
    textoNormalizado.includes("catolico") ||
    textoNormalizado.includes("catolica") ||
    textoNormalizado.includes("religion") ||
    textoNormalizado.includes("religioso") ||
    textoNormalizado.includes("cristiano") ||
    textoNormalizado.includes("cristiana")
  ) {
    const respuestasReligion = [
      `No es un libro católico como tal, ni pertenece a una religión específica 🌿

Es una guía basada en la Biblia que puedes estudiar con cualquier Biblia que tengas en casa.`,

      `No pertenece a una religión en específico 😊

Es un material basado en la Biblia, pensado para acompañarte en tu vida espiritual de una forma sencilla y cercana.`,

      `Es una guía bíblica, no un libro religioso de una denominación específica 🌿

Puedes estudiarlo con la Biblia que tengas en casa, sin importar tu tradición religiosa.`,
    ];

    return agregarCierre(elegirAleatoria(respuestasReligion));
  }

  if (
    textoNormalizado.includes("envio") ||
    textoNormalizado.includes("enviar") ||
    textoNormalizado.includes("entrega") ||
    textoNormalizado.includes("fisico") ||
    textoNormalizado.includes("pdf") ||
    textoNormalizado.includes("digital") ||
    textoNormalizado.includes("descargar") ||
    textoNormalizado.includes("recibir") ||
    textoNormalizado.includes("recibo") ||
    textoNormalizado.includes("archivo") ||
    textoNormalizado.includes("entrego") ||
    textoNormalizado.includes("llega")
  ) {
    const respuestasEnvio = [
      `El libro es completamente digital 😊

El PDF ya fue enviado anteriormente aquí mismo en WhatsApp, así que solo necesitas abrirlo o descargarlo desde esta conversación 🌿`,

      `No es un libro físico 🙏

Es un material digital en PDF que ya te compartimos anteriormente en esta misma conversación de WhatsApp para que puedas leerlo cuando quieras ✨`,

      `El material ya fue enviado por WhatsApp 😊

Lo encuentras más arriba en esta conversación. Solo necesitas descargar el PDF en tu celular o computadora 🌿`,

      `La entrega es digital 😊

El PDF ya está enviado más arriba en este mismo chat de WhatsApp. No llega nada físico ni se manda por correo; solo debes descargarlo desde aquí mismo 🌿`,
    ];

    return agregarCierre(elegirAleatoria(respuestasEnvio));
  }

  if (
    textoNormalizado.includes("cuanto") ||
    textoNormalizado.includes("cuesta") ||
    textoNormalizado.includes("precio") ||
    textoNormalizado.includes("costo") ||
    textoNormalizado.includes("vale") ||
    textoNormalizado.includes("apoyo") ||
    textoNormalizado.includes("apoyar") ||
    textoNormalizado.includes("aportacion") ||
    textoNormalizado.includes("donacion") ||
    textoNormalizado.includes("pagar") ||
    textoNormalizado.includes("pago")
  ) {
    const respuestasPago = [
      `El libro se comparte como una bendición 🙏

Si nace en tu corazón apoyar este proyecto espiritual, las referencias son:
🌿 70 MXN como gesto de gratitud
🌿 90 MXN para apoyar el proyecto
🌿 120 MXN para que este mensaje llegue a más personas`,

      `El material ya fue compartido con mucho cariño 😊

Para apoyar el proyecto, puedes elegir una de estas referencias:
🌿 70 MXN como gesto de gratitud
🌿 90 MXN para apoyar el proyecto
🌿 120 MXN para ayudar a que llegue a más personas`,

      `Este proyecto se sostiene con el apoyo de las personas que reciben el material 🙏

Puedes apoyar con:
🌿 70 MXN como gesto de gratitud
🌿 90 MXN para apoyar directamente el proyecto
🌿 120 MXN para que este mensaje llegue a más personas`,
    ];

    return agregarCierre(elegirAleatoria(respuestasPago));
  }

  return null;
}

app.get("/", (req, res) => {
  res.send("Bot ventas activo ✅");
});

app.post("/mensaje", async (req, res) => {
  try {
    const texto = req.body.texto || req.body.mensaje || req.body.message || "";

    console.log("Texto recibido:", texto);

    if (!texto) {
      return res.json({ respuesta: cierrePago() });
    }

    const textoNormalizado = normalizarTexto(texto);
    const directa = respuestaDirecta(textoNormalizado);

    if (directa) {
      console.log("Respuesta directa:", directa);
      return res.json({ respuesta: directa });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.4,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: texto },
      ],
    });

    const respuestaIA = response.output_text || "";
    const respuestaFinal = agregarCierre(respuestaIA);

    console.log("Respuesta enviada:", respuestaFinal);

    return res.json({ respuesta: respuestaFinal });
  } catch (error) {
    console.error("Error en /mensaje:", error);

    return res.json({ respuesta: cierrePago() });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
