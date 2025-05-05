Troca seeks to facilitate payments between DAOs/protocols and real world entities with privacy and confidence.

DAOs can send stablecoins to Troca escrow, where an intent is signed and triggers a payment through an offchain gateway, the details of this payment are then hashed/signed over and used to generate a ZK proof. Once the proof is validated on chain, the escrow closes the payment as successful. If no ZK proof is provided by our payment gateway within 1 week, the stablecoins are refunded to the sender. This removes the need for a DAO to have a corporate entity, bank accounts, and a trusted offchain spender to access traditional services. ZK guarantees that these payments are provable without exposing all details of the payment.

Alternatively, someone using a traditional payment method can send funds to our escrow account off-chain which then gets proven by a ZK proof to have actually occurred. Using our circuits, a user can prove on chain that a payment was made to our gateway off chain and can be redeemed for stables on chain.

For the current demo, we use Brazil's Pix payment system. This choice is because the Pix API is open and standard among banking instutions and works very well for internal payments. Pix has incredibly wide adoption within Brazil. For services and work, Brazil has a large labor pool and service sector that can now be engaged by DAOs without the roadblocks mentioned above.

The ultimate idea of this concept is to show how we can use blockchain infrastructure as building blocks for payment gateways. This design creates modular payment provider plugins that become interoperable through stablecoins. Think of Paypal USD payment finalizing in a WeChat RMB near instantly.
