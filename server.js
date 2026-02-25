const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());

/* =========================
   CORS (ajusta tus dominios)
========================= */
const ALLOWED_ORIGINS = [
  "https://magiosmarketing.com",
  "https://www.magiosmarketing.com",
  // Si pruebas en local:
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
];

app.use(
  cors({
    origin: function (origin, cb) {
      // permitir requests sin origin (Postman/curl)
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS bloqueado para: " + origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const PORT = process.env.PORT || 3000;

// ✅ En producción pon BASE_URL en variables de entorno (Render)
const BASE_URL = process.env.BASE_URL || "https://leder-data-api.ngrok.dev/v1.7";

console.log("✅ API_TOKEN cargado:", process.env.API_TOKEN ? "SI" : "NO");
console.log("✅ BASE_URL:", BASE_URL);
console.log("✅ DEMO_MODE:", process.env.DEMO_MODE === "true" ? "ACTIVO" : "OFF");

/* =========================
   HELPERS
========================= */
function requireField(res, value, msg) {
  if (!value) {
    res.status(400).json({ ok: false, error: msg });
    return false;
  }
  return true;
}

function safeLog(name, err) {
  const status = err.response?.status;
  const data = err.response?.data;
  console.error(`❌ ${name} STATUS:`, status);
  console.error(`❌ ${name} DATA:`, data);
  console.error(`❌ ${name} MSG:`, err.message);
}

function shouldReturnDemo(err) {
  const status = err.response?.status;
  const apiError = err.response?.data?.error;
  return (
    process.env.DEMO_MODE === "true" &&
    (status === 401 ||
      status === 402 ||
      apiError === "invalid token" ||
      apiError === "token without credits")
  );
}

async function callApi(path, payload) {
  const url = `${BASE_URL}${path}`;
  const body = { ...payload, token: process.env.API_TOKEN };
  return axios.post(url, body, { timeout: 25000 });
}

function ok(res, data) {
  return res.json({ ok: true, data });
}

function fail(res, status, error, details) {
  return res.status(status).json({ ok: false, error, details });
}

// wrappers para /api/buscar-todo
function okWrap(data) {
  return { ok: true, data };
}
function failWrap(err, msg) {
  return {
    ok: false,
    error: msg,
    details: err.response?.data || err.message,
    status: err.response?.status || 500,
  };
}

/* =========================
   DEMO DATA (para trabajar sin créditos)
========================= */
function demoArbol(dni) {
  return {
    message: "found data",
    result: {
      person: {
        dni,
        dv: 0,
        ap: "DEMO",
        am: "USUARIO",
        nom: "PRUEBA DEMO USUARIO",
        ge: "MASCULINO",
        edad: 35,
      },
      quantity: 6,
      coincidences: [
        { dni: "22222222", ap: "DEMO", am: "USUARIO", nom: "PAPÁ DEMO", ge: "MASCULINO", edad: 58, tipo: "PADRE", verificacion_relacion: "ALTA" },
        { dni: "11111111", ap: "DEMO", am: "USUARIO", nom: "MAMÁ DEMO", ge: "FEMENINO", edad: 55, tipo: "MADRE", verificacion_relacion: "ALTA" },
        { dni: "90000001", ap: "PAREJA", am: "UNO", nom: "ESPOSA DEMO", ge: "FEMENINO", edad: 32, tipo: "CONYUGE", verificacion_relacion: "ALTA" },
        { dni: "80000001", ap: "HIJO", am: "UNO", nom: "HIJO DEMO 1", ge: "MASCULINO", edad: 8, tipo: "HIJO", verificacion_relacion: "MEDIA" },
        { dni: "80000002", ap: "HIJO", am: "DOS", nom: "HIJO DEMO 2", ge: "FEMENINO", edad: 5, tipo: "HIJA", verificacion_relacion: "MEDIA" },
        { dni: "70000001", ap: "HERMANO", am: "UNO", nom: "HERMANO DEMO", ge: "MASCULINO", edad: 30, tipo: "HERMANO", verificacion_relacion: "BAJA" },
      ],
    },
  };
}

function demoList(kind) {
  const map = {
    sueldos: [
      { empresa: "DEMO SAC", cargo: "OPERARIO", salario: 1800, periodo: "2024-11" },
      { empresa: "DEMO SAC", cargo: "SUPERVISOR", salario: 2500, periodo: "2025-06" },
    ],
    trabajos: [
      { empresa: "DEMO SAC", cargo: "OPERARIO", desde: "2022-01", hasta: "2023-10" },
      { empresa: "OTRA DEMO", cargo: "ASISTENTE", desde: "2023-11", hasta: "2025-02" },
    ],
    empresas: [
      { ruc: "20123456789", razon_social: "DEMO EMPRESA S.A.C.", rol: "SOCIO", estado: "ACTIVO" },
    ],
    direcciones: [
      { direccion: "Av. Demo 123", distrito: "LIMA", provincia: "LIMA", departamento: "LIMA" },
      { direccion: "Jr. Prueba 456", distrito: "MIRAFLORES", provincia: "LIMA", departamento: "LIMA" },
    ],
  };
  return { message: "ok", result: map[kind] || [] };
}

/* =========================
   ENDPOINTS
========================= */

// Árbol Genealógico
app.post("/api/arbol-genealogico", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  try {
    if (process.env.DEMO_MODE === "true") return ok(res, demoArbol(dni));

    const r = await callApi("/persona/arbol-genealogico", { dni });
    return ok(res, r.data ?? { message: "ok", result: null });
  } catch (err) {
    safeLog("ARBOL", err);
    if (shouldReturnDemo(err)) return ok(res, demoArbol(dni));
    return fail(res, err.response?.status || 500, "Error consultando Árbol", err.response?.data || err.message);
  }
});

// Sueldos
app.post("/api/sueldos", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  try {
    if (process.env.DEMO_MODE === "true") return ok(res, demoList("sueldos"));

    const r = await callApi("/persona/sueldos", { dni });
    return ok(res, r.data ?? { message: "ok", result: [] });
  } catch (err) {
    safeLog("SUELDOS", err);
    if (shouldReturnDemo(err)) return ok(res, demoList("sueldos"));
    return fail(res, err.response?.status || 500, "Error consultando Sueldos", err.response?.data || err.message);
  }
});

// Trabajos
app.post("/api/trabajos", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  try {
    if (process.env.DEMO_MODE === "true") return ok(res, demoList("trabajos"));

    const r = await callApi("/persona/trabajos", { dni });
    return ok(res, r.data ?? { message: "ok", result: [] });
  } catch (err) {
    safeLog("TRABAJOS", err);
    if (shouldReturnDemo(err)) return ok(res, demoList("trabajos"));
    return fail(res, err.response?.status || 500, "Error consultando Trabajos", err.response?.data || err.message);
  }
});

// Empresas
app.post("/api/empresas", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  try {
    if (process.env.DEMO_MODE === "true") return ok(res, demoList("empresas"));

    const r = await callApi("/persona/empresas", { dni });
    return ok(res, r.data ?? { message: "ok", result: [] });
  } catch (err) {
    safeLog("EMPRESAS", err);
    if (shouldReturnDemo(err)) return ok(res, demoList("empresas"));
    return fail(res, err.response?.status || 500, "Error consultando Empresas", err.response?.data || err.message);
  }
});

