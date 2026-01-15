import { NextRequest } from "next/server";
import { POST as bankSync } from "@/app/api/bank/sync/route";

export async function POST(req: NextRequest) {
    return bankSync(req);
}
