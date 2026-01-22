import { ContractDemo } from '../contract/index'
import { ImpureCircuitId, MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

export type DemoContract = ContractDemo.Contract<undefined>;

export type DemoCircuits = ImpureCircuitId<DemoContract>;

export type DemoProviders = MidnightProviders<DemoCircuits>;

export const createSimpleContractInstance = (): DemoContract => new ContractDemo.Contract({});
