require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { empacar, calcularCantos } = require("./nido");
const { generarPDF } = require("./pdfGenerator");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

function requireAppsScriptUrl() {
  if (!APPS_SCRIPT_URL) throw new Error("Falta APPS_SCRIPT_URL");
}

async function llamarAppsScript(url, options) {
  const r = await fetch(url, options);
  return r.json();
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/despieces", async (req, res) => {
  try {
    requireAppsScriptUrl();
    res.json(await llamarAppsScript(`${APPS_SCRIPT_URL}?despieces=1`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.get("/api/config", async (req, res) => {
  try {
    requireAppsScriptUrl();
    res.json(await llamarAppsScript(`${APPS_SCRIPT_URL}?config=1`));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.post("/api/config/tamano", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_tamano", ...req.body }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.delete("/api/config/tamano/:nombre", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "borrar_tamano", nombre: req.params.nombre }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.post("/api/config/precio-material", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_precio_material", ...req.body }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.post("/api/config/precio-canto", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_precio_canto", ...req.body }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.get("/api/leer", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: "Falta fileId" });
    const piezas = await llamarAppsScript(`${APPS_SCRIPT_URL}?leer=${encodeURIComponent(fileId)}`);
    if (piezas && piezas.error) return res.status(400).json({ error: piezas.error });
    if (!Array.isArray(piezas) || piezas.length === 0) {
      return res.status(400).json({ error: "No se encontraron piezas validas en el archivo" });
    }
    const materiales = [...new Set(piezas.map((p) => p.material))];
    res.json({ piezas, materiales });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.get("/api/procesar", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const { fileId, tamano } = req.query;
    if (!fileId || !tamano) {
      return res.status(400).json({ error: "Falta fileId o tamano" });
    }

    const [piezas, config] = await Promise.all([
      llamarAppsScript(`${APPS_SCRIPT_URL}?leer=${encodeURIComponent(fileId)}`),
      llamarAppsScript(`${APPS_SCRIPT_URL}?config=1`),
    ]);

    if (piezas && piezas.error) {
      return res.status(400).json({ error: piezas.error });
    }
    if (!Array.isArray(piezas) || piezas.length === 0) {
      return res.status(400).json({ error: "No se encontraron piezas validas en el archivo" });
    }

    const tamanoObj = (config.tamanos || []).find((t) => t.nombre === tamano);
    if (!tamanoObj) {
      return res.status(400).json({ error: "Tamaño de lámina no encontrado" });
    }

    // Descuento de corte: al aserrar se pierde material en los bordes, asi
    // que el area realmente aprovechable es menor que la lamina fisica.
    const MARGEN_CORTE_MM = 20;
    const tamanoUtil = {
      nombre: tamanoObj.nombre,
      anchoVeta: tamanoObj.anchoVeta - MARGEN_CORTE_MM,
      alto: tamanoObj.alto - MARGEN_CORTE_MM,
      anchoNominal: tamanoObj.anchoVeta,
      altoNominal: tamanoObj.alto,
    };

    const resultadoEmpaque = empacar(piezas, tamanoUtil);
    const cantos = calcularCantos(piezas);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=optimizacion-cedrel.pdf");
    generarPDF(res, {
      resultadoEmpaque,
      tamano: tamanoUtil,
      cantos,
      preciosMaterial: config.preciosMaterial || {},
      preciosCanto: config.preciosCanto || { flexible: 0, rigido: 0 },
      logoPath: path.join(__dirname, "..", "frontend", "icons", "icon-512.png"),
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Error inesperado" });
    }
  }
});

app.listen(PORT, () => console.log(`Cedrel Optimizador escuchando en puerto ${PORT}`));
