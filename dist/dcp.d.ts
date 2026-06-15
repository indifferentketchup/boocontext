export interface DcpEnvelope {
    compressed: boolean;
    originalLength: number;
    compressedLength: number;
    data: string;
}
export declare function compress(input: string, threshold?: number): DcpEnvelope;
export declare function decompress(envelope: DcpEnvelope): string;
