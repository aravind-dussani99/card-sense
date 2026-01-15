export type StaticOffer = {
    id: string;
    title: string;
    description: string;
    network?: string; // Visa, Mastercard, American Express
    issuer?: string; // e.g., monzo, revolut
    category?: string; // simplified category tag
    minSpend?: number;
    rewardText: string;
    expiresAt?: string; // ISO date
};

// Tiny starter catalog; extend as we learn more issuers/products.
export const STATIC_OFFERS: StaticOffer[] = [
    {
        id: "offer-visa-dining-10",
        title: "Visa Dining 10% back",
        description: "Earn 10% back at restaurants and cafes.",
        network: "visa",
        category: "dining",
        minSpend: 10,
        rewardText: "10% back on dining, £10 max monthly",
    },
    {
        id: "offer-mc-fuel-5off40",
        title: "Mastercard Fuel £5 off £40",
        description: "Save £5 when you spend £40 or more at petrol stations.",
        network: "mastercard",
        category: "fuel",
        minSpend: 40,
        rewardText: "£5 statement credit on £40+ fuel",
    },
    {
        id: "offer-groceries-5",
        title: "Groceries 5% weekly",
        description: "5% back on grocery stores every week, up to £8 back.",
        category: "groceries",
        rewardText: "5% back, £8 cap per week",
    },
];
