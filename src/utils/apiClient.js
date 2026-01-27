export async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
      console.error("API Error Response:", errorData);
    } catch (e) {
      console.error("Failed to parse error response");
    }
    const error = new Error(`HTTP ${res.status}`);
    error.response = errorData;
    error.status = res.status;
    throw error;
  }
  return res.json();
}
