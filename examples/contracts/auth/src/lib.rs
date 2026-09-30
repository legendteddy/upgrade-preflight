#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

/// A contract whose only interesting behavior is authorization: it exists so
/// upgrade-preflight has a scenario that exercises `require_auth` and its
/// signature/auth-entry resource costs specifically, since protocol changes to
/// authorization (e.g. CAP-71 credential formats) would show up here first.
#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Requires `caller`'s signature/authorization to succeed at all.
    pub fn restricted(_env: Env, caller: Address) -> u32 {
        caller.require_auth();
        1
    }
}

mod test;
