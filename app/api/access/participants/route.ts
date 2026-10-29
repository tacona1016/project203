import { getLoginMembers } from "@/lib/auth/members";
import { handleApi } from "@/lib/auth/http";

// Only active UUIDs and names are public; no configuration or full rows.
export async function GET() { return handleApi(getLoginMembers); }
