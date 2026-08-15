require("dotenv").config();

const express = require("express");
const OpenAI = require("openai");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

const PORT = process.env.PORT || 8080;
const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-4.1-mini";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

/* ======================================================
   BASE DE CONOCIMIENTO
====================================================== */

const SYSTEM_PROMPT = `
Eres Agente de Soporte Inglés, asistente virtual del negocio Libro Inglés.

Atiendes dudas por WhatsApp sobre el material digital ABC del Inglés.

TONO:
- Amable.
- Profesional.
- Comercial.
- Claro.
- Breve.
- Preciso.
- Humano.
- Responde máximo en uno o dos párrafos cortos.

REGLAS:
- Usa únicamente la información oficial proporcionada.
- No inventes información.
- No supongas información.
- No cambies precios.
- No cambies el contenido del producto.
- No cambies los métodos de pago.
- No cambies los tiempos de entrega.
- No cambies las condiciones oficiales.
- No prometas resultados específicos.
- No menciones garantías o devoluciones no autorizadas.
- No inventes promociones.
- No solicites contraseñas.
- No solicites información bancaria privada.
- Si falta información, indica que ese dato debe confirmarse con el equipo.
- Agrega un cierre comercial solamente cuando corresponda.
- Si preguntan por precio o pago, orienta al siguiente paso.
- Para orientar al pago pregunta si prefiere transferencia bancaria o depósito en OXXO.

INFORMACIÓN OFICIAL:

Negocio:
Libro Inglés.

Producto:
ABC del Inglés.

Tipo:
Material digital.

Precio:
$99 pesos mexicanos.

Contenido:
- Libro ABC del Inglés.
- Libros complementarios.
- Audios de apoyo.
- Guías extras.

Métodos de pago:
- Transferencia bancaria.
- Depósito en efectivo en OXXO.

Condición de pago:
- Pago único.
- Sin mensualidades.
- Sin suscripciones.
- Acceso ilimitado.

Entrega:
El material se entrega mediante WhatsApp en formato digital.

Tiempo de entrega:
Aproximadamente de 5 a 10 minutos después de verificar el pago.

Dispositivos:
El material puede utilizarse desde:
- Celular.
- Tablet.
- Computadora.

También está listo para imprimir.

Nivel:
El material puede utilizarse desde nivel cero.
No se necesitan conocimientos previos.
El aprendizaje avanza progresivamente.

Soporte:
Si el cliente no recibe el material o tiene algún problema,
debe solicitar ayuda mediante WhatsApp.

OBJETIVO DEL AGENTE:

1. Resolver las dudas del cliente.
2. Orientar al pago cuando corresponda.
3. Brindar soporte antes, durante y después de la compra.
4. Ser claro y preciso para no confundir al cliente.
`;

/* ======================================================
   FUNCIONES GENERALES
====================================================== */

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s$]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function elegirAleatoria(opciones) {
  if (!Array.isArray(opciones) || opciones.length === 0) {
    return "";
  }

  return opciones[
    Math.floor(Math.random() * opciones.length)
  ];
}

function limpiarRespuesta(texto) {
  return String(texto || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(
      /^\s*(respuesta|asistente|assistant)\s*:\s*/i,
      ""
    )
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1200);
}

function contieneAlguna(texto, keywords) {
  const normalizado = normalizarTexto(texto);

  return keywords.some((keyword) =>
    normalizado.includes(normalizarTexto(keyword))
  );
}

/* ======================================================
   CIERRE COMERCIAL
====================================================== */

function cierreComercial() {
  return elegirAleatoria([
    "Para continuar, ¿prefieres transferencia bancaria o depósito en OXXO?",

    "Puedes pagar por transferencia bancaria o depósito en OXXO. ¿Cuál opción prefieres?",

    "Para realizar tu pago, elige entre transferencia bancaria o depósito en OXXO.",
  ]);
}

function debeAgregarCierre(texto) {
  if (
    contieneAlguna(texto, [
      "no recibi",
      "no me llego",
      "problema",
      "error",
      "soporte",
      "ayuda",
      "inconveniente",
      "no abre",
    ])
  ) {
    return false;
  }

  return contieneAlguna(texto, [
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
    "oxxo",
  ]);
}

