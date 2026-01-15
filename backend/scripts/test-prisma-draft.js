/**
 * Test script to verify Prisma DraftTransaction model is accessible
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
        console.log('Testing Prisma DraftTransaction model...');
        
        // Check if model exists
        console.log('✅ Prisma Client initialized');
        console.log('Available models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
        
        // Try to query draft transactions
        const count = await prisma.draftTransaction.count();
        console.log('✅ DraftTransaction model is accessible');
        console.log('Total draft transactions:', count);
        
        // Try to get pending drafts
        const pending = await prisma.draftTransaction.findMany({
            where: { status: 'pending' },
            take: 5
        });
        console.log('✅ Pending drafts query successful');
        console.log('Pending drafts:', pending.length);
        
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

