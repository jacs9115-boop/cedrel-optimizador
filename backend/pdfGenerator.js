const PDFDocument = require("pdfkit");

function formatoMoneda(valor) {
  return "$" + Math.round(valor || 0).toLocaleString("es-CO");
}

function generarPDF(res, { resultadoEmpaque, tamano, cantos, preciosMaterial, preciosCanto, logoPath, nombreProyecto }) {
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
  doc.pipe(res);

  const materiales = Object.keys(resultadoEmpaque);
  let costoTotal = 0;

  if (logoPath) {
    try { doc.image(logoPath, 30, 20, { width: 70 }); } catch (e) { /* logo opcional */ }
  }
  doc.fontSize(18).fillColor("#000").text("Optimización de Cortes - Cedrel", 115, 25);
  if (nombreProyecto) doc.fontSize(10).fillColor("#555").text(nombreProyecto, 115, 48);
  const nominalTexto = tamano.anchoNominal
    ? `física ${tamano.anchoNominal} x ${tamano.altoNominal} mm, útil ${tamano.anchoVeta} x ${tamano.alto} mm (descuento de corte)`
    : `${tamano.anchoVeta} x ${tamano.alto} mm`;
  doc.fontSize(9).fillColor("#777").text(
    `Lámina: ${tamano.nombre} — ${nominalTexto} · Generado: ${new Date().toLocaleString("es-CO")}`,
    115, 62
  );

  doc.fillColor("#000").fontSize(13).text("Resumen por material", 30, 105);
  let y = 128;
  doc.fontSize(10);
  materiales.forEach((material) => {
    const r = resultadoEmpaque[material];
    const precio = preciosMaterial[material];
    const tienePrecio = precio !== undefined && precio !== null && precio > 0;
    const costo = tienePrecio ? r.sheetsUsadas * precio : 0;
    costoTotal += costo;
    let linea = `${material}: ${r.sheetsUsadas} lámina(s) — uso ${r.porcentajeUso.toFixed(1)}%`;
    linea += tienePrecio ? ` — ${formatoMoneda(costo)}` : " — (sin precio configurado)";
    if (r.errores && r.errores.length) {
      linea += `  ⚠ ${r.errores.length} pieza(s) no caben en la lámina`;
    }
    doc.text(linea, 30, y, { width: 760 });
    y += 16;
  });

  y += 8;
  const flexibleM = cantos.flexibleMM / 1000;
  const rigidoM = cantos.rigidoMM / 1000;
  const costoCantoFlex = flexibleM * (preciosCanto.flexible || 0);
  const costoCantoRig = rigidoM * (preciosCanto.rigido || 0);
  costoTotal += costoCantoFlex + costoCantoRig;

  doc.fontSize(11).text(`Canto flexible: ${flexibleM.toFixed(2)} m — ${formatoMoneda(costoCantoFlex)}`, 30, y);
  y += 16;
  doc.text(`Canto rígido: ${rigidoM.toFixed(2)} m — ${formatoMoneda(costoCantoRig)}`, 30, y);
  y += 24;
  doc.fontSize(14).text(`COSTO TOTAL ESTIMADO: ${formatoMoneda(costoTotal)}`, 30, y);

  const anyErrores = materiales.some((m) => resultadoEmpaque[m].errores && resultadoEmpaque[m].errores.length);
  if (anyErrores) {
    y += 26;
    doc.fontSize(10).fillColor("#B03A2E").text(
      "Atención: hay piezas que no caben en la lámina seleccionada (ver detalle en la última página).",
      30, y, { width: 760 }
    );
  }

  materiales.forEach((material) => {
    const r = resultadoEmpaque[material];
    r.sheets.forEach((sheet, idx) => {
      doc.addPage();
      doc.fillColor("#000").fontSize(13).text(`${material} — Lámina ${idx + 1} de ${r.sheets.length}`, 30, 20);
      dibujarLamina(doc, sheet, tamano.anchoVeta, tamano.alto, 30, 55);
    });
  });

  if (anyErrores) {
    doc.addPage();
    doc.fontSize(13).fillColor("#000").text("Piezas que no caben en la lámina seleccionada", 30, 30);
    let yy = 60;
    doc.fontSize(9);
    materiales.forEach((material) => {
      const r = resultadoEmpaque[material];
      (r.errores || []).forEach((e) => {
        doc.text(`${material} — ${e.descripcion}: ${e.largo} x ${e.ancho} mm × ${e.cantidad}`, 30, yy);
        yy += 14;
      });
    });
  }

  doc.end();
}

function dibujarLamina(doc, sheet, sheetW, sheetH, startX, startY) {
  const areaDisponibleAncho = 760;
  const areaDisponibleAlto = 480;
  const scale = Math.min(areaDisponibleAncho / sheetW, areaDisponibleAlto / sheetH);

  const w = sheetW * scale;
  const h = sheetH * scale;
  doc.lineWidth(1.5).rect(startX, startY, w, h).stroke("#000");

  sheet.piezas.forEach((p) => {
    const px = startX + p.x * scale;
    const py = startY + p.y * scale;
    const pw = p.dx * scale;
    const ph = p.dy * scale;
    doc.lineWidth(0.5).rect(px, py, pw, ph).stroke("#777");

    // Lineas de veta: la lamina siempre tiene su veta en sentido horizontal
    // (eje X), asi que cualquier pieza que SI lleve veta (largo o corto) se
    // dibuja con lineas horizontales para que se identifique de un vistazo.
    // Las piezas con veta "no" (madera lisa) quedan sin lineas.
    if (p.veta && p.veta !== "no" && pw > 8 && ph > 6) {
      const numLineas = Math.max(2, Math.min(8, Math.floor(ph / 8)));
      doc.strokeColor("#A67C52").lineWidth(0.4);
      for (let i = 1; i < numLineas; i++) {
        const ly = py + (ph * i) / numLineas;
        doc.moveTo(px + 2, ly).lineTo(px + pw - 2, ly).stroke();
      }
      doc.strokeColor("#777");
    }

    if (pw > 26 && ph > 11) {
      doc.fontSize(6).fillColor("#333").text(
        `${Math.round(p.largo)}x${Math.round(p.ancho)}`,
        px + 2, py + 2, { width: pw - 4, height: ph - 4 }
      );
    }
  });
}

module.exports = { generarPDF, formatoMoneda };
