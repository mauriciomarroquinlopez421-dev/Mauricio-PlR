require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

const PORT = process.env.PORT || 8080;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const SYSTEM_PROMPT = `
Eres Agente de Soporte Inglés, asistente virtual del negocio Libro Inglés.

Atiendes por WhatsApp dudas sobre el material digital ABC del Inglés.

TONO:
- Amable, profesional y comercial.
- Claro, breve, preciso y humano.
- Responde en uno o dos párrafos cortos.

REGLAS:
- Usa únicamente la información oficial de esta base de conocimiento.
- No inventes ni supongas información.
- No cambies precios, contenido, métodos de pago, tiempos ni condiciones.
- No prometas resultados específicos.
- No menciones garantías, devoluciones, promociones o beneficios no autorizados.
- No solicites contraseñas ni datos bancarios privados.
- Cuando falte información, indica que el dato debe confirmarse con el equipo.
- Agrega un cierre comercial solo si el cliente pregunta por precio, pago o muestra intención de compra.
- Cuando corresponda orientar al pago, pregunta si prefiere transferencia bancaria o depósito en OXXO.

INFORMACIÓN OFICIAL:
- Negocio: Libro Inglés.
- Producto: material digital ABC del Inglés.
- Contenido: Libro ABC del Inglés, libros complementarios, audios de apoyo y guías extras.
- Precio: $99 pesos mexicanos.
- Métodos de pago: transferencia bancaria y depósito en efectivo en OXXO.
- Condición de pago: pago único, sin mensualidades ni suscripciones, con acceso ilimitado.
- Entrega: mediante WhatsApp en formato digital.
- Tiempo de entrega: aproximadamente de 5 a 10 minutos después de verificar el pago.
- Dispositivos: celular, tablet o computadora. También está listo para imprimir.
- Nivel: desde nivel cero y sin conocimientos previos; avanza progresivamente.
- Soporte: si no recibe el material o tiene un problema, debe solicitar ayuda mediante WhatsApp.
- Contacto: las dudas y solicitudes de ayuda se atienden mediante WhatsApp.

OBJETIVO:
Resolver dudas, orientar al pago cuando corresponda y brindar soporte antes, durante y después de la compra.
`;

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s$]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function elegirAleatoria(opciones) {
  if (!Array.isArray(opciones) || opciones.length === 0) {
    return "";
  }

  return opciones[Math.floor(Math.random() * opciones.length)];
}

