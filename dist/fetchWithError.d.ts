export declare class FetchError extends Error {
    status: number;
    statusText: string;
    responseText: string;
    constructor(status: number, statusText: string, responseText: string, message?: string);
}
export declare function fetchWithError(url: string, options?: RequestInit): Promise<Response>;
//# sourceMappingURL=fetchWithError.d.ts.map