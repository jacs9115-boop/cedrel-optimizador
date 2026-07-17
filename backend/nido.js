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

// Vuelve a armar la lista de rectangulos libres uniendo los que, aunque se
// hayan guardado por separado durante los cortes sucesivos, en realidad
// forman una sola zona libre continua. Esto pasa seguido cuando se apilan
// piezas de ancho parecido pero distinto (por ejemplo varias tiras de 2392,
// 1659, 1344 y 924mm una debajo de otra): cada una deja un sobrante angosto
// a su derecha, pero esos sobrantes -aunque separados en la lista- se tocan
// entre si y forman un solo tramo mas ancho mas abajo. Sin esta union, el
// algoritmo puede rechazar piezas que en realidad si caben.
//
// La union se hace por franjas horizontales (barrido en Y): en cada franja
// se juntan los tramos libres en X que se tocan, y despues se pegan las
// franjas contiguas que resultan con el mismo tramo en X. El resultado
// sigue siendo 100% cortable de guillotina, porque cualquier rectangulo
// libre asi armado se puede obtener con un corte horizontal de lado a lado
// seguido de un corte vertical de lado a lado dentro de esa franja.
function fusionarLibres_(libres) {
  if (libres.length <= 1) return libres;

  const ys = new Set();
  libres.forEach((l) => { ys.add(l.y); ys.add(l.y + l.h); });
  const yOrdenados = [...ys].sort((a, b) => a - b);

  const franjas = [];
  for (let i = 0; i < yOrdenados.length - 1; i++) {
    const y0 = yOrdenados[i];
    const y1 = yOrdenados[i + 1];
    if (y1 <= y0) continue;
    const tramosX = libres
      .filter((l) => l.y <= y0 && l.y + l.h >= y1)
      .map((l) => ({ x: l.x, w: l.w }))
      .sort((a, b) => a.x - b.x);

    const fusionadosX = [];
    tramosX.forEach((t) => {
      const ultimo = fusionadosX[fusionadosX.length - 1];
      if (ultimo && t.x <= ultimo.x + ultimo.w) {
        ultimo.w = Math.max(ultimo.w, t.x + t.w - ultimo.x);
      } else {
        fusionadosX.push({ ...t });
      }
    });
    fusionadosX.forEach((t) => franjas.push({ x: t.x, y: y0, w: t.w, h: y1 - y0 }));
  }

  // Pegar franjas verticalmente contiguas que compartan exactamente el mismo
  // tramo en X, para no dejar el resultado innecesariamente picado.
  let cambiado = true;
  while (cambiado) {
    cambiado = false;
    for (let i = 0; i < franjas.length && !cambiado; i++) {
      for (let j = i + 1; j < franjas.length; j++) {
        const a = franjas[i];
        const b = franjas[j];
        if (a.x === b.x && a.w === b.w && a.y + a.h === b.y) {
          franjas[i] = { x: a.x, y: a.y, w: a.w, h: a.h + b.h };
          franjas.splice(j, 1);
          cambiado = true;
          break;
        }
        if (a.x === b.x && a.w === b.w && b.y + b.h === a.y) {
          franjas[i] = { x: b.x, y: b.y, w: a.w, h: a.h + b.h };
          franjas.splice(j, 1);
          cambiado = true;
          break;
        }
      }
    }
  }

  return franjas;
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

function clonarLibres_(sheets) {
  return sheets.map((s) => s.libres.map((l) => ({ ...l })));
}

function restaurarLibres_(sheets, snapshot) {
  sheets.forEach((s, i) => { s.libres = snapshot[i]; });
}

// Despues de armar la distribucion inicial, algunas laminas quedan con mucho
// espacio libre (por ejemplo la ultima lamina de cada tanda, que recibe las
// piezas sobrantes). Esta funcion intenta VACIAR por completo las laminas
// menos aprovechadas, moviendo todas sus piezas al espacio libre que haya
// quedado en las demas laminas; si se logra mover TODA una lamina, esa
// lamina se elimina de la lista (una lamina menos que comprar). Se procesa
// siempre la lamina peor aprovechada primero, porque es la que mas
// probablemente se pueda vaciar.
function compactar_(sheets) {
  let cambiado = true;
  while (cambiado && sheets.length > 1) {
    cambiado = false;

    const ordenPorUso = sheets
      .map((s, i) => ({ i, uso: s.piezas.reduce((sum, p) => sum + p.dx * p.dy, 0) }))
      .sort((a, b) => a.uso - b.uso)
      .map((x) => x.i);

    for (const idx of ordenPorUso) {
      const candidata = sheets[idx];
      if (!candidata || candidata.piezas.length === 0) continue;

      const otras = sheets.filter((_, i) => i !== idx);
      const snapshot = clonarLibres_(otras);
      const piezasOrdenadas = [...candidata.piezas].sort((a, b) => b.dx * b.dy - a.dx * a.dy);
      const nuevasUbicaciones = [];
      let exito = true;

      for (const pieza of piezasOrdenadas) {
        const orientaciones = pieza.veta === "no"
          ? [{ dx: pieza.dx, dy: pieza.dy }, { dx: pieza.dy, dy: pieza.dx }]
          : [{ dx: pieza.dx, dy: pieza.dy }];

        let mejor = null;
        otras.forEach((sheet) => {
          sheet.libres.forEach((libre, libreIdx) => {
            orientaciones.forEach((o) => {
              if (o.dx > libre.w || o.dy > libre.h) return;
              const puntaje = puntajeAjuste_(libre, o);
              if (mejorQue_(puntaje, mejor && mejor.puntaje)) {
                mejor = { sheet, libreIdx, orientacion: o, puntaje };
              }
            });
          });
        });

        if (!mejor) { exito = false; break; }

        const libreDestino = mejor.sheet.libres[mejor.libreIdx];
        const nuevosLibres = dividirLibre_(libreDestino, mejor.orientacion.dx, mejor.orientacion.dy);
        mejor.sheet.libres.splice(mejor.libreIdx, 1, ...nuevosLibres);
        mejor.sheet.libres = fusionarLibres_(mejor.sheet.libres);

        nuevasUbicaciones.push({
          sheet: mejor.sheet,
          pieza: {
            ...pieza, x: libreDestino.x, y: libreDestino.y,
            dx: mejor.orientacion.dx, dy: mejor.orientacion.dy,
          },
        });
      }

      if (exito) {
        nuevasUbicaciones.forEach(({ sheet, pieza }) => sheet.piezas.push(pieza));
        sheets.splice(idx, 1);
        cambiado = true;
        break;
      } else {
        restaurarLibres_(otras, snapshot);
      }
    }
  }

  sheets.forEach((s, i) => { s.numero = i + 1; });
  return sheets;
}

// Vuelve a acomodar, desde cero, una lista de piezas en UNA sola lamina
// vacia. Se usa para mover piezas entre laminas en el editor manual: en vez
// de tratar de "agujerear" el hueco donde estaba la pieza (delicado de hacer
// bien con cortes de guillotina), simplemente se re-arma la lamina de origen
// (con la pieza movida afuera) y la lamina de destino (con la pieza movida
// adentro) cada una desde cero. Devuelve tambien las piezas que no
// alcanzaron a caber, para que quien llama pueda decidir que hacer.
function reempacarLamina(piezas, sheetW, sheetH) {
  const sheet = { numero: 1, piezas: [], libres: [{ x: 0, y: 0, w: sheetW, h: sheetH }] };
  const noCaben = [];

  const ordenadas = [...piezas].sort((a, b) => (b.largo * b.ancho) - (a.largo * a.ancho));

  ordenadas.forEach((p) => {
    const orientaciones = orientacionesPosibles_(p).filter((o) => o.dx <= sheetW && o.dy <= sheetH);
    if (orientaciones.length === 0) { noCaben.push(p); return; }

    let mejor = null;
    sheet.libres.forEach((libre, libreIdx) => {
      orientaciones.forEach((o) => {
        if (o.dx > libre.w || o.dy > libre.h) return;
        const puntaje = puntajeAjuste_(libre, o);
        if (mejorQue_(puntaje, mejor && mejor.puntaje)) {
          mejor = { libreIdx, orientacion: o, puntaje };
        }
      });
    });

    if (!mejor) { noCaben.push(p); return; }

    const libreDestino = sheet.libres[mejor.libreIdx];
    sheet.piezas.push({
      x: libreDestino.x, y: libreDestino.y, dx: mejor.orientacion.dx, dy: mejor.orientacion.dy,
      descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, veta: p.veta,
    });
    const nuevosLibres = dividirLibre_(libreDestino, mejor.orientacion.dx, mejor.orientacion.dy);
    sheet.libres.splice(mejor.libreIdx, 1, ...nuevosLibres);
    sheet.libres = fusionarLibres_(sheet.libres);
  });

  return { piezas: sheet.piezas, noCaben, libres: sheet.libres };
}

// Agrega piezas nuevas a una lamina SIN reacomodar las piezas que ya estaban
// (esas se dejan fijas, solo se re-derivan sus huecos libres). Las piezas
// nuevas se intentan colocar de a una, de mayor a menor area, en el espacio
// libre que vaya quedando. Las que no alcancen a caber se devuelven en
// "noCaben" y quedan en la lamina de origen. Esto permite mover "las que
// quepan" en vez de exigir que quepan TODAS las piezas seleccionadas.
function agregarAPiezas(piezasExistentes, piezasNuevas, sheetW, sheetH) {
  const base = reempacarLamina(piezasExistentes, sheetW, sheetH);
  let libres = base.libres;

  const ordenadas = [...piezasNuevas].sort((a, b) => (b.largo * b.ancho) - (a.largo * a.ancho));
  const colocadas = [];
  const noCaben = [];

  ordenadas.forEach((p) => {
    const orientaciones = orientacionesPosibles_(p).filter((o) => o.dx <= sheetW && o.dy <= sheetH);
    let mejor = null;
    libres.forEach((libre, libreIdx) => {
      orientaciones.forEach((o) => {
        if (o.dx > libre.w || o.dy > libre.h) return;
        const puntaje = puntajeAjuste_(libre, o);
        if (mejorQue_(puntaje, mejor && mejor.puntaje)) {
          mejor = { libreIdx, orientacion: o, puntaje };
        }
      });
    });
    if (!mejor) { noCaben.push(p); return; }

    const libreDestino = libres[mejor.libreIdx];
    colocadas.push({
      x: libreDestino.x, y: libreDestino.y, dx: mejor.orientacion.dx, dy: mejor.orientacion.dy,
      descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, veta: p.veta,
    });
    const nuevosLibres = dividirLibre_(libreDestino, mejor.orientacion.dx, mejor.orientacion.dy);
    libres.splice(mejor.libreIdx, 1, ...nuevosLibres);
    libres = fusionarLibres_(libres);
  });

  return { piezas: [...base.piezas, ...colocadas], colocadas, noCaben };
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
      sheetDestino.libres = fusionarLibres_(sheetDestino.libres);
    });

    compactar_(sheets);

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

module.exports = { empacar, calcularCantos, calcularCorte, extraerEspesorMM_, reempacarLamina, agregarAPiezas };
