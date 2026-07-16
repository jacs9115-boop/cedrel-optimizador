// Algoritmo de empaquetado tipo "guillotina con rectangulos libres" (variante
// del metodo descrito por Jukka Jylanki en "A Thousand Ways to Pack the
// Bin"). Cada lamina mantiene una lista de espacios libres; para cada pieza
// se busca, entre TODAS las laminas ya abiertas, el espacio libre donde
// mejor encaja (Best Short Side Fit: se minimiza el lado sobrante mas chico
// entre el hueco y la pieza), y luego ese hueco se divide en hasta 2 huecos
// nuevos con un corte de lado a lado (de guillotina), que es como cortan
// realmente las seccionadoras de tableros.
//
// Si la pieza no tiene veta (veta === "no"), se prueban las dos orientaciones
// posibles en cada hueco y se elige la que mejor encaje.

function orientacionesPosibles_(p) {
  if (p.veta === "no") {
    return [
      { dx: p.largo, dy: p.ancho },
      { dx: p.ancho, dy: p.largo },
    ];
  }
  const vetaCorto = p.veta === "corto";
  return [{ dx: vetaCorto ? p.ancho : p.largo, dy: vetaCorto ? p.largo : p.ancho }];
}

// Divide el rectangulo libre "libre" en hasta 2 rectangulos libres nuevos,
// despues de colocar una pieza de pw x ph en su esquina superior izquierda
// (x,y). Se elige el eje de corte que deja el rectangulo sobrante mas grande
// completo (heuristica "shorter leftover axis"), para minimizar la
// fragmentacion del espacio que va quedando.
function dividirLibre_(libre, pw, ph) {
  const sobranteX = libre.w - pw;
  const sobranteY = libre.h - ph;
  const resultado = [];
  if (sobranteX > 0 && sobranteY > 0) {
    if (sobranteX < sobranteY) {
      resultado.push({ x: libre.x + pw, y: libre.y, w: sobranteX, h: libre.h });
      resultado.push({ x: libre.x, y: libre.y + ph, w: pw, h: sobranteY });
    } else {
      resultado.push({ x: libre.x, y: libre.y + ph, w: libre.w, h: sobranteY });
      resultado.push({ x: libre.x + pw, y: libre.y, w: sobranteX, h: ph });
    }
  } else if (sobranteX > 0) {
    resultado.push({ x: libre.x + pw, y: libre.y, w: sobranteX, h: libre.h });
  } else if (sobranteY > 0) {
    resultado.push({ x: libre.x, y: libre.y + ph, w: libre.w, h: sobranteY });
  }
  return resultado;
}

// Elimina rectangulos libres que quedan completamente contenidos dentro de
// otro (serian redundantes y solo hacen mas lenta la busqueda siguiente).
function podarLibres_(libres) {
  const contenido = (a, b) =>
    a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  return libres.filter((a, i) => {
    for (let j = 0; j < libres.length; j++) {
      if (i === j) continue;
      const b = libres[j];
      if (contenido(a, b) && !(contenido(b, a) && j < i)) return false;
    }
    return true;
  });
}

// Puntaje "Best Short Side Fit": el lado sobrante mas chico entre el hueco y
// la pieza (y como desempate, el lado sobrante mas grande). Menor es mejor.
function puntajeAjuste_(libre, o) {
  const sobranteX = libre.w - o.dx;
  const sobranteY = libre.h - o.dy;
  return { ladoCorto: Math.min(sobranteX, sobranteY), ladoLargo: Math.max(sobranteX, sobranteY) };
}

function mejorQue_(a, b) {
  if (!b) return true;
  if (a.ladoCorto !== b.ladoCorto) return a.ladoCorto < b.ladoCorto;
  return a.ladoLargo < b.ladoLargo;
}