// Direcciones
app.post("/api/direcciones", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  try {
    if (process.env.DEMO_MODE === "true") return ok(res, demoList("direcciones"));

    const r = await callApi("/persona/direcciones", { dni });
    return ok(res, r.data ?? { message: "ok", result: [] });
  } catch (err) {
    safeLog("DIRECCIONES", err);
    if (shouldReturnDemo(err)) return ok(res, demoList("direcciones"));
    return fail(res, err.response?.status || 500, "Error consultando Direcciones", err.response?.data || err.message);
  }
});

// Búsqueda completa (todas en paralelo) ✅ sin localhost
app.post("/api/buscar-todo", async (req, res) => {
  const { dni } = req.body;
  if (!requireField(res, dni, "Falta DNI")) return;

  console.log("🔎 BUSQUEDA COMPLETA DNI:", dni);

  const tasks = {
    arbol: (async () => {
      try {
        if (process.env.DEMO_MODE === "true") return okWrap(demoArbol(dni));
        const r = await callApi("/persona/arbol-genealogico", { dni });
        return okWrap(r.data ?? { message: "ok", result: null });
      } catch (err) {
        safeLog("ARBOL", err);
        if (shouldReturnDemo(err)) return okWrap(demoArbol(dni));
        return failWrap(err, "Error consultando Árbol");
      }
    })(),

    sueldos: (async () => {
      try {
        if (process.env.DEMO_MODE === "true") return okWrap(demoList("sueldos"));
        const r = await callApi("/persona/sueldos", { dni });
        return okWrap(r.data ?? { message: "ok", result: [] });
      } catch (err) {
        safeLog("SUELDOS", err);
        if (shouldReturnDemo(err)) return okWrap(demoList("sueldos"));
        return failWrap(err, "Error consultando Sueldos");
      }
    })(),

    trabajos: (async () => {
      try {
        if (process.env.DEMO_MODE === "true") return okWrap(demoList("trabajos"));
        const r = await callApi("/persona/trabajos", { dni });
        return okWrap(r.data ?? { message: "ok", result: [] });
      } catch (err) {
        safeLog("TRABAJOS", err);
        if (shouldReturnDemo(err)) return okWrap(demoList("trabajos"));
        return failWrap(err, "Error consultando Trabajos");
      }
    })(),

    empresas: (async () => {
      try {
        if (process.env.DEMO_MODE === "true") return okWrap(demoList("empresas"));
        const r = await callApi("/persona/empresas", { dni });
        return okWrap(r.data ?? { message: "ok", result: [] });
      } catch (err) {
        safeLog("EMPRESAS", err);
        if (shouldReturnDemo(err)) return okWrap(demoList("empresas"));
        return failWrap(err, "Error consultando Empresas");
      }
    })(),

    direcciones: (async () => {
      try {
        if (process.env.DEMO_MODE === "true") return okWrap(demoList("direcciones"));
        const r = await callApi("/persona/direcciones", { dni });
        return okWrap(r.data ?? { message: "ok", result: [] });
      } catch (err) {
        safeLog("DIRECCIONES", err);
        if (shouldReturnDemo(err)) return okWrap(demoList("direcciones"));
        return failWrap(err, "Error consultando Direcciones");
      }
    })(),
  };

  const entries = await Promise.all(
    Object.entries(tasks).map(async ([k, p]) => [k, await p])
  );

  const response = Object.fromEntries(entries);
  return res.json({ ok: true, dni, ...response });
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ Backend corriendo en puerto ${PORT}`);
});