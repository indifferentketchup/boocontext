const DEFAULT_THRESHOLD = 50_000;
export function compress(input, threshold = DEFAULT_THRESHOLD) {
    if (input.length <= threshold) {
        return {
            compressed: false,
            originalLength: input.length,
            compressedLength: input.length,
            data: input,
        };
    }
    const compressed = compressPayload(input);
    return {
        compressed: true,
        originalLength: input.length,
        compressedLength: compressed.length,
        data: compressed,
    };
}
export function decompress(envelope) {
    if (!envelope.compressed)
        return envelope.data;
    return decompressPayload(envelope.data);
}
function compressPayload(input) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 1000) {
        const chunk = bytes.slice(i, Math.min(i + 1000, bytes.length));
        chunks.push(String.fromCharCode(...chunk));
    }
    const raw = chunks.join("");
    return btoa(raw);
}
function decompressPayload(encoded) {
    const raw = atob(encoded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        bytes[i] = raw.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}
