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
const configPath = process.argv[2] || 'config.json';
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const transfers = config.transfers;

// Create a new connection to the Solana mainnet
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

// Check account balance
async function checkBalance() {
  const balance = await connection.getBalance(sender.publicKey);
  const totalTransferAmount = transfers.reduce((acc, transfer) => acc + transfer.amount, 0);
  const transactionFee = await connection.getFeeForMessage(new solanaWeb3.Message({instructions: []}), 'confirmed');
  return balance >= totalTransferAmount + transactionFee;
}

// Create and sign transactions
async function signAndSendTransactions() {
  if (!await checkBalance()) {
    console.error('Insufficient funds in the account to cover transaction fees and transfer amounts.');
    return;
  }

  const results = {
    success: [],
    failure: []
  };

  for (const transfer of transfers) {
    const transaction = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: new solanaWeb3.PublicKey(transfer.to),
        lamports: transfer.amount
      })
    );

    try {
      // Sign and send the transaction
      const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [sender], { skipPreflight: false });
      console.log(`Transaction successful, signature: ${signature}`);
      results.success.push(signature);
    } catch (error) {
      console.error(`Batch transfer failed, target address: ${transfer.to}`, error);
      results.failure.push(error);
      // Retry logic can be added here
    }
  }

  // Output summary results
  console.log('Batch transfer complete. Success:', results.success.length, 'Failures:', results.failure.length);
}

// Execute batch transfers
signAndSendTransactions();
