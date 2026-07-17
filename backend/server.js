require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { empacar, calcularCantos, calcularCorte, reempacarLamina } = require("./nido");
const { generarPDF } = require("./pdfGenerator");

const PORT = process.env.PORT || 3000;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));
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

app.post("/api/config/precio-canto-material", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_precio_canto_material", ...req.body }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.post("/api/config/precio-corte", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_precio_corte", ...req.body }),
    });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

app.delete("/api/config/precio-corte/:espesor", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const data = await llamarAppsScript(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "borrar_precio_corte", espesor: req.params.espesor }),
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

async function calcularTodo(fileId, tamano) {
  const [piezas, config] = await Promise.all([
    llamarAppsScript(`${APPS_SCRIPT_URL}?leer=${encodeURIComponent(fileId)}`),
    llamarAppsScript(`${APPS_SCRIPT_URL}?config=1`),
  ]);

  if (piezas && piezas.error) {
    throw Object.assign(new Error(piezas.error), { status: 400 });
  }
  if (!Array.isArray(piezas) || piezas.length === 0) {
    throw Object.assign(new Error("No se encontraron piezas validas en el archivo"), { status: 400 });
  }

  const tamanoObj = (config.tamanos || []).find((t) => t.nombre === tamano);
  if (!tamanoObj) {
    throw Object.assign(new Error("Tamaño de lámina no encontrado"), { status: 400 });
  }

  // Descuento de corte: al aserrar se pierde material en los bordes, asi
  // que el area realmente aprovechable es menor que la lamina fisica. El
  // margen es editable por tamaño desde Ajustes (por defecto 20mm).
  const margen = tamanoObj.margen === undefined || tamanoObj.margen === null ? 20 : tamanoObj.margen;
  const tamanoUtil = {
    nombre: tamanoObj.nombre,
    anchoVeta: tamanoObj.anchoVeta - margen,
    alto: tamanoObj.alto - margen,
    anchoNominal: tamanoObj.anchoVeta,
    altoNominal: tamanoObj.alto,
    margen,
  };

  const resultadoEmpaque = empacar(piezas, tamanoUtil);
  const cantos = calcularCantos(piezas);
  const corte = calcularCorte(piezas);

  return {
    resultadoEmpaque,
    cantos,
    corte,
    tamanoUtil,
    preciosMaterial: config.preciosMaterial || {},
    preciosCanto: config.preciosCanto || { flexible: 0, rigido: 0 },
    preciosCantoMaterial: config.preciosCantoMaterial || {},
    preciosCorte: config.preciosCorte || {},
  };
}

app.get("/api/procesar", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const { fileId, tamano } = req.query;
    if (!fileId || !tamano) {
      return res.status(400).json({ error: "Falta fileId o tamano" });
    }

    const datos = await calcularTodo(fileId, tamano);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=optimizacion-cedrel.pdf");
    generarPDF(res, {
      resultadoEmpaque: datos.resultadoEmpaque,
      tamano: datos.tamanoUtil,
      cantos: datos.cantos,
      corte: datos.corte,
      preciosMaterial: datos.preciosMaterial,
      preciosCanto: datos.preciosCanto,
      preciosCantoMaterial: datos.preciosCantoMaterial,
      preciosCorte: datos.preciosCorte,
      logoPath: path.join(__dirname, "..", "frontend", "icons", "icon-512.png"),
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || "Error inesperado" });
    }
  }
});

// Igual que /api/procesar, pero devuelve el resultado en JSON en vez de un
// PDF, para que el editor manual de distribucion pueda dibujar las laminas
// de forma interactiva.
app.get("/api/empacar", async (req, res) => {
  try {
    requireAppsScriptUrl();
    const { fileId, tamano } = req.query;
    if (!fileId || !tamano) {
      return res.status(400).json({ error: "Falta fileId o tamano" });
    }
    const datos = await calcularTodo(fileId, tamano);
    res.json(datos);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Error inesperado" });
  }
});

