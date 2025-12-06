import { getUConnTeamInfo } from "@/lib/espn-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp } from "lucide-react";
import Image from "next/image";
import { HomeLiveWidget } from "@/components/home-live";

export const revalidate = 300; // Revalidate every 5 minutes

export default async function Home() {
  const teamData = await getUConnTeamInfo();
  const team = teamData?.team;

  return (
    <main className="min-h-screen p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8 mt-8">
        {team?.logos?.[0]?.href && (
          <Image
            src={team.logos[0].href}
            alt="UConn Logo"
            width={120}
            height={120}
            className="mx-auto mb-4 rounded-[10px]"
          />
        )}
        <h1 className="text-5xl md:text-6xl font-bold text-primary mb-2">
          {team?.displayName || "UConn Huskies"}
        </h1>
        <p className="text-xl text-muted-foreground">Women&apos;s Basketball</p>
      </div>

      {/* Current Record */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Record & Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <p className="text-sm text-muted-foreground">Record</p>
                <p className="text-4xl font-bold leading-tight">
                  {team?.record?.items?.find((r: any) => r.type === "total")?.summary || "0-0"}
                </p>
                <p className="text-muted-foreground mt-1">
                  {team?.standingSummary || "Season 2025-26"}
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-sm text-muted-foreground">Ranking</p>
                <p className="text-4xl font-bold leading-tight">
                  #{team?.rank || "1"}
                </p>
                <p className="text-muted-foreground mt-1">AP Poll</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Live + Upcoming */}
      <div className="mt-12 space-y-4">
        <h2 className="text-3xl font-bold">Live & Upcoming</h2>
        <HomeLiveWidget />
      </div>

    </main>
  );
}
