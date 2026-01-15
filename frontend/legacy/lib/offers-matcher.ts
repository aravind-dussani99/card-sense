import { STATIC_OFFERS, StaticOffer } from "./offers-catalog";

type CardLike = { network?: string | null; issuer?: string | null };
type AccountLike = { issuer?: string | null };
type SpendByCategory = Record<string, number>;

export type MatchedOffer = StaticOffer & {
    reason: string;
    suggestedFor: string[];
};

function normalize(str?: string | null) {
    return (str || "").toLowerCase().trim();
}

export function matchOffers(params: {
    cards: CardLike[];
    accounts: AccountLike[];
    spend: SpendByCategory;
}): MatchedOffer[] {
    const networks = new Set(params.cards.map((c) => normalize(c.network)).filter(Boolean));
    const issuers = new Set(
        [...params.cards.map((c) => normalize(c.issuer)), ...params.accounts.map((a) => normalize(a.issuer))].filter(Boolean),
    );
    const categories = new Set(Object.keys(params.spend));

    const matches: MatchedOffer[] = [];

    for (const offer of STATIC_OFFERS) {
        const offerNetwork = normalize(offer.network);
        const offerIssuer = normalize(offer.issuer);
        const offerCategory = normalize(offer.category);

        const networkOk = offerNetwork ? networks.has(offerNetwork) : true;
        const issuerOk = offerIssuer ? issuers.has(offerIssuer) : true;
        const categoryOk = offerCategory ? categories.has(offerCategory) || params.spend[offerCategory] > 0 : true;

        if (!(networkOk && issuerOk && categoryOk)) continue;

        const suggestedFor: string[] = [];
        if (offerNetwork) {
            params.cards.forEach((c) => {
                if (normalize(c.network) === offerNetwork) suggestedFor.push(c.network || "Card");
            });
        }

        matches.push({
            ...offer,
            reason: [
                offerNetwork ? `Matches network: ${offer.network}` : null,
                offerIssuer ? `Issuer: ${offer.issuer}` : null,
                offerCategory ? `Category spend detected: ${offer.category}` : "General offer",
            ]
                .filter(Boolean)
                .join(" • "),
            suggestedFor: suggestedFor.length ? Array.from(new Set(suggestedFor)) : ["Any eligible card"],
        });
    }

    return matches;
}
