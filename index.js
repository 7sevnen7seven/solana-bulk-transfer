// Import the Solana Web3.js library and the file system library
const solanaWeb3 = require('@solana/web3.js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Read the private key from environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY.split(',').map(num => parseInt(num, 10));
const sender = solanaWeb3.Keypair.fromSecretKey(new Uint8Array(PRIVATE_KEY));

// Read transfer targets from the configuration file
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const transfers = config.transfers;

// Create a new connection to the Solana mainnet
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

// Create and sign transactions
async function signAndSendTransactions() {
  let transaction = new solanaWeb3.Transaction();
  for (const [index, transfer] of transfers.entries()) {
    transaction.add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: new solanaWeb3.PublicKey(transfer.to),
        lamports: transfer.amount
      })
    );

    // If the transaction is too large or it's the last transfer, send the transaction
    if (transaction.instructions.length === solanaWeb3.Transaction.MAX_INSTRUCTIONS_PER_TRANSACTION || index === transfers.length - 1) {
      try {
        // Sign and send the transaction
        const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [sender]);
        console.log(`Transaction successful, signature: ${signature}`);
      } catch (error) {
        console.error('Batch transfer failed:', error);
      }
      // Reset the transaction for the next batch
      transaction = new solanaWeb3.Transaction();
    }
  }
}

// Execute batch transfers
signAndSendTransactions();
