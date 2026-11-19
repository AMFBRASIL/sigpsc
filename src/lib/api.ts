export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("x-sigpsc-request", "1");
  if (init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    let message = "Não foi possível concluir a operação.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      message = "Não foi possível concluir a operação.";
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) return undefined as T;
  return (await response.json()) as T;
}

export async function downloadFile(path: string, filename: string) {
  const response = await fetch(path, { credentials: "include", headers: { "x-sigpsc-request": "1" } });
  if (!response.ok) throw new Error("Não foi possível baixar o arquivo.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadBlob(path: string, filename: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("x-sigpsc-request", "1");
  if (init?.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    let message = "Não foi possível baixar o arquivo.";
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] || filename;
  link.click();
  URL.revokeObjectURL(url);
}
