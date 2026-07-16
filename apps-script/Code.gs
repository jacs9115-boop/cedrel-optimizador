// IMPORTANTE: en el editor de Apps Script, antes de implementar, ve a
// Servicios (icono +) y agrega "Drive API" (Advanced Google Services).
// Sin eso, la conversion de archivos .xls/.xlsx no va a funcionar.

var DESPIECES_FOLDER_ID = "1BSTxLOT06GAM5rua3456i_D94JkEwc8o";

function doGet(e) {
  try {
    if (e.parameter.despieces === "1") return jsonOutput_(listarDespieces_());
    if (e.parameter.leer) return jsonOutput_(leerDespiece_(e.parameter.leer));
    if (e.parameter.config === "1") return jsonOutput_(obtenerConfiguracion_());
    return jsonOutput_({ error: "Parametro no reconocido" });
  } catch (err) {
    return jsonOutput_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.accion === "guardar_tamano") return guardarTamano_(body);
    if (body.accion === "borrar_tamano") return borrarTamano_(body);
    if (body.accion === "guardar_precio_material") return guardarPrecioMaterial_(body);
    if (body.accion === "guardar_precio_canto") return guardarPrecioCanto_(body);
    return jsonOutput_({ ok: false, error: "Accion no reconocida" });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  }
}

// ---------- Listar y leer despieces desde Drive ----------

function listarDespieces_() {
  var folder = DriveApp.getFolderById(DESPIECES_FOLDER_ID);
  var files = folder.getFiles();
  var lista = [];
  while (files.hasNext()) {
    var f = files.next();
    var nombre = f.getName();
    var ext = nombre.split(".").pop().toLowerCase();
    if (ext === "xls" || ext === "xlsx") {
      lista.push({ id: f.getId(), nombre: nombre, fecha: f.getLastUpdated().toISOString() });
    }
  }
  lista.sort(function (a, b) { return new Date(b.fecha) - new Date(a.fecha); });
  return lista;
}

function leerDespiece_(fileId) {
  var data = convertirYLeer_(fileId);
  var encontrado = encontrarEncabezados_(data);
  if (!encontrado) {
    throw new Error("No se encontraron los encabezados esperados (Descripcion, Cant., Largo, Ancho, Veta, L1, L2, A1, A2)");
  }
  var col = encontrado.columnas;
  var piezas = [];
  for (var i = encontrado.filaIndex + 1; i < data.length; i++) {
    var fila = data[i];
    var descripcion = fila[col.descripcion];
    if (!descripcion || String(descripcion).trim() === "") continue;
    var cantidad = Number(fila[col.cant]) || 0;
    var largo = Number(fila[col.largo]) || 0;
    var ancho = Number(fila[col.ancho]) || 0;
    if (cantidad <= 0 || largo <= 0 || ancho <= 0) continue;
    var veta = String(fila[col.veta] || "").trim().toLowerCase();
    piezas.push({
      descripcion: String(descripcion).trim(),
      material: extraerMaterial_(descripcion),
      cantidad: cantidad,
      largo: largo,
      ancho: ancho,
      veta: veta,
      l1: normalizarCanto_(fila[col.l1]),
      l2: normalizarCanto_(fila[col.l2]),
      a1: normalizarCanto_(fila[col.a1]),
      a2: normalizarCanto_(fila[col.a2]),
    });
  }
  return piezas;
}

function convertirYLeer_(fileId) {
  var fileBlob = DriveApp.getFileById(fileId).getBlob();
  var resource = {
    name: "temp_conversion_" + fileId,
    mimeType: MimeType.GOOGLE_SHEETS,
  };
  var convertido = Drive.Files.create(resource, fileBlob);
  try {
    var ss = SpreadsheetApp.openById(convertido.id);
    var hoja = ss.getSheets()[0];
    return hoja.getDataRange().getValues();
  } finally {
    Drive.Files.remove(convertido.id);
  }
}

function encontrarEncabezados_(data) {
  for (var i = 0; i < Math.min(10, data.length); i++) {
    var fila = data[i];
    for (var j = 0; j < fila.length; j++) {
      if (normalizarEncabezado_(fila[j]) === "descripcion") {
        var mapa = {};
        fila.forEach(function (valor, idx) {
          mapa[normalizarEncabezado_(valor)] = idx;
        });
        return { filaIndex: i, columnas: mapa };
      }
    }
  }
  return null;
}