function limpiarRespuesta(texto) {
  return String(texto || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*(respuesta|asistente|assistant)\s*:\s*/i, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
}

function contieneAlguna(textoNormalizado, keywords) {
  return keywords.some((keyword) =>
    textoNormalizado.includes(normalizarTexto(keyword))
  );
}

function cierreComercial() {
  return elegirAleatoria([
    "Para continuar, ¿prefieres pagar mediante transferencia bancaria o depósito en OXXO?",
    "Puedes continuar por transferencia bancaria o depósito en OXXO. ¿Cuál opción prefieres?",
    "Para realizar el pago, elige entre transferencia bancaria o depósito en OXXO.",
  ]);
}

function debeAgregarCierre(textoNormalizado) {
  const soporte = [
    "no recibi",
    "no me llego",
    "no llego",
    "problema",
    "error",
    "soporte",
    "ayuda",
    "inconveniente",
    "no abre",
  ];

  if (contieneAlguna(textoNormalizado, soporte)) {
    return false;
  }

  return contieneAlguna(textoNormalizado, [
    "quiero comprar",
    "quiero adquirir",
    "me interesa",
    "lo quiero",
    "como compro",
    "como comprar",
    "precio",
    "costo",
    "cuanto cuesta",
    "cuanto vale",
    "como pago",
    "metodo de pago",
    "forma de pago",
    "transferencia",
    "deposito en oxxo",
    "deposito oxxo",
  ]);
}

function agregarCierre(texto, textoNormalizado) {
  const limpio = limpiarRespuesta(texto);

  if (!limpio) {
    return debeAgregarCierre(textoNormalizado)
      ? cierreComercial()
      : "Necesito confirmar ese dato con el equipo para brindarte información correcta.";
  }

  if (!debeAgregarCierre(textoNormalizado)) {
    return limpio;
  }

  const normalizado = normalizarTexto(limpio);

  if (
    normalizado.includes("cual opcion prefieres") ||
    normalizado.includes("prefieres pagar") ||
    normalizado.includes("elige entre transferencia")
  ) {
    return limpio;
  }

  return `${limpio}\n\n${cierreComercial()}`;
}

function respuestaDirecta(textoNormalizado) {
  const intenciones = [
    {
      nombre: "pago_unico",
      keywords: [
        "pago unico",
        "un solo pago",
        "solo pago una vez",
        "suscripcion",
        "mensualidad",
        "mensualidades",
        "cada mes",
        "renovacion",
        "acceso ilimitado",
        "volver a pagar",
      ],
      respuestas: [
        "El pago es único. No existen mensualidades ni suscripciones y tendrás acceso ilimitado al material.",
        "Solo realizas un pago. No hay mensualidades ni suscripciones y el acceso al material es ilimitado.",
        "No es una suscripción. Pagas una sola vez y conservas acceso ilimitado al material.",
      ],
      cierre: false,
    },
    {
      nombre: "metodos_pago",
      keywords: [
        "metodo de pago",
        "metodos de pago",
        "forma de pago",
        "formas de pago",
        "como puedo pagar",
        "como pago",
        "donde pago",
        "transferencia bancaria",
        "deposito en oxxo",
        "deposito oxxo",
        "pagar en oxxo",
      ],
      respuestas: [
        "Los métodos de pago disponibles son transferencia bancaria y depósito en efectivo en OXXO.",
        "Puedes realizar el pago mediante transferencia bancaria o depósito en efectivo en OXXO.",
        "Aceptamos transferencia bancaria y depósito en efectivo en OXXO.",
      ],
      cierre: true,
    },
    {
      nombre: "tiempo_entrega",
      keywords: [
        "cuanto tarda",
        "cuanto demora",
        "tiempo de entrega",
        "cuando lo recibo",
        "cuando recibo",
        "despues de pagar",
        "despues del pago",
        "5 a 10 minutos",
        "cuantos minutos",
      ],
      respuestas: [
        "Después de verificar tu pago, recibirás el material en aproximadamente 5 a 10 minutos.",
        "La entrega se realiza en un lapso aproximado de 5 a 10 minutos después de verificar el pago.",
        "Una vez verificado el pago, el material se entrega por WhatsApp en aproximadamente 5 a 10 minutos.",
      ],
      cierre: false,
    },
    {
      nombre: "soporte",
      keywords: [
        "no recibi",
        "no me llego",
        "no llego",
        "problema con la entrega",
        "problema con el material",
        "error",
        "soporte",
        "necesito ayuda",
        "inconveniente",
        "no abre",
        "no puedo abrir",
      ],
      respuestas: [
        "Si no recibiste el material o tienes algún inconveniente, comunícate mediante WhatsApp para recibir ayuda.",
        "Para resolver cualquier problema con el material o la entrega, solicita soporte mediante WhatsApp.",
        "Si tienes un inconveniente con la entrega, comunícate por WhatsApp para que el equipo pueda ayudarte.",
      ],
      cierre: false,
    },
    {
      nombre: "contenido",
      keywords: [
        "que incluye",
        "que contiene",
        "que recibo",
        "que recibire",
        "que trae",
        "que viene",
        "contenido del material",
        "incluye audios",
        "incluye guias",
        "incluye libros",
      ],
      respuestas: [
        "Recibirás el Libro ABC del Inglés, libros complementarios, audios de apoyo y guías extras.",
        "El material incluye el Libro ABC del Inglés, libros complementarios, audios de apoyo y guías extras.",
        "Tu compra incluye el Libro ABC del Inglés, además de libros complementarios, audios de apoyo y guías extras.",
      ],
      cierre: false,
    },
    {
      nombre: "forma_entrega",
      keywords: [
        "como recibo el material",
        "como lo recibo",
        "forma de entrega",
        "como se entrega",
        "por donde llega",
        "donde recibo",
        "envian por whatsapp",
        "entrega por whatsapp",
        "formato digital",
      ],
      respuestas: [
        "El material se entrega mediante WhatsApp en formato digital.",
        "Recibirás el material directamente por WhatsApp en formato digital.",
        "La entrega se realiza por WhatsApp y todo el contenido se envía en formato digital.",
      ],
      cierre: false,
    },
    {
      nombre: "precio",
      keywords: [
        "cuanto cuesta",
        "cuanto vale",
        "que precio tiene",
        "cual es el precio",
        "precio del material",
        "costo del material",
        "valor del material",
        "precio",
        "costo",
        "99 pesos",
      ],
      respuestas: [
        "El material tiene un precio de $99 pesos mexicanos.",
        "El costo del material completo es de $99 pesos mexicanos.",
        "Puedes adquirir el material por $99 pesos mexicanos.",
      ],
      cierre: true,
    },
    {
      nombre: "dispositivos",
      keywords: [
        "puedo usarlo en celular",
        "sirve en celular",
        "abrir en celular",
        "ver en celular",
        "android",
        "iphone",
        "tablet",
        "computadora",
        "puedo imprimir",
        "se puede imprimir",
        "listo para imprimir",
      ],
      respuestas: [
        "Sí. Puedes utilizar el material desde celular, tablet o computadora. También está listo para imprimir.",
        "El material puede abrirse desde celular, tablet o computadora y también puedes imprimirlo.",
        "Puedes acceder al material desde distintos dispositivos y, si lo deseas, también imprimirlo.",
      ],
      cierre: false,
    },
    {
      nombre: "nivel_ingles",
      keywords: [
        "necesito saber ingles",
        "conocimientos previos",
        "no se ingles",
        "no conozco ingles",
        "desde cero",
        "nivel cero",
        "soy principiante",
        "para principiantes",
        "nivel basico",
        "nivel avanzado",
      ],
      respuestas: [
        "No necesitas conocimientos previos. El material comienza desde nivel cero y avanza progresivamente.",
        "Puedes comenzar aunque no sepas inglés, porque el material inicia desde nivel cero y avanza de forma progresiva.",
        "El material está pensado para comenzar desde cero y avanzar progresivamente.",
      ],
      cierre: false,
    },
    {
      nombre: "contacto",
      keywords: [
        "como me comunico",
        "como contacto",
        "quiero contactar",
        "hablar con el equipo",
        "hablar con un asesor",
        "atencion al cliente",
        "numero de contacto",
        "tengo una duda",
        "necesito informacion",
      ],
      respuestas: [
        "Puedes comunicarte mediante WhatsApp para resolver cualquier duda.",
        "Las dudas y solicitudes de ayuda se atienden directamente por WhatsApp.",
        "Puedes solicitar atención y soporte mediante WhatsApp.",
      ],
      cierre: false,
    },
    {
      nombre: "intencion_compra",
      keywords: [
        "quiero comprar",
        "quiero adquirir",
        "me interesa comprar",
        "me interesa",
        "lo quiero",
        "como compro",
        "como comprar",
        "quiero el material",
        "deseo comprar",
      ],
      respuestas: [
        "El material cuesta $99 pesos mexicanos y el pago es único.",
        "Puedes adquirir el material mediante un pago único de $99 pesos mexicanos.",
        "El precio del material es de $99 pesos mexicanos y no existen mensualidades ni suscripciones.",
      ],
      cierre: true,
    },
  ];

  for (const intencion of intenciones) {
    if (contieneAlguna(textoNormalizado, intencion.keywords)) {
      const base = elegirAleatoria(intencion.respuestas);

      return {
        intencion: intencion.nombre,
        respuesta: intencion.cierre
          ? agregarCierre(base, textoNormalizado)
          : limpiarRespuesta(base),
      };
    }
  }

  return null;
}

function extraerTextoProfundo(valor, profundidad = 0) {
  if (
    profundidad > 5 ||
    valor === null ||
    valor === undefined
  ) {
    return "";
  }

  if (
    typeof valor === "string" ||
    typeof valor === "number"
  ) {
    return String(valor).trim();
  }

  if (Array.isArray(valor)) {
    for (const elemento of valor) {
      const texto = extraerTextoProfundo(
        elemento,
        profundidad + 1
      );

      if (texto) {
        return texto;
      }
    }

    return "";
  }

  if (typeof valor === "object") {
    const camposPreferidos = [
      "texto",
      "mensaje",
      "message",
      "text",
      "user_message",
      "userMessage",
      "input",
      "query",
      "value",
      "last_text_input",
      "last_user_input",
      "respuesta_usuario",
      "custom_fields",
      "contact",
      "subscriber",
    ];

    for (const campo of camposPreferidos) {
      if (
        Object.prototype.hasOwnProperty.call(valor, campo)
      ) {
        const texto = extraerTextoProfundo(
          valor[campo],
          profundidad + 1
        );

        if (texto) {
          return texto;
        }
      }
    }

    for (const contenido of Object.values(valor)) {
      const texto = extraerTextoProfundo(
        contenido,
        profundidad + 1
      );

      if (texto) {
        return texto;
      }
    }
  }

  return "";
}

function extraerMensaje(req) {
  const candidatos = [
    req.body?.texto,
    req.body?.mensaje,
    req.body?.message,
    req.body?.text,
    req.body?.user_message,
    req.body?.userMessage,
    req.body?.input,
    req.body?.query,
    req.body?.value,
    req.query?.texto,
    req.query?.mensaje,
    req.query?.message,
    req.query?.text,
  ];

  for (const candidato of candidatos) {
    const texto = extraerTextoProfundo(candidato);

    if (texto) {
      return texto;
    }
  }

  return extraerTextoProfundo(req.body);
}

function registrarEvento(tipo, valor) {
  if (tipo === "mensaje") {
    console.log(
      "Mensaje recibido:",
      valor ? "[contenido recibido]" : "[vacío]"
    );
    return;
  }

  if (tipo === "intencion") {
    console.log(
      "Intención detectada:",
      String(valor || "no_identificada").slice(0, 80)
    );
    return;
  }

  if (tipo === "respuesta") {
    console.log(
      "Respuesta enviada:",
      valor ? "[respuesta generada]" : "[respuesta vacía]"
    );
  }
}

async function consultarOpenAI(texto) {
  if (!openai) {
    return "";
  }

  const timeout = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error("OPENAI_TIMEOUT")),
      15000
    );
  });

  const solicitud = openai.responses.create({
    model: OPENAI_MODEL,
    instructions: SYSTEM_PROMPT,
    input: texto,
    temperature: 0.3,
    max_output_tokens: 250,
  });

  const response = await Promise.race([
    solicitud,
    timeout,
  ]);

  return limpiarRespuesta(response.output_text || "");
}

