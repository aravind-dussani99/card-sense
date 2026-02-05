import { prisma } from "./prisma.js";

export async function seedDefaultData() {
  try {
    const existingCategories = await prisma.category.findMany({ where: { userId: null } });
    const existingCardTypes = await prisma.cardType.findMany();
    const existingBanks = await prisma.bank.findMany();

    const defaultCategories = [
      { name: "Food", color: "#FF6B6B", icon: "food" },
      { name: "Travel", color: "#4ECDC4", icon: "travel" },
      { name: "Shopping", color: "#45B7D1", icon: "shopping" },
      { name: "Entertainment", color: "#FFA07A", icon: "entertainment" },
      { name: "Utilities", color: "#98D8C8", icon: "utilities" },
      { name: "Other", color: "#95A5A6", icon: "other" },
    ];

    for (const category of defaultCategories) {
      await prisma.category.upsert({
        where: { userId_name: { userId: null, name: category.name } },
        update: { color: category.color, icon: category.icon },
        create: {
          userId: null,
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
        subCategories: ["Groceries", "Meat", "Vegetables"],
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

    const defaultHeadAccounts = [
      "Personal",
      "Business",
      "Logistics",
      "Agriculture",
      "Household",
      "Savings",
      "Investments",
      "Loans In",
      "Loans Out",
      "Insurance",
      "Subscriptions",
    ];

    for (const name of defaultHeadAccounts) {
      await prisma.headAccount.upsert({
        where: { userId_name: { userId: null, name } },
        update: {},
        create: { userId: null, name },
      });
    }

    for (const category of mustHaveCategories) {
      const savedCategory = await prisma.category.upsert({
        where: { userId_name: { userId: null, name: category.name } },
        update: {},
        create: { userId: null, name: category.name },
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

    if (existingCardTypes.length === 0) {
      const cardTypes = [
        { name: "Visa", color: "#1A1F71", icon: "visa" },
        { name: "Mastercard", color: "#EB001B", icon: "mastercard" },
        { name: "American Express", color: "#006FCF", icon: "amex" },
        { name: "Discover", color: "#FF6000", icon: "discover" },
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

    if (existingBanks.length === 0) {
      const banks = [
        { name: "SBI", color: "#004C93", icon: "bank" },
        { name: "HDFC", color: "#004C93", icon: "bank" },
        { name: "Monzo", color: "#14233C", icon: "bank" },
        { name: "Lloyds", color: "#006A4E", icon: "bank" },
        { name: "Halifax", color: "#00AEEF", icon: "bank" },
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