function normalizarEncabezado_(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizarCanto_(valor) {
  var t = String(valor || "").trim().toUpperCase();
  if (t === "D" || t === "G") return t;
  return "";
}

function extraerMaterial_(descripcion) {
  var texto = String(descripcion || "");
  var idx = texto.indexOf(":");
  if (idx === -1) return texto.trim();
  return texto.substring(idx + 1).trim();
}

// ---------- Configuracion: tamanos de lamina y precios ----------

function obtenerConfiguracion_() {
  return {
    tamanos: leerTamanos_(),
    preciosMaterial: leerPreciosMaterial_(),
    preciosCanto: leerPreciosCanto_(),
  };
}

function leerTamanos_() {
  var sheet = obtenerHojaConfig_("TamanosLamina", ["Nombre", "AnchoVeta", "Alto"]);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  return values.filter(function (r) { return r[0]; }).map(function (r) {
    return { nombre: r[0], anchoVeta: Number(r[1]), alto: Number(r[2]) };
  });
}

function guardarTamano_(body) {
  var sheet = obtenerHojaConfig_("TamanosLamina", ["Nombre", "AnchoVeta", "Alto"]);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === body.nombre) {
        sheet.getRange(i + 2, 2, 1, 2).setValues([[Number(body.anchoVeta), Number(body.alto)]]);
        return jsonOutput_({ ok: true });
      }
    }
  }
  sheet.appendRow([body.nombre, Number(body.anchoVeta), Number(body.alto)]);
  return jsonOutput_({ ok: true });
}

function borrarTamano_(body) {
  var sheet = obtenerHojaConfig_("TamanosLamina", ["Nombre", "AnchoVeta", "Alto"]);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === body.nombre) {
        sheet.deleteRow(i + 2);
        break;
      }
    }
  }
  return jsonOutput_({ ok: true });
}

function leerPreciosMaterial_() {
  var sheet = obtenerHojaConfig_("PreciosMaterial", ["Material", "Precio"]);
  var lastRow = sheet.getLastRow();
  var mapa = {};
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    values.forEach(function (r) { if (r[0]) mapa[r[0]] = Number(r[1]) || 0; });
  }
  return mapa;
}

function guardarPrecioMaterial_(body) {
  var sheet = obtenerHojaConfig_("PreciosMaterial", ["Material", "Precio"]);
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === body.material) {
        sheet.getRange(i + 2, 2).setValue(Number(body.precio) || 0);
        return jsonOutput_({ ok: true });
      }
    }
  }
  sheet.appendRow([body.material, Number(body.precio) || 0]);
  return jsonOutput_({ ok: true });
}

function leerPreciosCanto_() {
  var sheet = obtenerHojaConfig_("PreciosCanto", ["Tipo", "Precio"]);
  var lastRow = sheet.getLastRow();
  var precios = { flexible: 0, rigido: 0 };
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    values.forEach(function (r) {
      if (String(r[0]).toLowerCase() === "flexible") precios.flexible = Number(r[1]) || 0;
      if (String(r[0]).toLowerCase() === "rigido") precios.rigido = Number(r[1]) || 0;
    });
  }
  return precios;
}

function guardarPrecioCanto_(body) {
  var sheet = obtenerHojaConfig_("PreciosCanto", ["Tipo", "Precio"]);
  var lastRow = sheet.getLastRow();
  var tipo = body.tipo;
  var encontrado = false;
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]).toLowerCase() === String(tipo).toLowerCase()) {
        sheet.getRange(i + 2, 2).setValue(Number(body.precio) || 0);
        encontrado = true;
        break;
      }
    }
  }
  if (!encontrado) sheet.appendRow([tipo, Number(body.precio) || 0]);
  return jsonOutput_({ ok: true });
}

function obtenerHojaConfig_(nombre, encabezados) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(encabezados);
    if (nombre === "TamanosLamina") {
      sheet.appendRow(["Estandar 2.44 x 1.85", 2440, 1850]);
    }
    if (nombre === "PreciosCanto") {
      sheet.appendRow(["Flexible", 0]);
      sheet.appendRow(["Rigido", 0]);
    }
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
