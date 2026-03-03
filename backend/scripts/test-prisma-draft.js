/**
 * Test script to verify Prisma BankTransaction model is accessible
 * Run with: node scripts/test-prisma-draft.js
 */

// Load env vars manually if dotenv not available
if (require.resolve('dotenv')) {
    require('dotenv').config();
}
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
    try {
        console.log('Testing Prisma BankTransaction model...');
        
        // Check if model exists
        console.log('✅ Prisma Client initialized');
        console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
        
        // Try to query bank transactions
        const count = await prisma.bankTransaction.count();
        console.log('✅ BankTransaction model is accessible');
        console.log('Total bank transactions:', count);
        
        // Try to get a few transactions
        const recent = await prisma.bankTransaction.findMany({
            orderBy: { date: 'desc' },
            take: 5
        });
        console.log('✅ Recent transactions query successful');
        console.log('Recent transactions:', recent.length);
        
        await prisma.$disconnect();
        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await prisma.$disconnect();
        process.exit(1);
    }
}

test();
