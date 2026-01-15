"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface OfferData {
    emailId: string;
    title: string;
    description: string;
    cardId?: string;
    discountAmount?: number;
    discountPercent?: number;
    minSpend?: number;
    maxDiscount?: number;
    startDate: Date;
    endDate: Date;
    terms?: string;
    category?: string;
    senderEmail?: string;
    emailSubject?: string;
    emailBody?: string;
}

export async function createOffer(data: OfferData) {
    try {
        // Check if offer with this emailId already exists
        const existingOffer = await prisma.offer.findUnique({
            where: { emailId: data.emailId },
        });

        if (existingOffer) {
            console.log(`Offer with emailId ${data.emailId} already exists, skipping...`);
            return { success: true, data: existingOffer, skipped: true };
        }

        // Validate dates - if invalid, use defaults
        const now = new Date();
        const startDate = data.startDate && !isNaN(data.startDate.getTime()) 
            ? data.startDate 
            : now;
        const endDate = data.endDate && !isNaN(data.endDate.getTime()) 
            ? data.endDate 
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

        const offer = await prisma.offer.create({
            data: {
                emailId: data.emailId,
                title: data.title,
                description: data.description,
                cardId: data.cardId || null,
                discountAmount: data.discountAmount || null,
                discountPercent: data.discountPercent || null,
                minSpend: data.minSpend || null,
                maxDiscount: data.maxDiscount || null,
                startDate: startDate,
                endDate: endDate,
                terms: data.terms || null,
                category: data.category || null,
                senderEmail: data.senderEmail || null,
                emailSubject: data.emailSubject || null,
                emailBody: data.emailBody || null,
                status: "active",
                isRead: false,
            },
        });
        revalidatePath("/offers");
        return { success: true, data: offer };
    } catch (error: any) {
        console.error("Failed to create offer:", error);
        return { success: false, error: error.message || "Failed to create offer" };
    }
}

export async function getOffers(includeArchived: boolean = false) {
    try {
        const where = includeArchived
            ? {}
            : {
                  OR: [
                      { status: "active" },
                      {
                          status: "active",
                          endDate: { gte: new Date() },
                      },
                  ],
              };

        const offers = await prisma.offer.findMany({
            where,
            include: {
                card: {
                    include: {
                        cardType: true,
                    },
                },
            },
            orderBy: { endDate: "asc" },
        });
        return offers;
    } catch (error) {
        console.error("Failed to fetch offers:", error);
        return [];
    }
}

export async function getActiveOffers() {
    try {
        const now = new Date();
        const offers = await prisma.offer.findMany({
            where: {
                status: "active",
                startDate: { lte: now },
                endDate: { gte: now },
            },
            include: {
                card: {
                    include: {
                        cardType: true,
                    },
                },
            },
            orderBy: { endDate: "asc" },
        });
        return offers;
    } catch (error) {
        console.error("Failed to fetch active offers:", error);
        return [];
    }
}

export async function archiveExpiredOffers() {
    try {
        const now = new Date();
        const result = await prisma.offer.updateMany({
            where: {
                status: "active",
                endDate: { lt: now },
            },
            data: {
                status: "archived",
            },
        });
        revalidatePath("/offers");
        return { success: true, count: result.count };
    } catch (error: any) {
        console.error("Failed to archive expired offers:", error);
        return { success: false, error: error.message || "Failed to archive expired offers" };
    }
}

export async function updateOfferStatus(id: string, status: "active" | "archived" | "used") {
    try {
        await prisma.offer.update({
            where: { id },
            data: { status },
        });
        revalidatePath("/offers");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update offer status:", error);
        return { success: false, error: error.message || "Failed to update offer status" };
    }
}

export async function markOfferAsRead(id: string) {
    try {
        await prisma.offer.update({
            where: { id },
            data: { isRead: true },
        });
        revalidatePath("/offers");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to mark offer as read:", error);
        return { success: false, error: error.message || "Failed to mark offer as read" };
    }
}

export async function getAllOffers() {
    try {
        const offers = await prisma.offer.findMany({
            include: {
                card: {
                    include: {
                        cardType: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        return offers;
    } catch (error) {
        console.error("Failed to fetch all offers:", error);
        return [];
    }
}

export async function getOffersBySender() {
    try {
        const offers = await prisma.offer.findMany({
            where: {
                senderEmail: { not: null },
            },
            select: {
                senderEmail: true,
                id: true,
                createdAt: true,
            },
        });

        // Group by sender email and count
        const senderStats: Record<string, { count: number; lastEmail: Date }> = {};
        
        for (const offer of offers) {
            if (offer.senderEmail) {
                if (!senderStats[offer.senderEmail]) {
                    senderStats[offer.senderEmail] = {
                        count: 0,
                        lastEmail: offer.createdAt,
                    };
                }
                senderStats[offer.senderEmail].count++;
                if (offer.createdAt > senderStats[offer.senderEmail].lastEmail) {
                    senderStats[offer.senderEmail].lastEmail = offer.createdAt;
                }
            }
        }

        // Convert to array and calculate daily/weekly/monthly counts
        const now = new Date();
        const stats = Object.entries(senderStats).map(([email, data]) => {
            const daysSinceLastEmail = Math.floor((now.getTime() - data.lastEmail.getTime()) / (1000 * 60 * 60 * 24));
            const last7Days = offers.filter(
                o => o.senderEmail === email && 
                (now.getTime() - o.createdAt.getTime()) <= 7 * 24 * 60 * 60 * 1000
            ).length;
            const last30Days = offers.filter(
                o => o.senderEmail === email && 
                (now.getTime() - o.createdAt.getTime()) <= 30 * 24 * 60 * 60 * 1000
            ).length;

            return {
                senderEmail: email,
                totalCount: data.count,
                last7Days,
                last30Days,
                daysSinceLastEmail,
                lastEmailDate: data.lastEmail,
            };
        });

        return stats.sort((a, b) => b.totalCount - a.totalCount);
    } catch (error) {
        console.error("Failed to get offers by sender:", error);
        return [];
    }
}

export async function deleteOffer(id: string) {
    try {
        await prisma.offer.delete({
            where: { id },
        });
        revalidatePath("/offers");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to delete offer:", error);
        return { success: false, error: error.message || "Failed to delete offer" };
    }
}

