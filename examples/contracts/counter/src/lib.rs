#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol};

const COUNT: Symbol = symbol_short!("COUNT");

/// A minimal state-writing contract, used by upgrade-preflight to exercise ledger
/// read/write resource accounting (instance storage) across a protocol upgrade.
#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Increments the persistent counter and returns its new value.
    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance().get(&COUNT).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&COUNT, &count);
        count
    }

    /// Reads the counter without writing anything.
    pub fn get(env: Env) -> u32 {
        env.storage().instance().get(&COUNT).unwrap_or(0)
    }
}

mod test;
