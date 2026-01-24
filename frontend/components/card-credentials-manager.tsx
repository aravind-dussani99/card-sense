"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { decryptPayload } from "@/lib/vault";

type CardRecord = {
  id: string;
  name?: string | null;
  last4?: string | null;
  cardCategory?: string | null;
};

type CredentialMeta = {
  id: string;
  cardId: string;
  label?: string | null;
  encryptedPayload?: string;
};

type DecryptedCardCredentials = {
  fullCardNumber?: string;
  expiryDate?: string;
  cvv?: string;
  pin?: string;
  cardPassword?: string;
  memo?: string;
  label?: string;
};

export function CardCredentialsManager() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialMeta[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<CardRecord | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [decrypted, setDecrypted] = useState<DecryptedCardCredentials | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [cardData, credData] = await Promise.all([
          apiFetch<CardRecord[]>("/api/cards"),
          apiFetch<CredentialMeta[]>("/api/credentials/cards"),
        ]);
        setCards(cardData);
        setCredentials(credData);
      } catch (error) {
        setFeedback({ type: "error", message: getErrorMessage(error, "Failed to load cards") });
      }
    };
    load();
  }, []);

  const credentialMap = useMemo(() => {
    const map = new Map<string, CredentialMeta>();
    credentials.forEach((cred) => map.set(cred.cardId, cred));
    return map;
  }, [credentials]);

  const openView = (card: CardRecord) => {
    setActiveCard(card);
    setViewOpen(true);
    setPassphrase("");
    setDecrypted(null);
  };

  const handleDecrypt = async () => {
    if (!activeCard) return;
    if (!passphrase) {
      setFeedback({ type: "error", message: "Enter a passphrase to decrypt." });
      return;
    }
    try {
      const records = await apiFetch<CredentialMeta[]>(
        `/api/credentials/cards?cardId=${encodeURIComponent(activeCard.id)}&includePayload=true`
      );
      const record = records?.[0];
      if (!record?.encryptedPayload) {
        setFeedback({ type: "error", message: "No encrypted payload found." });
        return;
      }
      const data = await decryptPayload(passphrase, record.encryptedPayload);
      setDecrypted(data);
    } catch (error) {
      setFeedback({ type: "error", message: getErrorMessage(error, "Failed to decrypt credentials.") });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Card Credentials</CardTitle>
        <CardDescription>Decrypt and view stored card credentials.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {feedback && (
          <Alert variant={feedback.type === "success" ? "default" : "destructive"}>
            <AlertTitle>{feedback.type === "success" ? "Success" : "Error"}</AlertTitle>
            <AlertDescription>{feedback.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const hasCred = credentialMap.has(card.id);
            return (
              <div key={card.id} className="border rounded-lg p-3 space-y-2">
                <div className="font-medium">{card.name || "Card"}</div>
                <div className="text-xs text-muted-foreground">
                  {card.last4 ? `••${card.last4}` : "—"} {card.cardCategory ? `· ${card.cardCategory}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  Credentials: {hasCred ? "Stored" : "Not stored"}
                </div>
                {hasCred && (
                  <Button size="sm" variant="ghost" onClick={() => openView(card)}>
                    View
                  </Button>
                )}
              </div>
            );
          })}
          {cards.length === 0 && (
            <div className="text-sm text-muted-foreground">No cards found.</div>
          )}
        </div>
      </CardContent>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Decrypt card credentials</DialogTitle>
            <DialogDescription>Enter the passphrase used when saving.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Vault Passphrase</Label>
              <Input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
            </div>
            <Button onClick={handleDecrypt}>Decrypt</Button>
            {decrypted && (
              <div className="rounded-md border p-3 text-sm space-y-1">
                <div>Full Card Number: {decrypted.fullCardNumber || "—"}</div>
                <div>Name on Card: {decrypted.nameOnCard || "—"}</div>
                <div>Expiry Date: {decrypted.expiryDate || "—"}</div>
                <div>CVV: {decrypted.cvv || "—"}</div>
                <div>PIN: {decrypted.pin || "—"}</div>
                <div>App Password: {decrypted.appPassword || "—"}</div>
                <div>Memorable Info: {decrypted.memorableInfo || "—"}</div>
                <div>Notes: {decrypted.notes || "—"}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