function agregarCierre(respuesta, textoUsuario) {
  const limpio = limpiarRespuesta(respuesta);

  if (!limpio) {
    if (debeAgregarCierre(textoUsuario)) {
      return cierreComercial();
    }

    return "Necesito confirmar ese dato con el equipo para brindarte información correcta.";
  }

  if (!debeAgregarCierre(textoUsuario)) {
    return limpio;
  }

  const normalizado = normalizarTexto(limpio);

  if (
    normalizado.includes("cual opcion prefieres") ||
    normalizado.includes("prefieres transferencia") ||
    normalizado.includes("elige entre transferencia")
  ) {
    return limpio;
  }

  return `${limpio}\n\n${cierreComercial()}`;
}

/* ======================================================
   INTENCIONES
====================================================== */

const INTENCIONES = [
  {
    nombre: "pago_unico",

    keywords: [
      "pago unico",
      "un solo pago",
      "suscripcion",
      "mensualidad",
      "mensualidades",
      "cada mes",
      "acceso ilimitado",
    ],

    respuestas: [
      "El pago es único. No existen mensualidades ni suscripciones y tendrás acceso ilimitado al material.",

      "Solo realizas un pago. No hay mensualidades ni suscripciones y el acceso al material es ilimitado.",
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
      "como pago",
      "como puedo pagar",
      "transferencia",
      "deposito en oxxo",
      "deposito oxxo",
      "pagar en oxxo",
    ],

    respuestas: [
      "Los métodos de pago disponibles son transferencia bancaria y depósito en efectivo en OXXO.",

      "Puedes realizar el pago mediante transferencia bancaria o depósito en efectivo en OXXO.",
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
      "cuantos minutos",
    ],

    respuestas: [
      "Después de verificar tu pago, recibirás el material en aproximadamente 5 a 10 minutos.",

      "La entrega se realiza en un lapso aproximado de 5 a 10 minutos después de verificar el pago.",
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
      "ayuda",
      "inconveniente",
      "no abre",
      "no puedo abrir",
    ],

    respuestas: [
      "Si no recibiste el material o tienes algún inconveniente, comunícate mediante WhatsApp para recibir ayuda.",

      "Para resolver cualquier problema con el material o la entrega, solicita soporte mediante WhatsApp.",
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
      "contenido",
      "incluye audios",
      "incluye guias",
      "incluye libros",
    ],

    respuestas: [
      "Recibirás el Libro ABC del Inglés, libros complementarios, audios de apoyo y guías extras.",

      "El material incluye el Libro ABC del Inglés, libros complementarios, audios de apoyo y guías extras.",
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
      "entrega por whatsapp",
      "envian por whatsapp",
      "formato digital",
      "entrega",
    ],

    respuestas: [
      "El material se entrega mediante WhatsApp en formato digital.",

      "Recibirás el material directamente por WhatsApp en formato digital.",
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
      "precio",
      "costo",
      "valor",
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
      "celular",
      "android",
      "iphone",
      "tablet",
      "computadora",
      "imprimir",
      "puedo imprimir",
      "se puede imprimir",
    ],

    respuestas: [
      "Sí. Puedes utilizar el material desde celular, tablet o computadora. También está listo para imprimir.",

      "El material puede abrirse desde celular, tablet o computadora y también puedes imprimirlo.",
    ],

    cierre: false,
  },

  {
    nombre: "nivel_ingles",

    keywords: [
      "desde cero",
      "nivel cero",
      "principiante",
      "principiantes",
      "no se ingles",
      "conocimientos previos",
      "nivel basico",
      "nivel avanzado",
    ],

    respuestas: [
      "No necesitas conocimientos previos. El material comienza desde nivel cero y avanza progresivamente.",

      "Puedes comenzar aunque no sepas inglés, porque el material inicia desde nivel cero y avanza de forma progresiva.",
    ],

    cierre: false,
  },

  {
    nombre: "contacto",

    keywords: [
      "contacto",
      "como contacto",
      "como me comunico",
      "hablar con un asesor",
      "hablar con el equipo",
      "atencion al cliente",
      "numero de contacto",
    ],

    respuestas: [
      "Puedes comunicarte mediante WhatsApp para resolver cualquier duda.",

      "Las dudas y solicitudes de ayuda se atienden directamente por WhatsApp.",
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
      "quiero el material",
      "como compro",
      "como comprar",
      "deseo comprar",
    ],

    respuestas: [
      "El material cuesta $99 pesos mexicanos y el pago es único.",

      "Puedes adquirir el material mediante un pago único de $99 pesos mexicanos.",
    ],

    cierre: true,
  },
];

/* ======================================================
   RESPUESTA DIRECTA
====================================================== */

