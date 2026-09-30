#![cfg(test)]
use super::*;
use soroban_sdk::Env;

#[test]
fn sums_correctly() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);

    assert_eq!(client.sum_to(&0), 0);
    assert_eq!(client.sum_to(&10), 55);
}