async function procesarMensaje(req, res) {
  try {
    const texto = extraerMensaje(req);

    registrarEvento("mensaje", texto);

    if (!texto) {
      const respuesta =
        "No pude identificar tu mensaje. Por favor, escríbelo nuevamente.";

      registrarEvento("intencion", "mensaje_vacio");
      registrarEvento("respuesta", respuesta);

      return res.status(200).json({
        respuesta,
      });
    }

    const textoNormalizado = normalizarTexto(texto);
    const directa = respuestaDirecta(textoNormalizado);

    if (directa) {
      registrarEvento("intencion", directa.intencion);
      registrarEvento("respuesta", directa.respuesta);

      return res.status(200).json({
        respuesta: directa.respuesta,
      });
    }

    registrarEvento("intencion", "consulta_abierta");

    let respuestaIA = "";

    try {
      respuestaIA = await consultarOpenAI(
        String(texto).trim()
      );
    } catch (errorOpenAI) {
      console.error("Error controlado de OpenAI:", {
        nombre: errorOpenAI?.name || "Error",
        codigo:
          errorOpenAI?.code ||
          errorOpenAI?.message ||
          "sin_codigo",
        estado:
          errorOpenAI?.status || "sin_estado",
      });
    }

    const respuestaFinal = agregarCierre(
      respuestaIA ||
        "Necesito confirmar ese dato con el equipo para brindarte información correcta.",
      textoNormalizado
    );

    registrarEvento("respuesta", respuestaFinal);

    return res.status(200).json({
      respuesta: respuestaFinal,
    });
  } catch (error) {
    console.error("Error controlado en /mensaje:", {
      nombre: error?.name || "Error",
      codigo: error?.code || "sin_codigo",
    });

    const respuesta =
      "En este momento no pude procesar tu mensaje. Por favor, inténtalo nuevamente en unos minutos.";

    registrarEvento("respuesta", respuesta);

    return res.status(200).json({
      respuesta,
    });
  }
}

app.get("/", (req, res) => {
  return res.status(200).json({
    estado: "Agente de soporte activo",
    endpoint: "/mensaje",
  });
});

app.get("/health", (req, res) => {
  return res.status(200).json({
    estado: "ok",
  });
});

app.post("/mensaje", procesarMensaje);
app.post("/webhook", procesarMensaje);
app.post("/manychat", procesarMensaje);

app.use((error, req, res, next) => {
  console.error("Error de solicitud:", {
    nombre: error?.name || "Error",
    tipo: error?.type || "desconocido",
  });

  if (res.headersSent) {
    return next(error);
  }

  return res.status(200).json({
    respuesta:
      "No pude procesar la solicitud. Por favor, verifica el mensaje e inténtalo nuevamente.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
