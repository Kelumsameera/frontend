/** "auto" follows the host used to open the frontend on the LAN. */
function resolveBackendUrl(configured: string | undefined): string {
  if (configured && configured !== "auto") return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://localhost:3000";
  const address = new URL(window.location.origin);
  address.port = "3000";
  return address.origin;
}

export const SOCKET_URL = resolveBackendUrl(process.env.NEXT_PUBLIC_SOCKET_URL);
export const API_URL = resolveBackendUrl(process.env.NEXT_PUBLIC_API_URL);
