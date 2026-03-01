function stripProtocolAndTrailingSlash(url) {
  return url.replace(/^(https?|wss?):\/\//, "").replace(/\/+$/, "").replace(/\/wg$/, "");
}

export default function config() {
  const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
  const prefixHttp = (isHttps ? "https" : "http") + "://";
  const prefixWs = (isHttps ? "wss" : "ws") + "://";

  const apiUrlRaw = (process.env.NEXT_PUBLIC_API_URL ?? "localhost:3001").trim();
  const apiUrl =
    apiUrlRaw.startsWith("http://") || apiUrlRaw.startsWith("https://")
      ? apiUrlRaw.replace(/\/+$/, "")
      : prefixHttp + apiUrlRaw.replace(/\/+$/, "");

  const wsHostRaw = (process.env.NEXT_PUBLIC_WS_HOST ?? process.env.NEXT_PUBLIC_API_URL ?? "localhost:3002").trim();
  const wsHost = stripProtocolAndTrailingSlash(wsHostRaw);
  const websocketUrl = prefixWs + wsHost + "/wg";

  return {
    apiUrl,
    websocketUrl,
  };
}