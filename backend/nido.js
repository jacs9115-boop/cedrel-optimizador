// Algoritmo de empaquetado tipo "estantes" (shelf / guillotina), que respeta
// la direccion de la veta de cada pieza. Se elige este metodo porque produce
// cortes de guillotina (de lado a lado), que es como realmente cortan las
// seccionadoras de tableros.

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
      const vetaCorto = p.veta === "corto";
      const dx = vetaCorto ? p.ancho : p.largo;
      const dy = vetaCorto ? p.largo : p.ancho;
      if (dx > sheetW || dy > sheetH) {
        errores.push({ descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, cantidad: p.cantidad });
        return;
      }
      for (let i = 0; i < p.cantidad; i++) {
        instancias.push({ dx, dy, descripcion: p.descripcion, largo: p.largo, ancho: p.ancho, veta: p.veta });
      }
    });

    instancias.sort((a, b) => b.dy - a.dy);

    const sheets = [];
    let currentSheet = null;
    let shelfY = 0;
    let shelfHeight = 0;
    let cursorX = 0;

    instancias.forEach((pieza) => {
      let necesitaNuevaFila = currentSheet === null || cursorX + pieza.dx > sheetW;
      if (necesitaNuevaFila) {
        let necesitaNuevaLamina = currentSheet === null || shelfY + shelfHeight + pieza.dy > sheetH;
        if (necesitaNuevaLamina) {
          currentSheet = { numero: sheets.length + 1, piezas: [] };
          sheets.push(currentSheet);
          shelfY = 0;
        } else {
          shelfY += shelfHeight;
        }
        shelfHeight = pieza.dy;
        cursorX = 0;
      }
      currentSheet.piezas.push({
        x: cursorX, y: shelfY, dx: pieza.dx, dy: pieza.dy,
        descripcion: pieza.descripcion, largo: pieza.largo, ancho: pieza.ancho, veta: pieza.veta,
      });
      cursorX += pieza.dx;
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
