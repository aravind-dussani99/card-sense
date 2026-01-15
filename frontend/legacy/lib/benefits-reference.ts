export type Benefit = {
    title: string;
    description?: string;
    tags?: string[];
    categories?: string[];
    sources?: string[]; // URLs or references
};

export type ProductBenefits = {
    productCode?: string;
    planName?: string;
    institution?: string;
    benefits: Benefit[];
};

// Seed list you can expand; keyed by productCode
export const PRODUCT_BENEFITS: ProductBenefits[] = [
    {
        productCode: "monzo-premium",
        planName: "Monzo Premium",
        institution: "Monzo",
        benefits: [
            { title: "Mobile phone insurance", tags: ["insurance", "mobile"] },
            { title: "Worldwide travel insurance", tags: ["insurance", "travel"] },
            { title: "Airport lounge discounts", tags: ["travel", "lounge"] },
            { title: "Interest on balances", tags: ["interest", "savings"] },
        ],
    },
    {
        productCode: "monzo-plus",
        planName: "Monzo Plus",
        institution: "Monzo",
        benefits: [
            { title: "Virtual cards", tags: ["security"] },
            { title: "Advanced budgeting", tags: ["budget"] },
            { title: "Custom categories", tags: ["budget", "categories"] },
        ],
    },
];

export function findBenefitsForProduct(productCode?: string, planName?: string) {
    if (!productCode && !planName) return null;
    return PRODUCT_BENEFITS.find(
        (p) =>
            (productCode && p.productCode === productCode) ||
            (planName && p.planName?.toLowerCase() === planName.toLowerCase())
    );
}
