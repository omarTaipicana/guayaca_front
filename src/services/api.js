const API = import.meta.env.VITE_API_URL || "/api";
let bearer = sessionStorage.getItem("token") || "";
export const getBearer = () => bearer;
export const setBearer = (value) => {
  bearer = value;
};
export async function api(path, options = {}) {
  let headers = { ...(options.headers || {}) };
  if (bearer) headers.Authorization = "Bearer " + bearer;
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }
  let r = await fetch(API + path, { ...options, headers });
  if (!r.ok) {
    let d = await r.json().catch(() => ({}));
    throw Error(d.error || "Error de conexión");
  }
  return r.json();
}
export async function download(id, name) {
  let r = await fetch(API + "/files/" + id, {
    headers: { Authorization: "Bearer " + bearer },
  });
  if (!r.ok) throw Error("No se pudo descargar");
  let u = URL.createObjectURL(await r.blob()),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