function respuestaDirecta(textoNormalizado) {
  for (const intencion of INTENCIONES) {
    if (
      contieneAlguna(
        textoNormalizado,
        intencion.keywords
      )
    ) {
      const base = elegirAleatoria(
        intencion.respuestas
      );

      return {
        intencion: intencion.nombre,

        respuesta: intencion.cierre
          ? agregarCierre(
              base,
              textoNormalizado
            )
          : limpiarRespuesta(base),
      };
    }
  }

  return null;
}

/* ======================================================
   EXTRAER MENSAJE DE MANYCHAT / N8N
====================================================== */

function extraerTextoProfundo(
  valor,
  profundidad = 0
) {
  if (
    profundidad > 8 ||
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
    for (const item of valor) {
      const texto = extraerTextoProfundo(
        item,
        profundidad + 1
      );

      if (texto) {
        return texto;
      }
    }

    return "";
  }

  if (typeof valor === "object") {
    const campos = [
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
      "last_input_text",
      "respuesta_usuario",
      "user_input",
      "userInput",
    ];

    for (const campo of campos) {
      if (
        Object.prototype.hasOwnProperty.call(
          valor,
          campo
        )
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

    for (
      const contenido of Object.values(valor)
    ) {
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
    req.body?.user_input,
    req.body?.userInput,

    req.query?.texto,
    req.query?.mensaje,
    req.query?.message,
    req.query?.text,
    req.query?.input,
    req.query?.query,
  ];

  for (const candidato of candidatos) {
    const texto =
      extraerTextoProfundo(candidato);

    if (texto) {
      return texto;
    }
  }

  return extraerTextoProfundo(req.body);
}

/* ======================================================
   FORMATO DE RESPUESTA
====================================================== */

function jsonRespuesta(
  respuesta,
  intencion = "no_identificada"
) {
  const texto =
    limpiarRespuesta(respuesta);

  return {
    respuesta: texto,

    // Campos adicionales para facilitar n8n/ManyChat
    reply: texto,
    message: texto,
    text: texto,

    intencion,
    success: true,
  };
}

/* ======================================================
   LOGS SEGUROS
====================================================== */

function logSeguro(tipo, valor) {
  if (tipo === "mensaje") {
    console.log(
      "Mensaje recibido:",
      valor
        ? "[contenido recibido]"
        : "[vacío]"
    );

    return;
  }

  if (tipo === "intencion") {
    console.log(
      "Intención detectada:",
      String(
        valor || "no_identificada"
      ).slice(0, 80)
    );

    return;
  }

  if (tipo === "respuesta") {
    console.log(
      "Respuesta enviada:",
      valor
        ? "[respuesta generada]"
        : "[respuesta vacía]"
    );
  }
}

/* ======================================================
   OPENAI
====================================================== */

async function consultarOpenAI(texto) {
  if (!openai) {
    return "";
  }

  const solicitud =
    openai.responses.create({
      model: OPENAI_MODEL,

      instructions:
        SYSTEM_PROMPT,

      input:
        String(texto).trim(),

      max_output_tokens: 250,
    });

  const timeout =
    new Promise((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              "OPENAI_TIMEOUT"
            )
          ),
        15000
      );
    });

  const response =
    await Promise.race([
      solicitud,
      timeout,
    ]);

  return limpiarRespuesta(
    response?.output_text || ""
  );
}

/* ======================================================
   PROCESAR MENSAJE
====================================================== */

