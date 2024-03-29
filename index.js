// Import necessary libraries
const solanaWeb3 = require('@solana/web3.js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize sender keypair from environment variable
const sender = solanaWeb3.Keypair.fromSecretKey(
  new Uint8Array(process.env.PRIVATE_KEY.split(',').map(num => parseInt(num, 10)))
);

// Load transfer targets from configuration file
const configPath = process.argv[2] || 'config.json';
const { transfers } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Establish connection to the Solana mainnet
const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');

// Function to check if the account has sufficient balance for transfers and fees
async function hasSufficientBalance() {
  const balance = await connection.getBalance(sender.publicKey);
  const totalTransferAmount = transfers.reduce((acc, { amount }) => acc + amount, 0);
  const transactionFee = await getTransactionFee();
  return balance >= totalTransferAmount + transactionFee * transfers.length;
}

// Function to get the current transaction fee
async function getTransactionFee() {
  const { feeCalculator } = await connection.getRecentBlockhash();
  return feeCalculator.lamportsPerSignature;
}

// Function to create a transfer transaction
function createTransferTransaction(to, amount) {
  const recipientPublicKey = new solanaWeb3.PublicKey(to);
  return new solanaWeb3.Transaction().add(
    solanaWeb3.SystemProgram.transfer({
      fromPubkey: sender.publicKey,
      toPubkey: recipientPublicKey,
      lamports: amount
    })
  );
}

// Function to process batch transfers
async function processBatchTransfers() {
  if (!await hasSufficientBalance()) {
    console.error('Insufficient funds for transfers and fees.');
    return;
  }

  const results = { success: [], failure: [] };

  for (const { to, amount } of transfers) {
    const transaction = createTransferTransaction(to, amount);

    try {
      const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [sender]);
      console.log(`Transfer successful: ${signature}`);
      results.success.push(signature);
    } catch (error) {
      console.error(`Transfer to ${to} failed:`, error);
      results.failure.push({ to, error });
    }
  }

  console.log(`Batch transfer summary: ${results.success.length} successful, ${results.failure.length} failed.`);
}

// Execute the batch transfers
processBatchTransfers();
