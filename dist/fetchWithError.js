"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchError = void 0;
exports.fetchWithError = fetchWithError;
class FetchError extends Error {
    status;
    statusText;
    responseText;
    constructor(status, statusText, responseText, message) {
        super(message || `Fetch failed with status ${status}: ${statusText}`);
        this.name = "FetchError";
        this.status = status;
        this.statusText = statusText;
        this.responseText = responseText;
    }
}
exports.FetchError = FetchError;
async function fetchWithError(url, options) {
    const response = await fetch(url, options);
    if (response.ok && response.status >= 200 && response.status < 300) {
        return response;
    }
    const responseText = await response.text();
    console.error(`❌ Fetch error for ${url}: ${response.status} ${response.statusText} - Response: ${responseText}`);
    throw new FetchError(response.status, response.statusText, responseText, `Request to ${url} failed with status ${response.status}`);
}
//# sourceMappingURL=fetchWithError.js.map