async function procesarMensaje(req, res) {
  const texto = extraerMensaje(req);

  logSeguro(
    "mensaje",
    texto
  );

  if (!texto) {
    const respuesta =
      "No pude identificar tu mensaje. Por favor, escríbelo nuevamente.";

    logSeguro(
      "intencion",
      "mensaje_vacio"
    );

    logSeguro(
      "respuesta",
      respuesta
    );

    return res
      .status(200)
      .json(
        jsonRespuesta(
          respuesta,
          "mensaje_vacio"
        )
      );
  }

  try {
    const textoNormalizado =
      normalizarTexto(texto);

    const directa =
      respuestaDirecta(
        textoNormalizado
      );

    /* ================================================
       RESPUESTA DE BASE DE CONOCIMIENTO
    ================================================ */

    if (directa) {
      logSeguro(
        "intencion",
        directa.intencion
      );

      logSeguro(
        "respuesta",
        directa.respuesta
      );

      return res
        .status(200)
        .json(
          jsonRespuesta(
            directa.respuesta,
            directa.intencion
          )
        );
    }

    /* ================================================
       CONSULTA ABIERTA
    ================================================ */

    logSeguro(
      "intencion",
      "consulta_abierta"
    );

    let respuestaIA = "";

    try {
      respuestaIA =
        await consultarOpenAI(
          texto
        );
    } catch (errorOpenAI) {
      console.error(
        "OpenAI no respondió:",
        {
          nombre:
            errorOpenAI?.name ||
            "Error",

          codigo:
            errorOpenAI?.code ||
            errorOpenAI?.message ||
            "sin_codigo",

          estado:
            errorOpenAI?.status ||
            "sin_estado",
        }
      );
    }

    const respuestaFinal =
      agregarCierre(
        respuestaIA ||
          "Necesito confirmar ese dato con el equipo para brindarte información correcta.",

        textoNormalizado
      );

    logSeguro(
      "respuesta",
      respuestaFinal
    );

    return res
      .status(200)
      .json(
        jsonRespuesta(
          respuestaFinal,
          "consulta_abierta"
        )
      );
  } catch (error) {
    console.error(
      "Error controlado en /mensaje:",
      {
        nombre:
          error?.name ||
          "Error",

        codigo:
          error?.code ||
          "sin_codigo",
      }
    );

    const respuesta =
      "En este momento no pude procesar tu mensaje. Por favor, inténtalo nuevamente en unos minutos.";

    return res
      .status(200)
      .json(
        jsonRespuesta(
          respuesta,
          "error_controlado"
        )
      );
  }
}

/* ======================================================
   RUTAS
====================================================== */

app.get("/", (req, res) => {
  return res
    .status(200)
    .json({
      success: true,

      estado:
        "Agente de soporte activo",

      endpoint:
        "/mensaje",

      model:
        OPENAI_MODEL,

      openai_configurada:
        Boolean(
          process.env
            .OPENAI_API_KEY
        ),
    });
});

/* ======================================================
   HEALTH CHECK
====================================================== */

app.get(
  "/health",
  (req, res) => {
    return res
      .status(200)
      .json({
        success: true,

        estado: "ok",

        openai_configurada:
          Boolean(
            process.env
              .OPENAI_API_KEY
          ),
      });
  }
);

/* ======================================================
   PRUEBA DIRECTA SIN N8N
====================================================== */

app.get(
  "/test",
  (req, res) => {
    const texto =
      String(
        req.query.texto ||
          req.query.mensaje ||
          "Precio"
      );

    const directa =
      respuestaDirecta(
        normalizarTexto(
          texto
        )
      );

    if (directa) {
      return res
        .status(200)
        .json(
          jsonRespuesta(
            directa.respuesta,
            directa.intencion
          )
        );
    }

    return res
      .status(200)
      .json(
        jsonRespuesta(
          "El servidor está funcionando, pero no se detectó una intención directa.",
          "test"
        )
      );
  }
);

/* ======================================================
   ENDPOINTS COMPATIBLES
====================================================== */

app.post(
  "/",
  procesarMensaje
);

app.post(
  "/mensaje",
  procesarMensaje
);

app.post(
  "/webhook",
  procesarMensaje
);

app.post(
  "/manychat",
  procesarMensaje
);

app.post(
  "/api/mensaje",
  procesarMensaje
);

/* También acepta GET para pruebas */

app.get(
  "/mensaje",
  procesarMensaje
);

app.get(
  "/webhook",
  procesarMensaje
);

app.get(
  "/manychat",
  procesarMensaje
);

/* ======================================================
   RUTA NO ENCONTRADA
====================================================== */

app.use((req, res) => {
  return res
    .status(404)
    .json({
      success: false,

      respuesta:
        "Ruta no encontrada.",

      endpoint_correcto:
        "/mensaje",
    });
});

/* ======================================================
   MANEJO DE ERRORES EXPRESS
====================================================== */

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Error general:",
      {
        nombre:
          error?.name ||
          "Error",

        tipo:
          error?.type ||
          "desconocido",
      }
    );

    if (
      res.headersSent
    ) {
      return next(
        error
      );
    }

    const respuesta =
      "No pude procesar la solicitud. Por favor, inténtalo nuevamente.";

    return res
      .status(200)
      .json(
        jsonRespuesta(
          respuesta,
          "error_solicitud"
        )
      );
  }
);

/* ======================================================
   INICIAR SERVIDOR
====================================================== */

const server =
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `Servidor corriendo en puerto ${PORT}`
      );

      console.log(
        `OpenAI configurada: ${Boolean(
          process.env
            .OPENAI_API_KEY
        )}`
      );
    }
  );

server.keepAliveTimeout =
  65000;

server.headersTimeout =
  66000;