function empacar(piezas, tamano) {
  const sheetW = tamano.anchoVeta;
  const sheetH = tamano.alto;

  const porMaterial = {};
  piezas.forEach((p) => {
    if (!porMaterial[p.material]) porMaterial[p.material] = [];
    porMaterial[p.material].push(p);
  });

  const resultado = {};

  Object.keys(porMaterial).forEach((material) => {
    const instancias = [];
    const errores = [];

    porMaterial[material].forEach((p) => {
      const orientaciones = orientacionesPosibles_(p).filter((o) => o.dx <= sheetW && o.dy <= sheetH);
      if (orientaciones.length === 0) {
        errores.push({ descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, cantidad: p.cantidad });
        return;
      }
      for (let i = 0; i < p.cantidad; i++) {
        instancias.push({ orientaciones, descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, veta: p.veta });
      }
    });

    // Se ordena por area descendente: las piezas grandes se acomodan
    // primero, dejando los huecos chicos que van quedando disponibles para
    // las piezas mas chicas (asi rinden mejor los algoritmos de "mejor
    // encaje").
    instancias.sort((a, b) => {
      const areaA = Math.max(...a.orientaciones.map((o) => o.dx * o.dy));
      const areaB = Math.max(...b.orientaciones.map((o) => o.dx * o.dy));
      return areaB - areaA;
    });

    const sheets = [];

    instancias.forEach((pieza) => {
      let mejor = null;
      sheets.forEach((sheet) => {
        sheet.libres.forEach((libre, libreIdx) => {
          pieza.orientaciones.forEach((o) => {
            if (o.dx > libre.w || o.dy > libre.h) return;
            const puntaje = puntajeAjuste_(libre, o);
            if (mejorQue_(puntaje, mejor && mejor.puntaje)) {
              mejor = { sheet, libreIdx, orientacion: o, puntaje };
            }
          });
        });
      });

      let sheetDestino;
      let libreIdxDestino;
      let orientacionElegida;

      if (mejor) {
        sheetDestino = mejor.sheet;
        libreIdxDestino = mejor.libreIdx;
        orientacionElegida = mejor.orientacion;
      } else {
        // No cupo en ninguna lamina abierta: se abre una nueva.
        sheetDestino = { numero: sheets.length + 1, piezas: [], libres: [{ x: 0, y: 0, w: sheetW, h: sheetH }] };
        sheets.push(sheetDestino);
        libreIdxDestino = 0;
        let mejorNueva = null;
        pieza.orientaciones.forEach((o) => {
          const puntaje = puntajeAjuste_(sheetDestino.libres[0], o);
          if (mejorQue_(puntaje, mejorNueva && mejorNueva.puntaje)) {
            mejorNueva = { orientacion: o, puntaje };
          }
        });
        orientacionElegida = mejorNueva.orientacion;
      }

      const libreDestino = sheetDestino.libres[libreIdxDestino];
      sheetDestino.piezas.push({
        x: libreDestino.x, y: libreDestino.y, dx: orientacionElegida.dx, dy: orientacionElegida.dy,
        descripcion: pieza.descripcion, largo: pieza.largo, ancho: pieza.ancho, veta: pieza.veta,
      });

      const nuevosLibres = dividirLibre_(libreDestino, orientacionElegida.dx, orientacionElegida.dy);
      sheetDestino.libres.splice(libreIdxDestino, 1, ...nuevosLibres);
      sheetDestino.libres = podarLibres_(sheetDestino.libres);
    });

    const areaLaminaMM2 = sheetW * sheetH;
    const areaUsadaMM2 = sheets.reduce(
      (sum, s) => sum + s.piezas.reduce((s2, p) => s2 + p.dx * p.dy, 0), 0
    );

    resultado[material] = {
      sheets: sheets.map((s) => ({ numero: s.numero, piezas: s.piezas })),
      sheetsUsadas: sheets.length,
      areaLaminaMM2,
      areaUsadaMM2,
      porcentajeUso: sheets.length > 0 ? (areaUsadaMM2 / (areaLaminaMM2 * sheets.length)) * 100 : 0,
      errores,
    };
  });

  return resultado;
}

function calcularCantos(piezas) {
  let flexibleMM = 0;
  let rigidoMM = 0;
  const porMaterial = {};
  piezas.forEach((p) => {
    if (!porMaterial[p.material]) porMaterial[p.material] = { flexibleMM: 0, rigidoMM: 0 };
    const lados = [
      { tipo: p.l1, longitud: p.largo },
      { tipo: p.l2, longitud: p.largo },
      { tipo: p.a1, longitud: p.ancho },
      { tipo: p.a2, longitud: p.ancho },
    ];
    lados.forEach((lado) => {
      if (lado.tipo === "D") {
        flexibleMM += lado.longitud * p.cantidad;
        porMaterial[p.material].flexibleMM += lado.longitud * p.cantidad;
      }
      if (lado.tipo === "G") {
        rigidoMM += lado.longitud * p.cantidad;
        porMaterial[p.material].rigidoMM += lado.longitud * p.cantidad;
      }
    });
  });
  return { flexibleMM, rigidoMM, porMaterial };
}

// El espesor se toma del nombre del material (ej: "15mm Blanco" -> "15mm"),
// que es como llega desde el despiece, para poder cobrar el servicio de
// corte segun el precio configurado por espesor.
function extraerEspesorMM_(material) {
  const match = /(\d+)\s*mm/i.exec(material || "");
  return match ? `${match[1]}mm` : null;
}

// El servicio de corte se cobra por metro lineal cortado. Se aproxima como
// el perimetro de cada pieza (2 * (largo + ancho)) multiplicado por la
// cantidad de piezas.
function calcularCorte(piezas) {
  const porMaterial = {};
  piezas.forEach((p) => {
    if (!porMaterial[p.material]) {
      porMaterial[p.material] = { metros: 0, espesor: extraerEspesorMM_(p.material) };
    }
    porMaterial[p.material].metros += ((2 * (p.largo + p.ancho)) / 1000) * p.cantidad;
  });
  return porMaterial;
}

module.exports = { empacar, calcularCantos, calcularCorte, extraerEspesorMM_ };
