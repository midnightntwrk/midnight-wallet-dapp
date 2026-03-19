import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
  mintAndReceive(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  sendToUser(context: __compactRuntime.CircuitContext<PS>,
             amount_0: bigint,
             user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveTokens(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  receiveNightTokens(context: __compactRuntime.CircuitContext<PS>,
                     amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sendNightTokensToUser(context: __compactRuntime.CircuitContext<PS>,
                        amount_0: bigint,
                        user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveShieldedTokens(context: __compactRuntime.CircuitContext<PS>,
                        coin_0: { nonce: Uint8Array,
                                  color: Uint8Array,
                                  value: bigint
                                }): __compactRuntime.CircuitResults<PS, []>;
  sendShieldedToUser(context: __compactRuntime.CircuitContext<PS>,
                     input_0: { nonce: Uint8Array,
                                color: Uint8Array,
                                value: bigint,
                                mt_index: bigint
                              },
                     publicKey_0: { bytes: Uint8Array },
                     value_0: bigint): __compactRuntime.CircuitResults<PS, { change: { is_some: boolean,
                                                                                       value: { nonce: Uint8Array,
                                                                                                color: Uint8Array,
                                                                                                value: bigint
                                                                                              }
                                                                                     },
                                                                             sent: { nonce: Uint8Array,
                                                                                     color: Uint8Array,
                                                                                     value: bigint
                                                                                   }
                                                                           }>;
  mintShieldedToSelf(context: __compactRuntime.CircuitContext<PS>,
                     domainSep_0: Uint8Array,
                     value_0: bigint,
                     nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, { nonce: Uint8Array,
                                                                                 color: Uint8Array,
                                                                                 value: bigint
                                                                               }>;
}

export type ProvableCircuits<PS> = {
  mintAndReceive(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  sendToUser(context: __compactRuntime.CircuitContext<PS>,
             amount_0: bigint,
             user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveTokens(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  receiveNightTokens(context: __compactRuntime.CircuitContext<PS>,
                     amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sendNightTokensToUser(context: __compactRuntime.CircuitContext<PS>,
                        amount_0: bigint,
                        user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveShieldedTokens(context: __compactRuntime.CircuitContext<PS>,
                        coin_0: { nonce: Uint8Array,
                                  color: Uint8Array,
                                  value: bigint
                                }): __compactRuntime.CircuitResults<PS, []>;
  sendShieldedToUser(context: __compactRuntime.CircuitContext<PS>,
                     input_0: { nonce: Uint8Array,
                                color: Uint8Array,
                                value: bigint,
                                mt_index: bigint
                              },
                     publicKey_0: { bytes: Uint8Array },
                     value_0: bigint): __compactRuntime.CircuitResults<PS, { change: { is_some: boolean,
                                                                                       value: { nonce: Uint8Array,
                                                                                                color: Uint8Array,
                                                                                                value: bigint
                                                                                              }
                                                                                     },
                                                                             sent: { nonce: Uint8Array,
                                                                                     color: Uint8Array,
                                                                                     value: bigint
                                                                                   }
                                                                           }>;
  mintShieldedToSelf(context: __compactRuntime.CircuitContext<PS>,
                     domainSep_0: Uint8Array,
                     value_0: bigint,
                     nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, { nonce: Uint8Array,
                                                                                 color: Uint8Array,
                                                                                 value: bigint
                                                                               }>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  mintAndReceive(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, Uint8Array>;
  sendToUser(context: __compactRuntime.CircuitContext<PS>,
             amount_0: bigint,
             user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveTokens(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  receiveNightTokens(context: __compactRuntime.CircuitContext<PS>,
                     amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  sendNightTokensToUser(context: __compactRuntime.CircuitContext<PS>,
                        amount_0: bigint,
                        user_addr_0: { bytes: Uint8Array }): __compactRuntime.CircuitResults<PS, []>;
  receiveShieldedTokens(context: __compactRuntime.CircuitContext<PS>,
                        coin_0: { nonce: Uint8Array,
                                  color: Uint8Array,
                                  value: bigint
                                }): __compactRuntime.CircuitResults<PS, []>;
  sendShieldedToUser(context: __compactRuntime.CircuitContext<PS>,
                     input_0: { nonce: Uint8Array,
                                color: Uint8Array,
                                value: bigint,
                                mt_index: bigint
                              },
                     publicKey_0: { bytes: Uint8Array },
                     value_0: bigint): __compactRuntime.CircuitResults<PS, { change: { is_some: boolean,
                                                                                       value: { nonce: Uint8Array,
                                                                                                color: Uint8Array,
                                                                                                value: bigint
                                                                                              }
                                                                                     },
                                                                             sent: { nonce: Uint8Array,
                                                                                     color: Uint8Array,
                                                                                     value: bigint
                                                                                   }
                                                                           }>;
  mintShieldedToSelf(context: __compactRuntime.CircuitContext<PS>,
                     domainSep_0: Uint8Array,
                     value_0: bigint,
                     nonce_0: Uint8Array): __compactRuntime.CircuitResults<PS, { nonce: Uint8Array,
                                                                                 color: Uint8Array,
                                                                                 value: bigint
                                                                               }>;
}

export type Ledger = {
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
