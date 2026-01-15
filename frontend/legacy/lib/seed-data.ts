import { prisma } from "./prisma";

export async function seedDefaultData() {
    try {
        // Check if categories already exist
        const existingCategories = await prisma.category.findMany();
        const existingCardTypes = await prisma.cardType.findMany();
        const existingBanks = await prisma.bank.findMany();
        
        const defaultCategories = [
            { name: "Food", color: "#FF6B6B", icon: "🍔" },
            { name: "Travel", color: "#4ECDC4", icon: "✈️" },
            { name: "Shopping", color: "#45B7D1", icon: "🛍️" },
            { name: "Entertainment", color: "#FFA07A", icon: "🎬" },
            { name: "Utilities", color: "#98D8C8", icon: "💡" },
            { name: "Other", color: "#95A5A6", icon: "📦" },
        ];

        for (const category of defaultCategories) {
            await prisma.category.upsert({
                where: { name: category.name },
                update: { color: category.color, icon: category.icon },
                create: {
                    name: category.name,
                    color: category.color,
                    icon: category.icon,
                },
            });
        }

        const mustHaveCategories = [
            {
                name: "Card Payments",
                subCategories: [
                    "Aravind - Barclays CC - In",
                    "Aravind - Barclays CC - Paid",
                    "Aravind - Monzo Flex CC - In",
                    "Aravind - Monzo Flex CC - Paid",
                ],
            },
            {
                name: "Hand Loan",
                subCategories: [
                    "Hand Loan - In",
                    "Hand Loan - In - Returned",
                    "Hand Loan - Out",
                    "Hand Loan - Out - Received",
                ],
            },
            {
                name: "House Expenses",
                subCategories: [
                    "Groceries",
                    "Meat",
                    "Vegetables",
                ],
            },
            {
                name: "Memberships",
                subCategories: [
                    "Aravind - Sim",
                    "Neeraja - Sim",
                    "Neeraja - Gym",
                    "Aravind - Gym",
                    "Aravind - Projects - OpenAI",
                    "Aravind - Projects - Cursor",
                ],
            },
        ];

        for (const category of mustHaveCategories) {
            const savedCategory = await prisma.category.upsert({
                where: { name: category.name },
                update: {},
                create: { name: category.name },
            });

            for (const subName of category.subCategories) {
                const existingSub = await prisma.subCategory.findFirst({
                    where: { categoryId: savedCategory.id, name: subName },
                    select: { id: true },
                });
                if (!existingSub) {
                    await prisma.subCategory.create({
                        data: { categoryId: savedCategory.id, name: subName },
                    });
                }
            }
        }

        // Create default card types (only if they don't exist)
        // Note: The name IS the network (e.g., "Visa", "Mastercard", "American Express")
        if (existingCardTypes.length === 0) {
            const cardTypes = [
                { name: "Visa", color: "#1A1F71", icon: "💳" },
                { name: "Mastercard", color: "#EB001B", icon: "💳" },
                { name: "American Express", color: "#006FCF", icon: "💳" },
                { name: "Discover", color: "#FF6000", icon: "💳" },
            ];

            for (const cardType of cardTypes) {
                await prisma.cardType.create({
                    data: {
                        name: cardType.name,
                        color: cardType.color,
                        icon: cardType.icon,
                    },
                });
            }
        }

        // Create default banks (only if they don't exist)
        if (existingBanks.length === 0) {
            const banks = [
                { name: "SBI", color: "#004C93", icon: "🏦" },
                { name: "HDFC", color: "#004C93", icon: "🏦" },
                { name: "Monzo", color: "#14233C", icon: "🏦" },
                { name: "Lloyds", color: "#006A4E", icon: "🏦" },
                { name: "Halifax", color: "#00AEEF", icon: "🏦" },
            ];

            for (const bank of banks) {
                await prisma.bank.create({
                    data: {
                        name: bank.name,
                        color: bank.color,
                        icon: bank.icon,
                    },
                });
            }
        }

        if (existingCategories.length > 0 && existingCardTypes.length > 0 && existingBanks.length > 0) {
            console.log("Default data already exists, ensured required categories/sub-categories");
            return;
        }

        console.log("Default data seeded successfully");
    } catch (error) {
        console.error("Error seeding default data:", error);
    }
}
