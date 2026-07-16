// Algoritmo de empaquetado tipo "estantes" (shelf / guillotina), que respeta
// la direccion de la veta de cada pieza. Se elige este metodo porque produce
// cortes de guillotina (de lado a lado), que es como realmente cortan las
// seccionadoras de tableros.
//
// Si la pieza no tiene veta (veta === "no"), se prueban las dos orientaciones
// posibles y se elige la que mejor aproveche la lamina en cada momento.

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

    // Se ordena por la altura MINIMA posible de cada pieza (la que usaria por
    // defecto al abrir una fila nueva). Usar la altura maxima aqui degradaba
    // el resultado: procesaba las piezas sin veta como si fueran mas altas de
    // lo que realmente se van a colocar, desordenando el empaquetado.
    instancias.sort((a, b) => {
      const dyA = Math.min(...a.orientaciones.map((o) => o.dy));
      const dyB = Math.min(...b.orientaciones.map((o) => o.dy));
      return dyB - dyA;
    });

    const sheets = [];
    let currentSheet = null;
    let shelfY = 0;
    let shelfHeight = 0;
    let cursorX = 0;

    instancias.forEach((pieza) => {
      // 1) intenta que la pieza quepa en la fila (shelf) actual, en cualquiera
      //    de sus orientaciones validas, sin sobrepasar el ancho ni la altura de la fila.
      let elegida = currentSheet
        ? pieza.orientaciones.find((o) => cursorX + o.dx <= sheetW && o.dy <= shelfHeight)
        : null;

      let necesitaNuevaFila = !elegida;
      if (necesitaNuevaFila) {
        // 2) si no cabe en la fila actual, elige la orientacion mas baja posible
        //    (para desperdiciar lo menos de alto al abrir una fila/lamina nueva).
        elegida = pieza.orientaciones.reduce(
          (mejor, o) => (!mejor || o.dy < mejor.dy ? o : mejor), null
        );
        let necesitaNuevaLamina = currentSheet === null || shelfY + shelfHeight + elegida.dy > sheetH;
        if (necesitaNuevaLamina) {
          currentSheet = { numero: sheets.length + 1, piezas: [] };
          sheets.push(currentSheet);
          shelfY = 0;
        } else {
          shelfY += shelfHeight;
        }
        shelfHeight = elegida.dy;
        cursorX = 0;
      }
      currentSheet.piezas.push({
        x: cursorX, y: shelfY, dx: elegida.dx, dy: elegida.dy,
        descripcion: pieza.descripcion, largo: pieza.largo, ancho: pieza.ancho, veta: pieza.veta,
      });
      cursorX += elegida.dx;
    });

    const areaLaminaMM2 = sheetW * sheetH;
    const areaUsadaMM2 = sheets.reduce(
      (sum, s) => sum + s.piezas.reduce((s2, p) => s2 + p.dx * p.dy, 0), 0
    );

    resultado[material] = {
      sheets,
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
  piezas.forEach((p) => {
    const lados = [
      { tipo: p.l1, longitud: p.largo },
      { tipo: p.l2, longitud: p.largo },
      { tipo: p.a1, longitud: p.ancho },
      { tipo: p.a2, longitud: p.ancho },
    ];
    lados.forEach((lado) => {
      if (lado.tipo === "D") flexibleMM += lado.longitud * p.cantidad;
      if (lado.tipo === "G") rigidoMM += lado.longitud * p.cantidad;
    });
  });
  return { flexibleMM, rigidoMM };
}

module.exports = { empacar, calcularCantos };
