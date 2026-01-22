// Minimal DApp connector typings for Lace (Midnight edition).
export {}

declare global {
  interface MidnightServiceURIs {
    indexerHttpUrl: string
    indexerWsUrl: string
    proverUrl: string
    nodeUrl: string
    networkId: number
  }

  interface MidnightWalletAPI {
    enable(opts?: { appName?: string; appLogoUrl?: string }): Promise<void>
    getServiceURIs(): Promise<MidnightServiceURIs>
    getCoinPublicKey(): Promise<string> // hex
    getEncryptionPublicKey(): Promise<string> // hex
    balanceTransaction(unprovenTx: unknown, ttlSeconds?: number): Promise<unknown>
    proveTransaction(recipe: unknown): Promise<unknown>
    finalizeTransaction(tx: unknown): Promise<unknown>
    submitTransaction(tx: unknown): Promise<string> // txId
  }

  interface Window {
    midnight?: {
      lace?: MidnightWalletAPI
    }
  }
}
