#![no_std]
use soroban_sdk::{contract, contractimpl, Env};

/// A deliberately CPU-heavy, read/write-free contract: it exists purely so
/// upgrade-preflight has a scenario whose cost is dominated by `instructions`
/// rather than ledger I/O, to catch a protocol change that alters the cost of
/// pure computation without touching storage semantics at all.
#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Sums 1..=n using a plain loop (no shortcuts) so the number of instructions
    /// scales with `n`. Callers should pick an `n` large enough to be measurable
    /// but well within the network's instruction limit.
    pub fn sum_to(_env: Env, n: u32) -> u64 {
        let mut total: u64 = 0;
        let mut i: u64 = 0;
        while i < n as u64 {
            i += 1;
            total = total.wrapping_add(i);
        }
        total
    }
}

mod test;