// Mueve una o varias piezas de una lamina a otra dentro del editor manual.
// Para garantizar que el resultado siga siendo cortable de guillotina y sin
// solapamientos, no se intenta "encajar" las piezas en el hueco donde
// estaban; en cambio se reacomodan desde cero tanto la lamina de origen (sin
// esas piezas) como la de destino (con las piezas agregadas). Si la lamina
// de destino no alcanza a acomodar todas sus piezas (incluidas las nuevas),
// el movimiento se rechaza completo y no se cambia nada.
app.post("/api/mover-pieza", (req, res) => {
  try {
    const { sheets, sheetOrigen, piezaIndices, sheetDestino, anchoVeta, alto } = req.body;
    if (!Array.isArray(sheets) || !Array.isArray(piezaIndices) || !piezaIndices.length || !anchoVeta || !alto) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const origen = sheets.find((s) => s.numero === sheetOrigen);
    const destino = sheets.find((s) => s.numero === sheetDestino);
    if (!origen || !destino) {
      return res.status(400).json({ error: "Lámina de origen o destino no encontrada" });
    }
    const indices = new Set(piezaIndices);
    const piezasAMover = origen.piezas.filter((_, i) => indices.has(i));
    if (piezasAMover.length !== piezaIndices.length) {
      return res.status(400).json({ error: "Pieza no encontrada" });
    }

    const origenRestante = origen.piezas.filter((_, i) => !indices.has(i));
    const destinoConNuevas = [...destino.piezas, ...piezasAMover];

    const rDestino = reempacarLamina(destinoConNuevas, anchoVeta, alto);
    if (rDestino.noCaben.length > 0) {
      return res.json({ ok: false, error: "Las piezas no caben en esa lámina" });
    }
    const rOrigen = reempacarLamina(origenRestante, anchoVeta, alto);

    let nuevasLaminas = sheets.map((s) => {
      if (s.numero === sheetOrigen) return { numero: s.numero, piezas: rOrigen.piezas };
      if (s.numero === sheetDestino) return { numero: s.numero, piezas: rDestino.piezas };
      return s;
    });
    // Si la lamina de origen quedo vacia, se elimina y se renumeran las demas.
    nuevasLaminas = nuevasLaminas.filter((s) => s.piezas.length > 0);
    nuevasLaminas.forEach((s, i) => { s.numero = i + 1; });

    res.json({ ok: true, sheets: nuevasLaminas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

// Dadas una o varias piezas de una lamina, busca en cuales OTRAS laminas del
// mismo material cabrian TODAS juntas si se movieran para alla (reacomodando
// esa lamina desde cero junto con las piezas nuevas). Se usa para sugerirle
// al usuario a donde mover, sin que tenga que ir probando lamina por lamina;
// el usuario tambien puede elegir cualquier otra lamina a mano (el endpoint
// de mover-pieza valida igual si cabe o no).
app.post("/api/donde-cabe", (req, res) => {
  try {
    const { sheets, sheetOrigen, piezaIndices, anchoVeta, alto } = req.body;
    if (!Array.isArray(sheets) || !Array.isArray(piezaIndices) || !piezaIndices.length || !anchoVeta || !alto) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    const origen = sheets.find((s) => s.numero === sheetOrigen);
    if (!origen) {
      return res.status(400).json({ error: "Lámina no encontrada" });
    }
    const indices = new Set(piezaIndices);
    const piezas = origen.piezas.filter((_, i) => indices.has(i));
    if (piezas.length !== piezaIndices.length) {
      return res.status(400).json({ error: "Pieza no encontrada" });
    }

    const candidatos = [];
    sheets.forEach((s) => {
      if (s.numero === sheetOrigen) return;
      const conNuevas = [...s.piezas, ...piezas];
      const r = reempacarLamina(conNuevas, anchoVeta, alto);
      if (r.noCaben.length === 0) {
        const usoResultante = (r.piezas.reduce((sum, p) => sum + p.dx * p.dy, 0) / (anchoVeta * alto)) * 100;
        candidatos.push({ numero: s.numero, usoResultante });
      }
    });
    candidatos.sort((a, b) => b.usoResultante - a.usoResultante);

    res.json({ candidatos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Error inesperado" });
  }
});

// Genera el PDF final a partir de una distribucion ya editada a mano (en
// vez de recalcularla desde el despiece).
app.post("/api/generar-pdf-editado", (req, res) => {
  try {
    const { resultadoEmpaque, tamano, cantos, corte, preciosMaterial, preciosCanto, preciosCantoMaterial, preciosCorte } = req.body;
    if (!resultadoEmpaque || !tamano) {
      return res.status(400).json({ error: "Faltan datos" });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=optimizacion-cedrel.pdf");
    generarPDF(res, {
      resultadoEmpaque, tamano, cantos, corte,
      preciosMaterial: preciosMaterial || {},
      preciosCanto: preciosCanto || { flexible: 0, rigido: 0 },
      preciosCantoMaterial: preciosCantoMaterial || {},
      preciosCorte: preciosCorte || {},
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
