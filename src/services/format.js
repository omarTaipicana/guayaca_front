export const money = (x) => Number(x || 0).toFixed(2);
export const date = (x) =>
  x
    ? new Date(x).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })
    : "—";
export const labels = {
  salida_domicilio: "Salida del domicilio",
  llegada_carga: "Llegada a carga",
  salida_carga: "Salida de carga",
  llegada_destino: "Llegada a destino",
  entrega: "Entrega y cierre",
};
