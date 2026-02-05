import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
    try {
        console.log('Starting database reset...');

        // Delete in order to respect foreign key constraints
        console.log('Deleting bank transaction metadata...');
        const deletedTransactionMeta = await prisma.bankTransactionMeta.deleteMany({});
        console.log(`Deleted ${deletedTransactionMeta.count} bank transaction metadata`);

        console.log('Deleting bank transactions...');
        const deletedTransactions = await prisma.bankTransaction.deleteMany({});
        console.log(`Deleted ${deletedTransactions.count} bank transactions`);

        // EmailSenderStats might not exist in schema, skip if error
        try {
            console.log('Deleting email sender stats...');
            const deletedSenderStats = await (prisma as any).emailSenderStats?.deleteMany({});
            if (deletedSenderStats) {
                console.log(`Deleted ${deletedSenderStats.count} email sender stats`);
            }
        } catch (e) {
            console.log('EmailSenderStats model not found, skipping...');
        }

        // Account model might not exist, skip if error
        try {
            console.log('Deleting accounts...');
            const deletedAccounts = await (prisma as any).account?.deleteMany({});
            if (deletedAccounts) {
                console.log(`Deleted ${deletedAccounts.count} accounts`);
            }
        } catch (e) {
            console.log('Account model not found, skipping...');
        }

        console.log('Deleting cards...');
        const deletedCards = await prisma.card.deleteMany({});
        console.log(`Deleted ${deletedCards.count} cards`);

        console.log('\n✅ Database reset complete!');
        console.log('Summary:');
        console.log(`  - Bank Transaction Meta: ${deletedTransactionMeta.count}`);
        console.log(`  - Bank Transactions: ${deletedTransactions.count}`);
        console.log(`  - Cards: ${deletedCards.count}`);
    } catch (error) {
        console.error('Error resetting database:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase()
    .then(() => {
        console.log('\n✅ Reset completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Reset failed:', error);
        process.exit(1);
    });
